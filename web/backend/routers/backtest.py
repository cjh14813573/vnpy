"""回测引擎路由（异步任务版）"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from auth import get_current_user
from bridge import bridge
from services.backtest_runner import backtest_runner

router = APIRouter(prefix="/api/backtest", tags=["backtest"], dependencies=[Depends(get_current_user)])


# ============ 请求模型 ============

class BacktestRunRequest(BaseModel):
    class_name: str
    vt_symbol: str
    interval: str = "1m"
    start: str
    end: str
    rate: float = 0.0
    slippage: float = 0.0
    size: int = 1
    pricetick: float = 0.01
    capital: float = 100000.0
    setting: dict = {}


class BacktestOptimizeRequest(BaseModel):
    class_name: str
    vt_symbol: str
    interval: str = "1m"
    start: str
    end: str
    rate: float = 0.0
    slippage: float = 0.0
    size: int = 1
    pricetick: float = 0.01
    capital: float = 100000.0
    optimization_setting: dict = {}
    use_ga: bool = False
    max_workers: int = 4


class DownloadRequest(BaseModel):
    vt_symbol: str
    interval: str
    start: str
    end: str


# ============ 策略类管理 ============

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


# ============ 回测任务管理 ============

@router.post("/tasks")
async def create_backtest_task(req: BacktestRunRequest):
    """创建回测任务

    异步执行回测，立即返回 task_id，通过 WebSocket 或轮询获取进度
    """
    params = {
        "class_name": req.class_name,
        "vt_symbol": req.vt_symbol,
        "interval": req.interval,
        "start": req.start,
        "end": req.end,
        "rate": req.rate,
        "slippage": req.slippage,
        "size": req.size,
        "pricetick": req.pricetick,
        "capital": req.capital,
        "setting": req.setting,
    }

    task_id = backtest_runner.create_task("backtest", params)

    # 尝试立即启动
    started = backtest_runner.start_task(task_id)

    return {
        "task_id": task_id,
        "status": "running" if started else "pending",
        "message": "回测任务已创建" if started else "回测任务已创建（等待资源）"
    }


@router.get("/tasks")
async def get_tasks(
    status: str = Query(None, description="按状态过滤: pending/running/completed/failed/cancelled"),
    task_type: str = Query(None, description="按类型过滤: backtest/optimize/download"),
    limit: int = Query(50, ge=1, le=100)
):
    """获取回测任务列表"""
    tasks = backtest_runner.get_all_tasks(status=status, task_type=task_type, limit=limit)
    return {
        "tasks": tasks,
        "total": len(tasks)
    }


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """获取任务详情和进度"""
    task = backtest_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    return task


@router.delete("/tasks/{task_id}")
async def cancel_task(task_id: str):
    """取消回测任务"""
    success = backtest_runner.cancel_task(task_id)
    if not success:
        task = backtest_runner.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
        raise HTTPException(status_code=400, detail="任务已完成或无法取消")

    return {"message": f"任务 {task_id} 已取消"}


# ============ 回测结果查询 ============

@router.get("/tasks/{task_id}/result")
async def get_task_result(task_id: str):
    """获取回测结果"""
    task = backtest_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")

    if task["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"任务状态为 {task['status']}，无法获取结果"
        )

    return {
        "task_id": task_id,
        "result": task.get("result"),
        "params": task.get("params")
    }


@router.get("/tasks/{task_id}/daily")
async def get_task_daily_results(task_id: str):
    """获取每日收益（模拟数据）"""
    task = backtest_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")

    # 模拟每日收益数据
    import random
    daily_results = [
        {
            "date": f"2024-01-{i+1:02d}",
            "close_price": 100 + i * 0.5 + random.uniform(-2, 2),
            "net_pnl": random.uniform(-1000, 2000),
            "commission": random.uniform(0, 100),
            "slippage": random.uniform(0, 50),
            "trading_pnl": random.uniform(-1000, 2000),
            "holding_pnl": random.uniform(-500, 500),
            "total_pnl": random.uniform(-1000, 2000),
        }
        for i in range(30)
    ]

    return {"daily_results": daily_results}


@router.get("/tasks/{task_id}/trades")
async def get_task_trades(task_id: str):
    """获取回测交易记录（模拟数据）"""
    task = backtest_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")

    # 模拟交易记录
    import random
    trades = [
        {
            "tradeid": f"BT{task_id[-6:]}_{i:04d}",
            "datetime": f"2024-01-{(i % 30) + 1:02d} 09:{30 + (i % 30):02d}:00",
            "direction": "多" if i % 2 == 0 else "空",
            "offset": "开" if i % 3 == 0 else "平",
            "price": round(100 + random.uniform(-5, 5), 2),
            "volume": random.randint(1, 5),
            "pnl": round(random.uniform(-500, 1000), 2),
        }
        for i in range(20)
    ]

    return {"trades": trades, "total": len(trades)}


@router.get("/tasks/{task_id}/orders")
async def get_task_orders(task_id: str):
    """获取回测委托记录（模拟数据）"""
    task = backtest_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")

    # 模拟委托记录
    import random
    orders = [
        {
            "orderid": f"OR{task_id[-6:]}_{i:04d}",
            "datetime": f"2024-01-{(i % 30) + 1:02d} 09:{30 + (i % 30):02d}:00",
            "direction": "多" if i % 2 == 0 else "空",
            "offset": "开" if i % 3 == 0 else "平",
            "type": "限价",
            "price": round(100 + random.uniform(-5, 5), 2),
            "volume": random.randint(1, 5),
            "traded": random.randint(0, 5),
            "status": random.choice(["全部成交", "部分成交", "已撤销"]),
        }
        for i in range(25)
    ]

    return {"orders": orders, "total": len(orders)}


@router.get("/tasks/{task_id}/chart")
async def get_task_chart(task_id: str):
    """获取回测图表数据（资金曲线）"""
    task = backtest_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")

    # 模拟资金曲线
    import random
    capital = 100000.0
    values = []
    for i in range(100):
        capital += random.uniform(-2000, 3000)
        values.append({
            "index": i,
            "date": f"2024-01-{(i % 30) + 1:02d}",
            "capital": round(capital, 2),
            "drawdown": round(random.uniform(0, -5000), 2)
        })

    return {
        "capital_curve": values,
        "initial_capital": 100000.0,
        "final_capital": round(capital, 2)
    }


# ============ 参数优化任务 ============

@router.post("/optimize-tasks")
async def create_optimize_task(req: BacktestOptimizeRequest):
    """创建参数优化任务"""
    params = {
        "class_name": req.class_name,
        "vt_symbol": req.vt_symbol,
        "interval": req.interval,
        "start": req.start,
        "end": req.end,
        "rate": req.rate,
        "slippage": req.slippage,
        "size": req.size,
        "pricetick": req.pricetick,
        "capital": req.capital,
        "optimization_setting": req.optimization_setting,
        "use_ga": req.use_ga,
        "max_workers": req.max_workers,
    }

    task_id = backtest_runner.create_task("optimize", params)
    started = backtest_runner.start_task(task_id)

    return {
        "task_id": task_id,
        "status": "running" if started else "pending",
        "message": "优化任务已创建" if started else "优化任务已创建（等待资源）"
    }


# ============ 数据下载任务 ============

@router.post("/download-tasks")
async def create_download_task(req: DownloadRequest):
    """创建数据下载任务"""
    params = {
        "vt_symbol": req.vt_symbol,
        "interval": req.interval,
        "start": req.start,
        "end": req.end,
    }

    task_id = backtest_runner.create_task("download", params)
    started = backtest_runner.start_task(task_id)

    return {
        "task_id": task_id,
        "status": "running" if started else "pending",
        "message": "下载任务已创建" if started else "下载任务已创建（等待资源）"
    }


# ============ 兼容旧版 API（保留但标记为已弃用） ============

@router.post("/run")
async def run_backtest_deprecated():
    """【已弃用】请使用 POST /tasks"""
    raise HTTPException(
        status_code=410,
        detail="此接口已弃用，请使用 POST /api/backtest/tasks 创建异步任务"
    )


@router.post("/optimize")
async def optimize_deprecated():
    """【已弃用】请使用 POST /optimize-tasks"""
    raise HTTPException(
        status_code=410,
        detail="此接口已弃用，请使用 POST /api/backtest/optimize-tasks 创建异步任务"
    )


@router.post("/download")
async def download_data_deprecated():
    """【已弃用】请使用 POST /download-tasks"""
    raise HTTPException(
        status_code=410,
        detail="此接口已弃用，请使用 POST /api/backtest/download-tasks 创建异步任务"
    )


@router.get("/result")
async def get_result_deprecated():
    """【已弃用】请使用 GET /tasks/{task_id}/result"""
    raise HTTPException(
        status_code=410,
        detail="此接口已弃用，请使用 GET /api/backtest/tasks/{task_id}/result 获取结果"
    )
