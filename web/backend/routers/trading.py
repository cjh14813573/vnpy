"""交易下单路由"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
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


# ============ 交易增强功能 ============

# 内存存储条件单（实际应该使用数据库）
_conditional_orders: dict[str, dict] = {}


@router.post("/cancel-all")
async def cancel_all_orders(
    gateway_name: Optional[str] = Query(None, description="指定网关，不传则取消所有"),
    request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """一键全撤 - 取消所有活动委托"""
    ip, ua = get_client_info(request)
    username = current_user["username"]

    try:
        if gateway_name:
            count = bridge.cancel_all_orders_for_gateway(gateway_name)
        else:
            count = bridge.cancel_all_orders()

        operation_log.log(
            username=username,
            operation=OperationType.ORDER_CANCEL,
            target_type="order",
            target_id="all",
            details=json.dumps({"gateway_name": gateway_name, "count": count}),
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

        return {"message": f"已取消 {count} 个委托", "count": count}
    except Exception as e:
        operation_log.log(
            username=username,
            operation=OperationType.ORDER_CANCEL,
            target_type="order",
            target_id="all",
            details=json.dumps({"gateway_name": gateway_name, "error": str(e)}),
            ip_address=ip,
            user_agent=ua,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))


class BatchOrderRequest(BaseModel):
    orders: list[OrderSendRequest]


@router.post("/batch")
async def send_batch_orders(
    req: BatchOrderRequest,
    request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """批量下单"""
    ip, ua = get_client_info(request)
    username = current_user["username"]

    results = []
    success_count = 0

    for order_req in req.orders:
        try:
            vt_orderid = bridge.send_order(order_req.model_dump())
            results.append({"status": "success", "vt_orderid": vt_orderid})
            success_count += 1
        except Exception as e:
            results.append({"status": "error", "error": str(e)})

    operation_log.log(
        username=username,
        operation=OperationType.ORDER_SEND,
        target_type="order",
        target_id="batch",
        details=json.dumps({"total": len(req.orders), "success": success_count}),
        ip_address=ip,
        user_agent=ua,
        success=success_count == len(req.orders),
    )

    return {
        "message": f"批量下单完成: {success_count}/{len(req.orders)} 成功",
        "total": len(req.orders),
        "success_count": success_count,
        "results": results
    }


class ConditionalOrderRequest(BaseModel):
    symbol: str
    exchange: str
    direction: str
    type: str
    volume: float
    price: float
    offset: str
    gateway_name: str
    trigger_type: str  # price_above, price_below, time
    trigger_price: Optional[float] = None
    trigger_time: Optional[str] = None
    reference: Optional[str] = ""


@router.post("/conditional")
async def create_conditional_order(
    req: ConditionalOrderRequest,
    request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """创建条件单"""
    import uuid

    ip, ua = get_client_info(request)
    username = current_user["username"]

    order_id = f"COND-{uuid.uuid4().hex[:12].upper()}"

    conditional_order = {
        "id": order_id,
        "symbol": req.symbol,
        "exchange": req.exchange,
        "direction": req.direction,
        "type": req.type,
        "volume": req.volume,
        "price": req.price,
        "offset": req.offset,
        "gateway_name": req.gateway_name,
        "trigger_type": req.trigger_type,
        "trigger_price": req.trigger_price,
        "trigger_time": req.trigger_time,
        "reference": req.reference,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "created_by": username,
    }

    _conditional_orders[order_id] = conditional_order

    operation_log.log(
        username=username,
        operation=OperationType.ORDER_SEND,
        target_type="conditional_order",
        target_id=order_id,
        details=json.dumps(conditional_order),
        ip_address=ip,
        user_agent=ua,
        success=True,
    )

    return {"id": order_id, "message": "条件单创建成功", "order": conditional_order}


@router.get("/conditional")
async def get_conditional_orders(
    status: Optional[str] = Query(None, description="筛选状态: pending, triggered, cancelled")
):
    """获取条件单列表"""
    orders = list(_conditional_orders.values())
    if status:
        orders = [o for o in orders if o["status"] == status]
    return orders[::-1]  # 最新在前


@router.post("/conditional/{order_id}/cancel")
async def cancel_conditional_order(
    order_id: str,
    request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """取消条件单"""
    ip, ua = get_client_info(request)
    username = current_user["username"]

    if order_id not in _conditional_orders:
        raise HTTPException(status_code=404, detail="条件单不存在")

    order = _conditional_orders[order_id]
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="只能取消待触发的条件单")

    order["status"] = "cancelled"
    order["cancelled_at"] = datetime.now().isoformat()

    operation_log.log(
        username=username,
        operation=OperationType.ORDER_CANCEL,
        target_type="conditional_order",
        target_id=order_id,
        details=json.dumps({"order_id": order_id}),
        ip_address=ip,
        user_agent=ua,
        success=True,
    )

    return {"message": "条件单已取消"}


@router.post("/conditional/cancel-all")
async def cancel_all_conditional_orders(
    request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """取消所有待触发的条件单"""
    ip, ua = get_client_info(request)
    username = current_user["username"]

    count = 0
    for order in _conditional_orders.values():
        if order["status"] == "pending":
            order["status"] = "cancelled"
            order["cancelled_at"] = datetime.now().isoformat()
            count += 1

    operation_log.log(
        username=username,
        operation=OperationType.ORDER_CANCEL,
        target_type="conditional_order",
        target_id="all",
        details=json.dumps({"count": count}),
        ip_address=ip,
        user_agent=ua,
        success=True,
    )

    return {"message": f"已取消 {count} 个条件单", "count": count}
