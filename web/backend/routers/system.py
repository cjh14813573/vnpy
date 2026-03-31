"""系统管理路由"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
from auth import get_current_user
from bridge import bridge

router = APIRouter(prefix="/api/system", tags=["system"], dependencies=[Depends(get_current_user)])


@router.get("/status")
async def get_system_status():
    """系统状态汇总"""
    return {
        "gateways": bridge.get_all_gateway_names(),
        "connections": len(bridge.get_all_gateway_names()),
        "positions_count": len(bridge.get_all_positions()),
        "orders_count": len(bridge.get_all_active_orders()),
    }


@router.get("/gateways")
async def get_gateways():
    """获取所有网关名称"""
    return bridge.get_all_gateway_names()


@router.get("/gateways/{name}/setting")
async def get_gateway_setting(name: str):
    """获取网关默认配置"""
    try:
        return bridge.get_default_setting(name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/gateways/connect")
async def connect_gateway(body: dict):
    """连接网关"""
    gateway_name = body.get("gateway_name")
    setting = body.get("setting", {})
    if not gateway_name:
        raise HTTPException(status_code=400, detail="缺少 gateway_name")
    try:
        bridge.connect(setting, gateway_name)
        return {"message": f"正在连接 {gateway_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/apps")
async def get_apps():
    """获取所有应用"""
    return bridge.get_all_apps()


@router.get("/exchanges")
async def get_exchanges():
    """获取所有交易所"""
    return bridge.get_all_exchanges()


@router.get("/logs")
async def get_logs(
    level: Optional[str] = Query(None, description="日志级别过滤: DEBUG, INFO, WARNING, ERROR"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    source: Optional[str] = Query(None, description="日志来源过滤"),
    start_time: Optional[str] = Query(None, description="开始时间 (ISO格式)"),
    end_time: Optional[str] = Query(None, description="结束时间 (ISO格式)"),
    limit: int = Query(100, ge=1, le=500, description="返回条数限制"),
):
    """获取系统日志（支持筛选）"""
    logs = bridge.get_logs()

    # 级别筛选
    if level:
        level_upper = level.upper()
        logs = [log for log in logs if log.get("level", "").upper() == level_upper]

    # 关键词搜索
    if keyword:
        logs = [log for log in logs if keyword.lower() in log.get("msg", "").lower()]

    # 来源筛选
    if source:
        logs = [log for log in logs if source.lower() in log.get("gateway_name", "").lower()]

    # 时间范围筛选
    if start_time or end_time:
        filtered_logs = []
        for log in logs:
            log_time = log.get("time")
            if not log_time:
                continue
            try:
                # 解析日志时间
                if start_time and log_time < start_time:
                    continue
                if end_time and log_time > end_time:
                    continue
                filtered_logs.append(log)
            except Exception:
                continue
        logs = filtered_logs

    # 限制返回条数
    logs = logs[-limit:] if logs else []

    return {"data": logs, "total": len(logs)}
