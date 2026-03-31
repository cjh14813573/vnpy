"""策略编辑器路由"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_current_user
from bridge import bridge

router = APIRouter(prefix="/api/editor", tags=["editor"], dependencies=[Depends(get_current_user)])


class SaveStrategyRequest(BaseModel):
    class_name: str
    content: str


@router.get("/templates")
async def get_strategy_templates():
    """获取策略模板列表"""
    try:
        return bridge.get_strategy_templates()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/strategy/{class_name}")
async def get_strategy_code(class_name: str):
    """获取策略源码"""
    try:
        code = bridge.get_strategy_source(class_name)
        if not code:
            raise HTTPException(status_code=404, detail=f"策略 {class_name} 不存在")
        return {"class_name": class_name, "code": code}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/strategy/{class_name}/save")
async def save_strategy_code(class_name: str, req: SaveStrategyRequest):
    """保存策略源码"""
    try:
        bridge.save_strategy_source(class_name, req.content)
        return {"success": True, "message": f"策略 {class_name} 已保存"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/strategy/{class_name}/run-backtest")
async def run_strategy_backtest(
    class_name: str,
    body: dict
):
    """在编辑器内运行回测"""
    try:
        from services.backtest_runner import backtest_runner

        params = {
            "class_name": class_name,
            "vt_symbol": body.get("vt_symbol", "rb2410.SHFE"),
            "interval": body.get("interval", "1m"),
            "start": body.get("start", "2024-01-01"),
            "end": body.get("end", "2024-06-30"),
            "rate": body.get("rate", 0.0001),
            "slippage": body.get("slippage", 0),
            "size": body.get("size", 1),
            "pricetick": body.get("pricetick", 1),
            "capital": body.get("capital", 1000000),
            "setting": body.get("setting", {}),
        }

        task_id = backtest_runner.create_task("backtest", params)
        started = backtest_runner.start_task(task_id)

        return {
            "task_id": task_id,
            "status": "running" if started else "pending",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
