"""风控管理路由"""

import time
import math
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, BackgroundTasks
from auth import get_current_user
from bridge import bridge
import asyncio
from threading import Lock

router = APIRouter(prefix="/api/risk", tags=["risk"], dependencies=[Depends(get_current_user)])

# 默认风控规则
DEFAULT_RULES = {
    "order_flow_limit": {
        "name": "order_flow_limit",
        "description": "订单流控限制（每分钟最大订单数）",
        "enabled": True,
        "limit": 60,
        "window": 60,  # 秒
    },
    "daily_loss_limit": {
        "name": "daily_loss_limit",
        "description": "日亏损限制（达到该亏损额时暂停交易）",
        "enabled": True,
        "limit": 10000,  # 元
    },
    "single_order_limit": {
        "name": "single_order_limit",
        "description": "单笔订单数量限制",
        "enabled": True,
        "limit": 100,  # 手
    },
    "position_limit": {
        "name": "position_limit",
        "description": "总持仓限制",
        "enabled": False,
        "limit": 1000,  # 手
    },
    "trading_hours": {
        "name": "trading_hours",
        "description": "交易时间限制",
        "enabled": True,
        "allowed_hours": ["09:00-15:00", "21:00-23:00"],
    },
}

# 内存存储风控规则状态（实际应该持久化到数据库）
_risk_rules = DEFAULT_RULES.copy()
_risk_events = []

# 订单流监控数据
_order_flow_buffer: list[dict] = []
_order_flow_websockets: set[WebSocket] = set()
_MAX_ORDER_FLOW_BUFFER = 1000


def _add_order_flow_record(record: dict):
    """添加订单流记录并广播"""
    record["timestamp"] = datetime.now().isoformat()
    record["id"] = f"{time.time()}_{len(_order_flow_buffer)}"
    _order_flow_buffer.append(record)
    # 限制缓冲区大小
    if len(_order_flow_buffer) > _MAX_ORDER_FLOW_BUFFER:
        _order_flow_buffer.pop(0)
    # 广播到所有WebSocket客户端
    asyncio = __import__('asyncio')
    for ws in list(_order_flow_websockets):
        try:
            asyncio.create_task(ws.send_json({"type": "order_flow", "data": record}))
        except Exception:
            pass


@router.get("/rules")
async def get_rules():
    """获取所有风控规则"""
    return list(_risk_rules.values())


@router.get("/rules/{name}")
async def get_rule(name: str):
    """获取规则详情"""
    if name not in _risk_rules:
        raise HTTPException(status_code=404, detail="规则不存在")
    return _risk_rules[name]


@router.put("/rules/{name}")
async def update_rule(name: str, body: dict):
    """更新规则"""
    if name not in _risk_rules:
        raise HTTPException(status_code=404, detail="规则不存在")

    # 更新允许的字段
    allowed_fields = ["enabled", "limit", "window", "allowed_hours"]
    for field in allowed_fields:
        if field in body:
            _risk_rules[name][field] = body[field]

    return _risk_rules[name]


@router.get("/events")
async def get_events(limit: int = 50):
    """获取风控事件日志"""
    return _risk_events[-limit:]


@router.get("/status")
async def get_status():
    """获取风控状态"""
    return {
        "enabled": True,
        "total_events": len(_risk_events),
        "active_rules": sum(1 for r in _risk_rules.values() if r.get("enabled")),
        "total_rules": len(_risk_rules),
    }


@router.post("/reset")
async def reset_rules():
    """重置风控规则为默认值"""
    global _risk_rules
    _risk_rules = DEFAULT_RULES.copy()
    return {"message": "规则已重置"}


# ============ 订单流监控 ============

@router.get("/order-flow")
async def get_order_flow(
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = Query(None, description="筛选状态: passed, blocked, pending")
):
    """获取订单流监控数据"""
    records = _order_flow_buffer[-limit:]
    if status:
        records = [r for r in records if r.get("status") == status]
    return records[::-1]  # 最新在前


@router.get("/order-flow/stats")
async def get_order_flow_stats():
    """获取订单流统计"""
    now = time.time()
    minute_ago = now - 60
    hour_ago = now - 3600

    minute_orders = [r for r in _order_flow_buffer if r.get("timestamp_unix", 0) > minute_ago]
    hour_orders = [r for r in _order_flow_buffer if r.get("timestamp_unix", 0) > hour_ago]

    return {
        "total": len(_order_flow_buffer),
        "last_minute": len(minute_orders),
        "last_hour": len(hour_orders),
        "passed": len([r for r in _order_flow_buffer if r.get("status") == "passed"]),
        "blocked": len([r for r in _order_flow_buffer if r.get("status") == "blocked"]),
        "pending": len([r for r in _order_flow_buffer if r.get("status") == "pending"]),
    }


@router.post("/order-flow/check")
async def check_order(order: dict):
    """检查订单是否通过风控（模拟风控检查）"""
    result = _check_order_risk(order)
    _add_order_flow_record({
        "vt_symbol": order.get("vt_symbol", ""),
        "direction": order.get("direction", ""),
        "offset": order.get("offset", ""),
        "price": order.get("price", 0),
        "volume": order.get("volume", 0),
        "status": "passed" if result["passed"] else "blocked",
        "reason": result.get("reason", ""),
        "checked_rules": result.get("checked_rules", [])
    })
    return result


def _check_order_risk(order: dict) -> dict:
    """执行风控检查"""
    checked_rules = []

    # 检查单笔订单限制
    if _risk_rules["single_order_limit"]["enabled"]:
        limit = _risk_rules["single_order_limit"]["limit"]
        if order.get("volume", 0) > limit:
            return {
                "passed": False,
                "reason": f"单笔订单数量超过限制 ({order.get('volume')} > {limit})",
                "checked_rules": checked_rules + ["single_order_limit"]
            }
        checked_rules.append("single_order_limit")

    # 检查订单流速
    if _risk_rules["order_flow_limit"]["enabled"]:
        window = _risk_rules["order_flow_limit"]["window"]
        limit = _risk_rules["order_flow_limit"]["limit"]
        now = time.time()
        recent_orders = [r for r in _order_flow_buffer
                        if r.get("timestamp_unix", 0) > now - window
                        and r.get("status") in ["passed", "pending"]]
        if len(recent_orders) >= limit:
            return {
                "passed": False,
                "reason": f"订单流速超限 ({len(recent_orders)} >= {limit} / {window}s)",
                "checked_rules": checked_rules + ["order_flow_limit"]
            }
        checked_rules.append("order_flow_limit")

    return {"passed": True, "checked_rules": checked_rules}


@router.websocket("/ws/order-flow")
async def order_flow_websocket(websocket: WebSocket):
    """订单流实时WebSocket推送"""
    await websocket.accept()
    _order_flow_websockets.add(websocket)
    try:
        # 发送历史数据
        await websocket.send_json({
            "type": "history",
            "data": _order_flow_buffer[-100:][::-1]
        })
        # 保持连接
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        _order_flow_websockets.discard(websocket)


# ============ 风险敞口计算 ============

@dataclass
class PositionExposure:
    """单个持仓的风险敞口"""
    vt_symbol: str
    direction: str  # long / short
    volume: int
    price: float
    margin: float
    notional: float  # 名义价值
    pnl: float
    Greeks: Dict[str, float] = field(default_factory=dict)  # 期权希腊值


@dataclass
class PortfolioRisk:
    """组合风险指标"""
    total_exposure: float  # 总敞口
    net_exposure: float  # 净敞口
    long_exposure: float  # 多头敞口
    short_exposure: float  # 空头敞口
    margin_used: float  # 已用保证金
    margin_ratio: float  # 保证金使用率
    var_95: float  # 95% VaR
    var_99: float  # 99% VaR
    beta: float  # 组合Beta
    concentration_risk: float  # 集中度风险
    sector_exposure: Dict[str, float]  # 行业敞口
    timestamp: str


# 风险敞口缓存
_exposure_cache: Dict[str, Any] = {}
_exposure_cache_time: Optional[datetime] = None
_exposure_lock = Lock()


def _calculate_position_exposure(position: dict, current_price: float) -> PositionExposure:
    """计算单个持仓敞口"""
    volume = position.get("volume", 0)
    direction = "long" if volume > 0 else "short"
    abs_volume = abs(volume)

    # 获取合约信息计算保证金
    contract = bridge.get_contract(position.get("vt_symbol", ""))
    margin_rate = 0.12  # 默认12%
    contract_size = 10  # 默认10吨/手

    if contract:
        margin_rate = contract.get("margin_rate", 0.12)
        contract_size = contract.get("size", 10)

    notional = abs_volume * current_price * contract_size
    margin = notional * margin_rate
    pnl = position.get("pnl", 0)

    return PositionExposure(
        vt_symbol=position.get("vt_symbol", ""),
        direction=direction,
        volume=abs_volume,
        price=current_price,
        margin=margin,
        notional=notional,
        pnl=pnl
    )


def _calculate_var_mc(returns: np.ndarray, confidence: float = 0.95) -> float:
    """使用蒙特卡洛模拟计算VaR"""
    if len(returns) == 0:
        return 0.0

    # 参数估计
    mu = np.mean(returns)
    sigma = np.std(returns)

    if sigma == 0:
        return 0.0

    # 蒙特卡洛模拟
    np.random.seed(42)
    simulations = 10000
    simulated_returns = np.random.normal(mu, sigma, simulations)

    # 计算VaR
    var = np.percentile(simulated_returns, (1 - confidence) * 100)
    return abs(var)


def _calculate_var_historical(returns: np.ndarray, confidence: float = 0.95) -> float:
    """使用历史模拟法计算VaR"""
    if len(returns) == 0:
        return 0.0
    var = np.percentile(returns, (1 - confidence) * 100)
    return abs(var)


@router.get("/exposure")
async def get_risk_exposure():
    """获取实时风险敞口"""
    global _exposure_cache, _exposure_cache_time

    # 检查缓存（5秒有效期）
    with _exposure_lock:
        if _exposure_cache_time and (datetime.now() - _exposure_cache_time).seconds < 5:
            return _exposure_cache

    try:
        # 获取持仓数据
        positions = bridge.get_all_positions() or []

        exposures = []
        total_margin = 0.0
        total_notional_long = 0.0
        total_notional_short = 0.0
        total_pnl = 0.0

        # 获取账户信息
        accounts = bridge.get_all_accounts() or []
        total_balance = sum(acc.get("balance", 0) for acc in accounts)

        for pos in positions:
            vt_symbol = pos.get("vt_symbol", "")
            if not vt_symbol:
                continue

            # 获取当前价格
            tick = bridge.get_tick(vt_symbol)
            current_price = tick.get("last_price", 0) if tick else pos.get("price", 0)

            if current_price <= 0:
                continue

            exposure = _calculate_position_exposure(pos, current_price)
            exposures.append(exposure)

            total_margin += exposure.margin
            total_pnl += exposure.pnl

            if exposure.direction == "long":
                total_notional_long += exposure.notional
            else:
                total_notional_short += exposure.notional

        # 计算组合指标
        net_exposure = total_notional_long - total_notional_short
        total_exposure = total_notional_long + total_notional_short

        # 保证金使用率
        margin_ratio = (total_margin / total_balance * 100) if total_balance > 0 else 0

        # 计算VaR（使用历史收益率模拟）
        # 这里简化处理，实际应该获取历史价格数据
        var_95 = total_exposure * 0.02  # 简化：假设2%日波动
        var_99 = total_exposure * 0.05  # 简化：假设5%极端波动

        # 集中度风险（最大单一持仓占比）
        max_position = max([e.notional for e in exposures]) if exposures else 0
        concentration_risk = (max_position / total_exposure * 100) if total_exposure > 0 else 0

        result = {
            "exposures": [
                {
                    "vt_symbol": e.vt_symbol,
                    "direction": e.direction,
                    "volume": e.volume,
                    "price": round(e.price, 2),
                    "notional": round(e.notional, 2),
                    "margin": round(e.margin, 2),
                    "pnl": round(e.pnl, 2),
                    "margin_ratio": round(e.margin / total_balance * 100, 2) if total_balance > 0 else 0
                }
                for e in exposures
            ],
            "summary": {
                "total_exposure": round(total_exposure, 2),
                "net_exposure": round(net_exposure, 2),
                "long_exposure": round(total_notional_long, 2),
                "short_exposure": round(total_notional_short, 2),
                "total_margin": round(total_margin, 2),
                "total_pnl": round(total_pnl, 2),
                "account_balance": round(total_balance, 2),
                "margin_ratio": round(margin_ratio, 2),
                "var_95": round(var_95, 2),
                "var_99": round(var_99, 2),
                "concentration_risk": round(concentration_risk, 2),
                "position_count": len(exposures)
            },
            "timestamp": datetime.now().isoformat()
        }

        # 更新缓存
        with _exposure_lock:
            _exposure_cache = result
            _exposure_cache_time = datetime.now()

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"风险敞口计算失败: {str(e)}")


@router.get("/exposure/history")
async def get_exposure_history(
    hours: int = Query(24, ge=1, le=168),
    interval: str = Query("1h", description="时间间隔: 1m, 5m, 15m, 1h")
):
    """获取风险敞口历史"""
    # 这里简化处理，返回模拟的历史数据
    # 实际应该从数据库获取

    now = datetime.now()
    points = hours * 12 if interval == "5m" else hours if interval == "1h" else hours * 4

    history = []
    for i in range(points, 0, -1):
        t = now - timedelta(hours=i/12 if interval == "5m" else i)
        # 模拟波动数据
        base_exposure = 1000000
        variation = np.sin(i / 10) * 100000 + np.random.normal(0, 50000)

        history.append({
            "timestamp": t.isoformat(),
            "total_exposure": round(base_exposure + variation, 2),
            "net_exposure": round(variation * 0.8, 2),
            "margin_ratio": round(15 + np.sin(i / 20) * 5, 2),
            "var_95": round(base_exposure * 0.02, 2)
        })

    return {
        "history": history,
        "interval": interval,
        "hours": hours
    }


# ============ 自动风控触发 ============

# 风控触发器配置
_auto_risk_triggers = {
    "margin_call": {
        "enabled": True,
        "threshold": 80,  # 保证金使用率超过80%触发
        "action": "alert"  # alert, reduce_position, close_all
    },
    "daily_loss_limit": {
        "enabled": True,
        "threshold": 50000,  # 日亏损限制
        "action": "close_all"
    },
    "var_limit": {
        "enabled": False,
        "threshold": 100000,  # VaR限制
        "action": "reduce_position"
    },
    "concentration_limit": {
        "enabled": True,
        "threshold": 30,  # 单一持仓占比超过30%
        "action": "alert"
    }
}

# 风控触发记录
_risk_trigger_events: List[Dict[str, Any]] = []


def _check_auto_risk_triggers(exposure_data: dict) -> List[Dict[str, Any]]:
    """检查是否需要触发风控"""
    triggered = []
    summary = exposure_data.get("summary", {})

    # 检查保证金使用率
    if _auto_risk_triggers["margin_call"]["enabled"]:
        margin_ratio = summary.get("margin_ratio", 0)
        threshold = _auto_risk_triggers["margin_call"]["threshold"]
        if margin_ratio > threshold:
            triggered.append({
                "trigger": "margin_call",
                "severity": "high" if margin_ratio > 90 else "medium",
                "message": f"保证金使用率达到 {margin_ratio:.1f}%，超过阈值 {threshold}%",
                "action": _auto_risk_triggers["margin_call"]["action"],
                "current_value": margin_ratio,
                "threshold": threshold
            })

    # 检查VaR限制
    if _auto_risk_triggers["var_limit"]["enabled"]:
        var_95 = summary.get("var_95", 0)
        threshold = _auto_risk_triggers["var_limit"]["threshold"]
        if var_95 > threshold:
            triggered.append({
                "trigger": "var_limit",
                "severity": "high",
                "message": f"VaR(95%) 达到 {var_95:.0f}，超过阈值 {threshold}",
                "action": _auto_risk_triggers["var_limit"]["action"],
                "current_value": var_95,
                "threshold": threshold
            })

    # 检查集中度
    if _auto_risk_triggers["concentration_limit"]["enabled"]:
        concentration = summary.get("concentration_risk", 0)
        threshold = _auto_risk_triggers["concentration_limit"]["threshold"]
        if concentration > threshold:
            triggered.append({
                "trigger": "concentration_limit",
                "severity": "medium",
                "message": f"最大持仓集中度 {concentration:.1f}%，超过阈值 {threshold}%",
                "action": _auto_risk_triggers["concentration_limit"]["action"],
                "current_value": concentration,
                "threshold": threshold
            })

    return triggered


@router.get("/triggers")
async def get_risk_triggers():
    """获取风控触发器配置"""
    return _auto_risk_triggers


@router.put("/triggers/{trigger_name}")
async def update_risk_trigger(trigger_name: str, config: dict):
    """更新风控触发器配置"""
    if trigger_name not in _auto_risk_triggers:
        raise HTTPException(status_code=404, detail="触发器不存在")

    allowed_fields = ["enabled", "threshold", "action"]
    for field in allowed_fields:
        if field in config:
            _auto_risk_triggers[trigger_name][field] = config[field]

    return _auto_risk_triggers[trigger_name]


@router.get("/triggers/status")
async def get_risk_trigger_status():
    """获取当前风控触发状态"""
    try:
        # 获取最新敞口数据
        exposure = await get_risk_exposure()
        triggered = _check_auto_risk_triggers(exposure)

        return {
            "status": "safe" if not triggered else ("warning" if all(t["severity"] == "medium" for t in triggered) else "danger"),
            "triggered_rules": triggered,
            "trigger_count": len(triggered),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unknown",
            "error": str(e),
            "triggered_rules": [],
            "trigger_count": 0
        }


@router.post("/triggers/execute")
async def execute_risk_action(action: dict):
    """执行风控操作"""
    action_type = action.get("action")
    target = action.get("target", "all")

    if action_type == "close_all":
        # 平仓所有持仓
        # 这里应该调用实际的平仓接口
        _risk_trigger_events.append({
            "timestamp": datetime.now().isoformat(),
            "action": "close_all",
            "target": target,
            "reason": action.get("reason", "风控触发"),
            "status": "executed"
        })
        return {"message": "已执行全仓平仓", "action": "close_all"}

    elif action_type == "reduce_position":
        # 减仓
        reduce_ratio = action.get("ratio", 0.5)
        _risk_trigger_events.append({
            "timestamp": datetime.now().isoformat(),
            "action": "reduce_position",
            "target": target,
            "ratio": reduce_ratio,
            "reason": action.get("reason", "风控触发"),
            "status": "executed"
        })
        return {"message": f"已执行减仓 {reduce_ratio*100}%", "action": "reduce_position", "ratio": reduce_ratio}

    elif action_type == "alert":
        # 仅发送警告
        _risk_trigger_events.append({
            "timestamp": datetime.now().isoformat(),
            "action": "alert",
            "target": target,
            "reason": action.get("reason", "风控警告"),
            "status": "alerted"
        })
        return {"message": "已发送风控警告", "action": "alert"}

    else:
        raise HTTPException(status_code=400, detail=f"未知操作类型: {action_type}")


@router.get("/triggers/events")
async def get_trigger_events(limit: int = 50):
    """获取风控触发事件历史"""
    return _risk_trigger_events[-limit:][::-1]


# ============ VaR 分析 ============

@router.post("/var/calculate")
async def calculate_var(params: dict):
    """计算自定义VaR"""
    method = params.get("method", "historical")  # historical, parametric, monte_carlo
    confidence = params.get("confidence", 0.95)
    time_horizon = params.get("time_horizon", 1)  # 天数
    portfolio_value = params.get("portfolio_value", 1000000)

    # 获取历史收益率数据（简化处理）
    # 实际应该从数据库获取
    np.random.seed(42)
    historical_returns = np.random.normal(0.001, 0.02, 252)  # 252个交易日

    if method == "historical":
        var = _calculate_var_historical(historical_returns, confidence)
    elif method == "monte_carlo":
        var = _calculate_var_mc(historical_returns, confidence)
    elif method == "parametric":
        # 参数法（方差-协方差法）
        mu = np.mean(historical_returns)
        sigma = np.std(historical_returns)
        z_score = 1.96 if confidence == 0.95 else 2.33
        var = abs(mu - z_score * sigma)
    else:
        raise HTTPException(status_code=400, detail=f"不支持的VaR计算方法: {method}")

    # 调整时间范围
    var_adjusted = var * math.sqrt(time_horizon)

    # 转换为金额
    var_amount = portfolio_value * var_adjusted

    return {
        "var_relative": round(var_adjusted, 4),
        "var_amount": round(var_amount, 2),
        "confidence": confidence,
        "time_horizon": time_horizon,
        "method": method,
        "portfolio_value": portfolio_value
    }


@router.get("/var/sensitivity")
async def get_var_sensitivity(
    portfolio_value: float = 1000000,
    base_volatility: float = 0.02
):
    """获取VaR敏感度分析"""
    confidences = [0.90, 0.95, 0.99]
    time_horizons = [1, 5, 10, 20]

    results = []
    for conf in confidences:
        row = {"confidence": conf}
        for horizon in time_horizons:
            z_score = 1.28 if conf == 0.90 else (1.96 if conf == 0.95 else 2.33)
            var = portfolio_value * base_volatility * z_score * math.sqrt(horizon)
            row[f"d_{horizon}"] = round(var, 2)
        results.append(row)

    return {
        "sensitivity_matrix": results,
        "portfolio_value": portfolio_value,
        "base_volatility": base_volatility,
        "note": "单位:元, d_1表示1天VaR, d_5表示5天VaR"
    }
