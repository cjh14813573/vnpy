"""CTA 策略管理路由"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from bridge import bridge
from schemas import StrategyAddRequest, StrategyEditRequest

router = APIRouter(prefix="/api/strategy", tags=["strategy"], dependencies=[Depends(get_current_user)])


@router.get("/classes")
async def get_classes():
    """获取所有策略类名"""
    return bridge.get_all_strategy_class_names()


@router.get("/classes/{name}/params")
async def get_class_params(name: str):
    """获取策略类参数模板"""
    try:
        return bridge.get_strategy_class_parameters(name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/classes/{name}/code")
async def get_class_code(name: str):
    """获取策略类源码"""
    try:
        return {"code": bridge.get_strategy_class_file(name)}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/instances")
async def get_instances():
    """获取所有策略实例"""
    return bridge.get_strategy_infolist()


@router.get("/instances/{name}")
async def get_instance(name: str):
    """获取策略实例详情"""
    infos = bridge.get_strategy_infolist()
    for info in infos:
        if info["strategy_name"] == name:
            return info
    raise HTTPException(status_code=404, detail=f"策略 {name} 不存在")


@router.post("/instances")
async def add_strategy(req: StrategyAddRequest):
    """添加策略实例"""
    try:
        bridge.add_strategy(req.class_name, req.strategy_name, req.vt_symbol, req.setting)
        return {"message": f"策略 {req.strategy_name} 已添加"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/instances/{name}")
async def edit_strategy(name: str, req: StrategyEditRequest):
    """修改策略参数"""
    try:
        bridge.edit_strategy(name, req.setting)
        return {"message": f"策略 {name} 参数已更新"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/instances/{name}")
async def remove_strategy(name: str):
    """删除策略"""
    try:
        bridge.remove_strategy(name)
        return {"message": f"策略 {name} 已删除"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instances/{name}/init")
async def init_strategy(name: str):
    """初始化策略"""
    try:
        bridge.init_strategy(name)
        return {"message": f"策略 {name} 已初始化"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instances/{name}/start")
async def start_strategy(name: str):
    """启动策略"""
    try:
        bridge.start_strategy(name)
        return {"message": f"策略 {name} 已启动"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instances/{name}/stop")
async def stop_strategy(name: str):
    """停止策略"""
    try:
        bridge.stop_strategy(name)
        return {"message": f"策略 {name} 已停止"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instances/init-all")
async def init_all():
    """初始化所有策略"""
    bridge.init_all_strategies()
    return {"message": "所有策略已初始化"}


@router.post("/instances/start-all")
async def start_all():
    """启动所有策略"""
    bridge.start_all_strategies()
    return {"message": "所有策略已启动"}


@router.post("/instances/stop-all")
async def stop_all():
    """停止所有策略"""
    bridge.stop_all_strategies()
    return {"message": "所有策略已停止"}


@router.get("/instances/{name}/variables")
async def get_variables(name: str):
    """获取策略变量"""
    try:
        return bridge.get_strategy_variables(name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/instances/{name}/logs")
async def get_strategy_logs(name: str):
    """获取策略日志"""
    logs = bridge.get_logs()
    # 按策略名过滤
    strategy_logs = [
        l for l in logs
        if name in l.get("msg", "") or name in l.get("gateway_name", "")
    ]
    return strategy_logs[-100:]  # 最近 100 条


@router.get("/instances/{name}/trades")
async def get_strategy_trades(name: str):
    """获取策略成交记录（按 strategy_name 过滤）"""
    all_trades = bridge.get_all_trades()
    # 策略成交通过 reference 字段关联
    strategy_trades = [
        t for t in all_trades
        if name in t.get("vt_orderid", "")
    ]
    return strategy_trades
