"""行情数据路由"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from bridge import bridge
from schemas import SubscribeRequest, HistoryQueryRequest

router = APIRouter(prefix="/api/market", tags=["market"], dependencies=[Depends(get_current_user)])


@router.get("/contracts")
async def get_contracts():
    """获取所有合约"""
    return bridge.get_all_contracts()


@router.get("/contracts/{vt_symbol:path}")
async def get_contract(vt_symbol: str):
    """获取单个合约"""
    contract = bridge.get_contract(vt_symbol)
    if contract is None:
        raise HTTPException(status_code=404, detail=f"合约 {vt_symbol} 不存在")
    return contract


@router.get("/ticks")
async def get_all_ticks():
    """获取所有最新行情"""
    return bridge.get_all_ticks()


@router.get("/ticks/{vt_symbol:path}")
async def get_tick(vt_symbol: str):
    """获取单个合约最新行情"""
    tick = bridge.get_tick(vt_symbol)
    if tick is None:
        raise HTTPException(status_code=404, detail=f"行情 {vt_symbol} 未订阅")
    return tick


@router.post("/subscribe")
async def subscribe(req: SubscribeRequest):
    """订阅行情"""
    result = bridge.subscribe(req.vt_symbol, req.gateway_name)
    return {"success": result}


@router.post("/history")
async def query_history(req: HistoryQueryRequest):
    """查询历史K线"""
    try:
        data = bridge.query_history(
            vt_symbol=req.vt_symbol,
            start=req.start,
            end=req.end,
            interval=req.interval,
            gateway_name=req.gateway_name,
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
