"""行情数据路由"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from auth import get_current_user
from bridge import bridge
from schemas import SubscribeRequest, HistoryQueryRequest, PaginationParams, FilterParams, PaginatedListResponse
from utils import filter_and_paginate

router = APIRouter(prefix="/api/market", tags=["market"], dependencies=[Depends(get_current_user)])


@router.get("/contracts", response_model=PaginatedListResponse)
async def get_contracts(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query(None, description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    exchange: Optional[str] = Query(None, description="交易所过滤"),
):
    """获取所有合约（支持分页和过滤）"""
    pagination_params = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    filter_params = FilterParams(
        keyword=keyword, exchange=exchange
    )

    contracts = bridge.get_all_contracts()
    return filter_and_paginate(
        contracts,
        pagination_params,
        filter_params,
        keyword_fields=["symbol", "name", "vt_symbol"]
    )


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
