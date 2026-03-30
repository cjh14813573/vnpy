"""算法交易路由"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user
from bridge import bridge

router = APIRouter(prefix="/api/algo", tags=["algo"], dependencies=[Depends(get_current_user)])


class StartAlgoRequest(BaseModel):
    template_name: str
    vt_symbol: str
    direction: str
    offset: str
    price: float
    volume: float
    setting: Optional[dict] = {}


@router.get("/templates")
async def get_algo_templates():
    """获取算法模板列表"""
    try:
        return bridge.get_algo_templates()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/{name}")
async def get_algo_template(name: str):
    """获取算法模板详情"""
    try:
        template = bridge.get_algo_template(name)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def get_algo_list():
    """获取运行中的算法列表"""
    try:
        return bridge.get_algo_list()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start")
async def start_algo(req: StartAlgoRequest):
    """启动算法"""
    try:
        algo_name = bridge.start_algo(
            template_name=req.template_name,
            vt_symbol=req.vt_symbol,
            direction=req.direction,
            offset=req.offset,
            price=req.price,
            volume=req.volume,
            setting=req.setting,
        )
        return {"success": True, "algo_name": algo_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{algo_name}/stop")
async def stop_algo(algo_name: str):
    """停止算法"""
    try:
        bridge.stop_algo(algo_name)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop-all")
async def stop_all_algos():
    """停止所有算法"""
    try:
        bridge.stop_all_algos()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{algo_name}/pause")
async def pause_algo(algo_name: str):
    """暂停算法"""
    try:
        bridge.pause_algo(algo_name)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{algo_name}/resume")
async def resume_algo(algo_name: str):
    """恢复算法"""
    try:
        bridge.resume_algo(algo_name)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
