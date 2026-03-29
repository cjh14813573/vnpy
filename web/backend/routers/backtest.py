"""回测引擎路由"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from bridge import bridge
from schemas import BacktestRunRequest, BacktestOptimizeRequest, DownloadRequest

router = APIRouter(prefix="/api/backtest", tags=["backtest"], dependencies=[Depends(get_current_user)])


@router.get("/classes")
async def get_backtest_classes():
    """获取可用于回测的策略类"""
    return bridge.get_all_strategy_class_names()


@router.get("/classes/{name}/setting")
async def get_backtest_class_setting(name: str):
    """获取策略类默认参数"""
    try:
        return bridge.get_strategy_class_parameters(name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/run")
async def run_backtest(req: BacktestRunRequest):
    """执行回测（暂未接入 CtaBacktesterEngine，需后续实现）"""
    raise HTTPException(status_code=501, detail="回测引擎集成中，请使用 vnpy 桌面客户端")


@router.post("/optimize")
async def optimize(req: BacktestOptimizeRequest):
    """参数优化（暂未接入）"""
    raise HTTPException(status_code=501, detail="参数优化引擎集成中")


@router.post("/download")
async def download_data(req: DownloadRequest):
    """下载历史数据（暂未接入）"""
    raise HTTPException(status_code=501, detail="数据下载引擎集成中")


@router.get("/result")
async def get_result():
    """获取回测统计结果"""
    raise HTTPException(status_code=501, detail="回测引擎集成中")


@router.get("/result/daily")
async def get_daily_results():
    """获取每日收益"""
    raise HTTPException(status_code=501, detail="回测引擎集成中")


@router.get("/result/trades")
async def get_result_trades():
    """获取回测交易记录"""
    raise HTTPException(status_code=501, detail="回测引擎集成中")


@router.get("/result/orders")
async def get_result_orders():
    """获取回测委托记录"""
    raise HTTPException(status_code=501, detail="回测引擎集成中")


@router.get("/result/chart")
async def get_result_chart():
    """获取回测图表数据"""
    raise HTTPException(status_code=501, detail="回测引擎集成中")
