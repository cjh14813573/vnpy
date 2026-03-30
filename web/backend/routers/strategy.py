"""CTA 策略管理路由（带锁机制）"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import Optional
import json
from pydantic import BaseModel
from auth import get_current_user
from bridge import bridge
from schemas import StrategyAddRequest, StrategyEditRequest, PaginationParams, FilterParams, PaginatedListResponse
from services.strategy_lock import lock_service
from services.operation_log import operation_log, OperationType
from utils import filter_and_paginate

router = APIRouter(prefix="/api/strategy", tags=["strategy"], dependencies=[Depends(get_current_user)])


def get_client_info(request: Request) -> tuple[str, str]:
    """获取客户端IP和UA"""
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    ua = request.headers.get("User-Agent", "")
    return ip, ua


# ============ 辅助函数 ============

def check_strategy_lock(strategy_name: str, user_id: str, is_admin: bool = False):
    """检查策略锁 - 强制锁模式

    必须先获取锁才能操作策略。如果策略未被锁定或被他人锁定，都抛出异常。
    """
    holder = lock_service.get_lock_holder(strategy_name)

    # 策略未被锁定
    if holder is None:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "message": f"策略 {strategy_name} 未锁定，请先获取锁",
                "holder": None,
                "strategy_name": strategy_name
            }
        )

    # 策略被他人锁定
    if holder != user_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "message": f"策略已被用户 {holder} 锁定",
                "holder": holder,
                "strategy_name": strategy_name
            }
        )


# ============ 策略类管理 ============

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


# ============ 策略锁管理 ============

class LockRequest(BaseModel):
    ttl: int = 300  # 锁过期时间（秒）
    force: bool = False  # 是否强制获取


class LockResponse(BaseModel):
    success: bool
    message: str
    holder: str | None = None
    expires_at: float | None = None


@router.post("/instances/{name}/lock", response_model=LockResponse)
async def acquire_lock(
    name: str,
    req: LockRequest,
    current_user: dict = Depends(get_current_user)
):
    """获取策略锁

    - **ttl**: 锁过期时间（秒），默认300
    - **force**: 是否强制获取（会覆盖他人锁，需admin权限）
    """
    user_id = current_user["username"]
    is_admin = current_user.get("role") == "admin"

    # 如果强制获取但不是admin，拒绝
    if req.force and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="强制获取锁需要admin权限"
        )

    success, message = lock_service.acquire(
        strategy_name=name,
        user_id=user_id,
        ttl=req.ttl,
        force=req.force
    )

    holder = lock_service.get_lock_holder(name)
    lock_info = lock_service.get_all_locks()

    return LockResponse(
        success=success,
        message=message,
        holder=holder,
        expires_at=lock_info.get(name, {}).get("expires_at") if success else None
    )


@router.delete("/instances/{name}/lock", response_model=LockResponse)
async def release_lock(
    name: str,
    current_user: dict = Depends(get_current_user)
):
    """释放策略锁"""
    user_id = current_user["username"]
    is_admin = current_user.get("role") == "admin"

    success, message = lock_service.release(name, user_id, is_admin)

    return LockResponse(
        success=success,
        message=message,
        holder=None if success else lock_service.get_lock_holder(name)
    )


@router.get("/instances/{name}/lock")
async def get_lock_status(name: str):
    """获取策略锁状态"""
    holder = lock_service.get_lock_holder(name)
    all_locks = lock_service.get_all_locks()

    if name in all_locks:
        info = all_locks[name]
        return {
            "locked": True,
            "holder": info["holder"],
            "acquired_at": info["acquired_at"],
            "expires_at": info["expires_at"],
            "remaining": info["remaining"]
        }

    return {"locked": False, "holder": None}


@router.get("/locks")
async def get_all_locks(current_user: dict = Depends(get_current_user)):
    """获取所有锁（admin可看全部，普通用户只能看自己的）"""
    user_id = current_user["username"]
    is_admin = current_user.get("role") == "admin"

    if is_admin:
        locks = lock_service.get_all_locks()
    else:
        locks = lock_service.get_all_locks(user_id=user_id)

    return locks


@router.put("/instances/{name}/lock/extend")
async def extend_lock(
    name: str,
    ttl: int = 300,
    current_user: dict = Depends(get_current_user)
):
    """延长锁的过期时间"""
    user_id = current_user["username"]

    success = lock_service.extend_lock(name, user_id, ttl)

    if not success:
        holder = lock_service.get_lock_holder(name)
        if holder is None:
            raise HTTPException(status_code=404, detail="锁已过期或不存在")
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"无权续期，锁持有者为 {holder}"
            )

    return {"success": True, "message": "锁已续期", "ttl": ttl}


# ============ 策略实例管理（带锁检查） ============

@router.get("/instances", response_model=PaginatedListResponse)
async def get_instances(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query(None, description="排序字段"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="排序方向"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    status: Optional[str] = Query(None, description="状态过滤"),
):
    """获取所有策略实例（支持分页和过滤）"""
    pagination_params = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    filter_params = FilterParams(
        keyword=keyword, status=status
    )

    instances = bridge.get_strategy_infolist()
    return filter_and_paginate(
        instances,
        pagination_params,
        filter_params,
        keyword_fields=["strategy_name", "class_name", "vt_symbol"]
    )


@router.get("/instances/{name}")
async def get_instance(name: str):
    """获取策略实例详情"""
    infos = bridge.get_strategy_infolist()
    for info in infos:
        if info["strategy_name"] == name:
            # 添加锁状态
            info["lock"] = {
                "locked": lock_service.get_lock_holder(name) is not None,
                "holder": lock_service.get_lock_holder(name)
            }
            return info
    raise HTTPException(status_code=404, detail=f"策略 {name} 不存在")


@router.post("/instances")
async def add_strategy(
    req: StrategyAddRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """添加策略实例（不需要锁，因为是新建）"""
    ip, ua = get_client_info(request)
    username = current_user["username"]

    try:
        bridge.add_strategy(req.class_name, req.strategy_name, req.vt_symbol, req.setting)

        # 记录操作日志
        operation_log.log(
            username=username,
            operation=OperationType.STRATEGY_ADD,
            target_type="strategy",
            target_id=req.strategy_name,
            details=json.dumps({
                "class_name": req.class_name,
                "vt_symbol": req.vt_symbol,
                "setting": req.setting,
            }),
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

        return {"message": f"策略 {req.strategy_name} 已添加"}
    except Exception as e:
        # 记录失败日志
        operation_log.log(
            username=username,
            operation=OperationType.STRATEGY_ADD,
            target_type="strategy",
            target_id=req.strategy_name,
            details=json.dumps({
                "class_name": req.class_name,
                "error": str(e),
            }),
            ip_address=ip,
            user_agent=ua,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/instances/{name}")
async def edit_strategy(
    name: str,
    req: StrategyEditRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """修改策略参数（需要锁）"""
    user_id = current_user["username"]
    is_admin = current_user.get("role") == "admin"
    ip, ua = get_client_info(request)

    # 检查锁
    check_strategy_lock(name, user_id, is_admin)

    try:
        bridge.edit_strategy(name, req.setting)

        # 记录操作日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_EDIT,
            target_type="strategy",
            target_id=name,
            details=json.dumps({"setting": req.setting}),
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

        return {"message": f"策略 {name} 参数已更新"}
    except Exception as e:
        # 记录失败日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_EDIT,
            target_type="strategy",
            target_id=name,
            details=json.dumps({"setting": req.setting, "error": str(e)}),
            ip_address=ip,
            user_agent=ua,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/instances/{name}")
async def remove_strategy(
    name: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """删除策略（需要锁）"""
    user_id = current_user["username"]
    is_admin = current_user.get("role") == "admin"
    ip, ua = get_client_info(request)

    # 检查锁
    check_strategy_lock(name, user_id, is_admin)

    try:
        bridge.remove_strategy(name)
        # 清理锁
        lock_service.release(name, user_id, is_admin)

        # 记录操作日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_REMOVE,
            target_type="strategy",
            target_id=name,
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

        return {"message": f"策略 {name} 已删除"}
    except Exception as e:
        # 记录失败日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_REMOVE,
            target_type="strategy",
            target_id=name,
            ip_address=ip,
            user_agent=ua,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instances/{name}/init")
async def init_strategy(
    name: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """初始化策略（需要锁）"""
    user_id = current_user["username"]
    is_admin = current_user.get("role") == "admin"
    ip, ua = get_client_info(request)

    # 检查锁
    check_strategy_lock(name, user_id, is_admin)

    try:
        bridge.init_strategy(name)

        # 记录操作日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_INIT,
            target_type="strategy",
            target_id=name,
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

        return {"message": f"策略 {name} 已初始化"}
    except Exception as e:
        # 记录失败日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_INIT,
            target_type="strategy",
            target_id=name,
            ip_address=ip,
            user_agent=ua,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instances/{name}/start")
async def start_strategy(
    name: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """启动策略（需要锁）"""
    user_id = current_user["username"]
    is_admin = current_user.get("role") == "admin"
    ip, ua = get_client_info(request)

    # 检查锁
    check_strategy_lock(name, user_id, is_admin)

    try:
        bridge.start_strategy(name)

        # 记录操作日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_START,
            target_type="strategy",
            target_id=name,
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

        return {"message": f"策略 {name} 已启动"}
    except Exception as e:
        # 记录失败日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_START,
            target_type="strategy",
            target_id=name,
            ip_address=ip,
            user_agent=ua,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instances/{name}/stop")
async def stop_strategy(
    name: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """停止策略（需要锁）"""
    user_id = current_user["username"]
    is_admin = current_user.get("role") == "admin"
    ip, ua = get_client_info(request)

    # 检查锁
    check_strategy_lock(name, user_id, is_admin)

    try:
        bridge.stop_strategy(name)

        # 记录操作日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_STOP,
            target_type="strategy",
            target_id=name,
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

        return {"message": f"策略 {name} 已停止"}
    except Exception as e:
        # 记录失败日志
        operation_log.log(
            username=user_id,
            operation=OperationType.STRATEGY_STOP,
            target_type="strategy",
            target_id=name,
            ip_address=ip,
            user_agent=ua,
            success=False,
            error_message=str(e),
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instances/init-all")
async def init_all():
    """初始化所有策略（批量操作不需要单个锁）"""
    bridge.init_all_strategies()
    return {"message": "所有策略已初始化"}


@router.post("/instances/start-all")
async def start_all():
    """启动所有策略（批量操作不需要单个锁）"""
    bridge.start_all_strategies()
    return {"message": "所有策略已启动"}


@router.post("/instances/stop-all")
async def stop_all():
    """停止所有策略（批量操作不需要单个锁）"""
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
