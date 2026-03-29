"""系统管理路由"""

from fastapi import APIRouter, Depends, HTTPException
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
async def get_logs():
    """获取系统日志"""
    return bridge.get_logs()
