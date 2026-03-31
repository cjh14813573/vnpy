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
    trigger_type: str  # price_above, price_below, time, stop_loss, take_profit
    trigger_price: Optional[float] = None
    trigger_time: Optional[str] = None
    reference: Optional[str] = ""


class StopLossTakeProfitRequest(BaseModel):
    """止盈止损订单请求"""
    vt_symbol: str
    direction: str  # 持仓方向: 多/空
    volume: float
    stop_loss_price: Optional[float] = None  # 止损价
    take_profit_price: Optional[float] = None  # 止盈价
    gateway_name: str = "CTP"
    account_type: str = "real"  # real/paper


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


# ============ 止盈止损订单 ============
# 内存存储止盈止损订单
_stop_loss_take_profit_orders: dict[str, dict] = {}


def _check_stop_loss_take_profit():
    """检查止盈止损触发条件（应由定时任务调用）"""
    from bridge import bridge

    for order_id, order in _stop_loss_take_profit_orders.items():
        if order["status"] != "pending":
            continue

        # 获取最新价格
        tick = bridge.get_tick(order["vt_symbol"])
        if not tick:
            continue

        last_price = tick.get("last_price", 0)
        direction = order["direction"]  # 持仓方向
        stop_loss = order.get("stop_loss_price")
        take_profit = order.get("take_profit_price")

        triggered = False
        trigger_type = None

        # 多单：跌破止损价或涨破止盈价
        if direction == "多":
            if stop_loss and last_price <= stop_loss:
                triggered = True
                trigger_type = "stop_loss"
            elif take_profit and last_price >= take_profit:
                triggered = True
                trigger_type = "take_profit"
        # 空单：涨破止损价或跌破止盈价
        else:
            if stop_loss and last_price >= stop_loss:
                triggered = True
                trigger_type = "stop_loss"
            elif take_profit and last_price <= take_profit:
                triggered = True
                trigger_type = "take_profit"

        if triggered:
            # 执行平仓
            try:
                parts = order["vt_symbol"].split(".")
                symbol = parts[0]
                exchange = parts[1] if len(parts) > 1 else "SHFE"

                order_req = {
                    "symbol": symbol,
                    "exchange": exchange,
                    "direction": "空" if direction == "多" else "多",  # 反向平仓
                    "type": "市价",
                    "volume": order["volume"],
                    "price": last_price,
                    "offset": "平",
                    "gateway_name": order.get("gateway_name", "CTP"),
                }

                # 模拟盘或实盘
                if order.get("account_type") == "paper":
                    # 使用模拟盘引擎
                    paper = bridge._get_paper_engine()
                    if paper:
                        vt_orderid = paper.send_order(
                            symbol=symbol,
                            exchange=exchange,
                            direction="空" if direction == "多" else "多",
                            type="市价",
                            volume=order["volume"],
                            price=last_price,
                            offset="平",
                        )
                else:
                    vt_orderid = bridge.send_order(order_req)

                order["status"] = "triggered"
                order["triggered_at"] = datetime.now().isoformat()
                order["trigger_type"] = trigger_type
                order["trigger_price"] = last_price
                order["vt_orderid"] = vt_orderid

            except Exception as e:
                order["status"] = "error"
                order["error"] = str(e)


@router.post("/stop-loss-take-profit")
async def create_stop_loss_take_profit(
    req: StopLossTakeProfitRequest,
    request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """创建止盈止损订单"""
    import uuid

    ip, ua = get_client_info(request)
    username = current_user["username"]

    order_id = f"SLTP-{uuid.uuid4().hex[:12].upper()}"

    order = {
        "id": order_id,
        "vt_symbol": req.vt_symbol,
        "direction": req.direction,
        "volume": req.volume,
        "stop_loss_price": req.stop_loss_price,
        "take_profit_price": req.take_profit_price,
        "gateway_name": req.gateway_name,
        "account_type": req.account_type,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "created_by": username,
    }

    _stop_loss_take_profit_orders[order_id] = order

    operation_log.log(
        username=username,
        operation=OperationType.ORDER_SEND,
        target_type="stop_loss_take_profit",
        target_id=order_id,
        details=json.dumps(order),
        ip_address=ip,
        user_agent=ua,
        success=True,
    )

    return {"id": order_id, "message": "止盈止损订单创建成功", "order": order}


@router.get("/stop-loss-take-profit")
async def get_stop_loss_take_profit_orders(
    status: Optional[str] = Query(None, description="筛选状态: pending, triggered, cancelled, error"),
    vt_symbol: Optional[str] = Query(None, description="筛选合约")
):
    """获取止盈止损订单列表"""
    orders = list(_stop_loss_take_profit_orders.values())
    if status:
        orders = [o for o in orders if o["status"] == status]
    if vt_symbol:
        orders = [o for o in orders if o["vt_symbol"] == vt_symbol]
    return orders[::-1]


@router.post("/stop-loss-take-profit/{order_id}/cancel")
async def cancel_stop_loss_take_profit(
    order_id: str,
    request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """取消止盈止损订单"""
    ip, ua = get_client_info(request)
    username = current_user["username"]

    if order_id not in _stop_loss_take_profit_orders:
        raise HTTPException(status_code=404, detail="订单不存在")

    order = _stop_loss_take_profit_orders[order_id]
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="只能取消待触发的订单")

    order["status"] = "cancelled"
    order["cancelled_at"] = datetime.now().isoformat()

    operation_log.log(
        username=username,
        operation=OperationType.ORDER_CANCEL,
        target_type="stop_loss_take_profit",
        target_id=order_id,
        details=json.dumps({"order_id": order_id}),
        ip_address=ip,
        user_agent=ua,
        success=True,
    )

    return {"message": "止盈止损订单已取消"}


@router.post("/stop-loss-take-profit/check")
async def manual_check_stop_loss_take_profit():
    """手动触发止盈止损检查（用于测试）"""
    _check_stop_loss_take_profit()
    return {"message": "检查完成"}
