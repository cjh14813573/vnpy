"""风控管理路由"""

import time
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from auth import get_current_user
from bridge import bridge

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
