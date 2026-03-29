"""风控管理路由"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user

router = APIRouter(prefix="/api/risk", tags=["risk"], dependencies=[Depends(get_current_user)])


@router.get("/rules")
async def get_rules():
    """获取所有风控规则"""
    raise HTTPException(status_code=501, detail="风控引擎集成中")


@router.get("/rules/{name}")
async def get_rule(name: str):
    """获取规则详情"""
    raise HTTPException(status_code=501, detail="风控引擎集成中")


@router.put("/rules/{name}")
async def update_rule(name: str, body: dict):
    """更新规则"""
    raise HTTPException(status_code=501, detail="风控引擎集成中")
