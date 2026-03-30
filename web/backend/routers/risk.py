"""风控管理路由"""

from fastapi import APIRouter, Depends, HTTPException
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
