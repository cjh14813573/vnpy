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
    product: Optional[str] = Query(None, description="产品类型过滤"),
):
    """获取所有合约（支持分页和过滤）"""
    pagination_params = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    filter_params = FilterParams(
        keyword=keyword, exchange=exchange, product=product
    )

    contracts = bridge.get_all_contracts()

    # 产品类型过滤
    if product:
        contracts = [c for c in contracts if c.get("product") == product]

    return filter_and_paginate(
        contracts,
        pagination_params,
        filter_params,
        keyword_fields=["symbol", "name", "vt_symbol"]
    )


@router.get("/contracts/search")
async def search_contracts(
    keyword: str = Query("", description="搜索关键词"),
    exchange: Optional[str] = Query(None, description="交易所过滤"),
    product: Optional[str] = Query(None, description="产品类型过滤"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制"),
):
    """快速搜索合约（用于搜索框）"""
    contracts = bridge.get_all_contracts()

    # 关键词过滤
    if keyword:
        keyword_lower = keyword.lower()
        contracts = [
            c for c in contracts
            if keyword_lower in c.get("symbol", "").lower()
            or keyword_lower in c.get("name", "").lower()
            or keyword_lower in c.get("vt_symbol", "").lower()
        ]

    # 交易所过滤
    if exchange:
        contracts = [c for c in contracts if c.get("exchange") == exchange]

    # 产品类型过滤
    if product:
        contracts = [c for c in contracts if c.get("product") == product]

    return {"data": contracts[:limit], "total": len(contracts)}


@router.get("/contracts/{vt_symbol:path}/detail")
async def get_contract_detail(vt_symbol: str):
    """获取合约完整详情"""
    contract = bridge.get_contract(vt_symbol)
    if contract is None:
        raise HTTPException(status_code=404, detail=f"合约 {vt_symbol} 不存在")

    # 扩展合约信息
    detail = {
        **contract,
        "trading_sessions": _get_trading_sessions(contract.get("exchange", "")),
        "margin_rate": _get_margin_rate(contract.get("symbol", "")),
        "delivery_info": _get_delivery_info(contract),
    }

    return detail


def _get_trading_sessions(exchange: str) -> list[dict]:
    """获取交易所交易时段"""
    sessions = {
        "SHFE": [
            {"name": "早盘", "start": "09:00", "end": "10:15"},
            {"name": "休息", "start": "10:15", "end": "10:30"},
            {"name": "午盘", "start": "10:30", "end": "11:30"},
            {"name": "午休", "start": "11:30", "end": "13:30"},
            {"name": "下午", "start": "13:30", "end": "15:00"},
            {"name": "夜盘", "start": "21:00", "end": "02:30"},
        ],
        "DCE": [
            {"name": "早盘", "start": "09:00", "end": "10:15"},
            {"name": "休息", "start": "10:15", "end": "10:30"},
            {"name": "午盘", "start": "10:30", "end": "11:30"},
            {"name": "午休", "start": "11:30", "end": "13:30"},
            {"name": "下午", "start": "13:30", "end": "15:00"},
            {"name": "夜盘", "start": "21:00", "end": "23:00"},
        ],
        "CFFEX": [
            {"name": "早盘", "start": "09:30", "end": "11:30"},
            {"name": "下午", "start": "13:00", "end": "15:00"},
        ],
    }
    return sessions.get(exchange, [])


def _get_margin_rate(symbol: str) -> dict:
    """获取保证金率（示例）"""
    # 实际应从数据库或配置获取
    return {
        "long_margin_rate": 0.12,
        "short_margin_rate": 0.12,
        "min_margin": 0,
    }


def _get_delivery_info(contract: dict) -> dict:
    """获取交割信息"""
    product = contract.get("product", "")
    if product == "期权":
        return {
            "option_expiry": contract.get("option_expiry"),
            "option_strike": contract.get("option_strike"),
            "option_type": contract.get("option_type"),
        }
    return {
        "delivery_month": contract.get("symbol", "")[-2:] if contract.get("symbol") else "",
        "delivery_type": "实物交割" if product in ["期货", "商品期货"] else "现金交割",
    }


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


@router.get("/products")
async def get_products():
    """获取所有产品类型"""
    contracts = bridge.get_all_contracts()
    products = set(c.get("product", "") for c in contracts if c.get("product"))
    return {"data": sorted(list(products))}
