"""模拟盘设置路由"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from bridge import bridge

router = APIRouter(prefix="/api/paper", tags=["paper"], dependencies=[Depends(get_current_user)])


@router.get("/setting")
async def get_setting():
    """获取模拟盘配置"""
    try:
        return bridge.get_paper_setting()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/setting")
async def update_setting(body: dict):
    """更新模拟盘配置"""
    try:
        bridge.set_paper_setting(
            instant_trade=body.get("instant_trade"),
            trade_slippage=body.get("trade_slippage"),
            timer_interval=body.get("timer_interval"),
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear")
async def clear_positions():
    """清空模拟盘持仓"""
    try:
        bridge.clear_paper_positions()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/positions")
async def get_paper_positions():
    """获取模拟盘持仓"""
    try:
        return bridge.get_paper_positions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
