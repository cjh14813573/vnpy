"""交易下单路由"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional
from auth import get_current_user
from bridge import bridge
from schemas import OrderSendRequest, OrderCancelRequest, PaginationParams, FilterParams, PaginatedListResponse
from utils import filter_and_paginate
from services.operation_log import operation_log, OperationType
import json

router = APIRouter(prefix="/api/trading", tags=["trading"], dependencies=[Depends(get_current_user)])


def get_client_info(request: Request) -> tuple[str, str]:
    """获取客户端IP和UA"""
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    ua = request.headers.get("User-Agent", "")
    return ip, ua


@router.post("/order")
async def send_order(req: OrderSendRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """下单"""
    ip, ua = get_client_info(request)
    username = current_user["username"]

    try:
        vt_orderid = bridge.send_order(req.model_dump())

        # 记录操作日志
        operation_log.log(
            username=username,
            operation=OperationType.ORDER_SEND,
            target_type="order",
            target_id=vt_orderid,
            details=json.dumps({
                "symbol": req.symbol,
                "exchange": req.exchange,
                "direction": req.direction,
                "type": req.type,
                "volume": req.volume,
                "price": req.price,
                "offset": req.offset,
            }),
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

        return {"vt_orderid": vt_orderid}
    except Exception as e:
        # 记录失败日志
        operation_log.log(
            username=username,
            operation=OperationType.ORDER_SEND,
            target_type="order",
            details=json.dumps({
                "symbol": req.symbol,
                "exchange": req.exchange,
                "error": str(e),
            }),
            ip_address=ip,
            user_agent=ua,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/order/cancel")
async def cancel_order(req: OrderCancelRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """撤单"""
    ip, ua = get_client_info(request)
    username = current_user["username"]

    try:
        bridge.cancel_order(req.vt_orderid, req.gateway_name)

        # 记录操作日志
        operation_log.log(
            username=username,
            operation=OperationType.ORDER_CANCEL,
            target_type="order",
            target_id=req.vt_orderid,
            details=json.dumps({
                "vt_orderid": req.vt_orderid,
                "gateway_name": req.gateway_name,
            }),
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

        return {"message": "撤单请求已发送"}
    except Exception as e:
        # 记录失败日志
        operation_log.log(
            username=username,
            operation=OperationType.ORDER_CANCEL,
            target_type="order",
            target_id=req.vt_orderid,
            details=json.dumps({
                "vt_orderid": req.vt_orderid,
                "error": str(e),
            }),
            ip_address=ip,
            user_agent=ua,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders", response_model=PaginatedListResponse)
async def get_orders(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query(None, description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    exchange: Optional[str] = Query(None, description="交易所过滤"),
    status: Optional[str] = Query(None, description="状态过滤"),
):
    """获取所有委托（支持分页和过滤）"""
    pagination_params = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    filter_params = FilterParams(
        keyword=keyword, exchange=exchange, status=status
    )

    orders = bridge.get_all_orders()
    return filter_and_paginate(
        orders,
        pagination_params,
        filter_params,
        keyword_fields=["symbol", "vt_orderid", "reference"]
    )


@router.get("/orders/active", response_model=PaginatedListResponse)
async def get_active_orders(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query(None, description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    exchange: Optional[str] = Query(None, description="交易所过滤"),
):
    """获取活跃委托（支持分页和过滤）"""
    pagination_params = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    filter_params = FilterParams(
        keyword=keyword, exchange=exchange
    )

    orders = bridge.get_all_active_orders()
    return filter_and_paginate(
        orders,
        pagination_params,
        filter_params,
        keyword_fields=["symbol", "vt_orderid", "reference"]
    )


@router.get("/trades", response_model=PaginatedListResponse)
async def get_trades(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query(None, description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    exchange: Optional[str] = Query(None, description="交易所过滤"),
):
    """获取所有成交（支持分页和过滤）"""
    pagination_params = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    filter_params = FilterParams(
        keyword=keyword, exchange=exchange
    )

    trades = bridge.get_all_trades()
    return filter_and_paginate(
        trades,
        pagination_params,
        filter_params,
        keyword_fields=["symbol", "vt_tradeid", "vt_orderid"]
    )


@router.get("/positions", response_model=PaginatedListResponse)
async def get_positions(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query(None, description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    exchange: Optional[str] = Query(None, description="交易所过滤"),
):
    """获取所有持仓（支持分页和过滤）"""
    pagination_params = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    filter_params = FilterParams(
        keyword=keyword, exchange=exchange
    )

    positions = bridge.get_all_positions()
    return filter_and_paginate(
        positions,
        pagination_params,
        filter_params,
        keyword_fields=["symbol", "vt_symbol"]
    )


@router.get("/accounts", response_model=PaginatedListResponse)
async def get_accounts(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query(None, description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
):
    """获取所有账户（支持分页和过滤）"""
    pagination_params = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    filter_params = FilterParams(
        keyword=keyword
    )

    accounts = bridge.get_all_accounts()
    return filter_and_paginate(
        accounts,
        pagination_params,
        filter_params,
        keyword_fields=["gateway_name", "accountid"]
    )
