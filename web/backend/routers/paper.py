"""模拟盘设置路由"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user

router = APIRouter(prefix="/api/paper", tags=["paper"], dependencies=[Depends(get_current_user)])


@router.get("/setting")
async def get_setting():
    """获取模拟盘配置"""
    raise HTTPException(status_code=501, detail="模拟盘引擎集成中")


@router.put("/setting")
async def update_setting(body: dict):
    """更新模拟盘配置"""
    raise HTTPException(status_code=501, detail="模拟盘引擎集成中")


@router.post("/clear")
async def clear_positions():
    """清空模拟盘持仓"""
    raise HTTPException(status_code=501, detail="模拟盘引擎集成中")
