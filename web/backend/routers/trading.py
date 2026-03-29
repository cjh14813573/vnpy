"""交易下单路由"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from bridge import bridge
from schemas import OrderSendRequest, OrderCancelRequest

router = APIRouter(prefix="/api/trading", tags=["trading"], dependencies=[Depends(get_current_user)])


@router.post("/order")
async def send_order(req: OrderSendRequest):
    """下单"""
    try:
        vt_orderid = bridge.send_order(req.model_dump())
        return {"vt_orderid": vt_orderid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/order/cancel")
async def cancel_order(req: OrderCancelRequest):
    """撤单"""
    try:
        bridge.cancel_order(req.vt_orderid, req.gateway_name)
        return {"message": "撤单请求已发送"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders")
async def get_orders():
    """获取所有委托"""
    return bridge.get_all_orders()


@router.get("/orders/active")
async def get_active_orders():
    """获取活跃委托"""
    return bridge.get_all_active_orders()


@router.get("/trades")
async def get_trades():
    """获取所有成交"""
    return bridge.get_all_trades()


@router.get("/positions")
async def get_positions():
    """获取所有持仓"""
    return bridge.get_all_positions()


@router.get("/accounts")
async def get_accounts():
    """获取所有账户"""
    return bridge.get_all_accounts()
