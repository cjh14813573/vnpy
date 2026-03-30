"""操作日志路由"""

from fastapi import APIRouter, Depends, Query
from typing import Optional

from auth import get_current_user
from schemas import PaginationParams, FilterParams, PaginatedListResponse
from services.operation_log import operation_log, OperationType
from utils import filter_and_paginate

router = APIRouter(prefix="/api/logs", tags=["logs"], dependencies=[Depends(get_current_user)])


@router.get("/operations", response_model=PaginatedListResponse)
async def get_operation_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
    username: Optional[str] = Query(None, description="按用户过滤"),
    operation: Optional[str] = Query(None, description="按操作类型过滤"),
    target_type: Optional[str] = Query(None, description="按目标类型过滤"),
    start_date: Optional[str] = Query(None, description="开始日期(ISO格式)"),
    end_date: Optional[str] = Query(None, description="结束日期(ISO格式)"),
    current_user: dict = Depends(get_current_user),
):
    """查询操作日志

    - 普通用户只能查看自己的日志
    - admin 可以查看所有日志
    """
    is_admin = current_user.get("role") == "admin"
    query_username = None if is_admin else current_user["username"]

    # 如果指定了用户名但非 admin，只能查自己
    if username and not is_admin and username != current_user["username"]:
        username = current_user["username"]

    # 时间转换
    import time
    from datetime import datetime
    start_time = None
    end_time = None
    if start_date:
        start_time = datetime.fromisoformat(start_date).timestamp()
    if end_date:
        end_time = datetime.fromisoformat(end_date).timestamp()

    # 查询总数
    total = operation_log.count(
        username=query_username or username,
        operation=operation,
        target_type=target_type,
        start_time=start_time,
        end_time=end_time,
    )

    # 查询数据
    logs = operation_log.query(
        username=query_username or username,
        operation=operation,
        target_type=target_type,
        start_time=start_time,
        end_time=end_time,
        limit=page_size,
        offset=(page - 1) * page_size,
    )

    # 构建分页响应
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    from schemas import PaginationResponse

    return {
        "data": logs,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
    }


@router.get("/operations/stats")
async def get_operation_stats(
    days: int = Query(7, ge=1, le=90, description="统计天数"),
    current_user: dict = Depends(get_current_user),
):
    """获取操作统计

    - 普通用户只能看自己的统计
    - admin 可以看全局统计
    """
    is_admin = current_user.get("role") == "admin"
    stats = operation_log.get_stats(days=days)

    if not is_admin:
        # 过滤只保留当前用户的数据
        username = current_user["username"]
        user_ops = operation_log.query(
            username=username,
            limit=10000,  # 足够大
        )

        # 重新计算统计
        from collections import Counter
        op_counter = Counter(log["operation"] for log in user_ops)

        stats = {
            "total_operations": len(user_ops),
            "by_operation": dict(op_counter),
            "by_user": {username: len(user_ops)},
            "failures": sum(1 for log in user_ops if not log["success"]),
            "days": days,
        }

    return stats


@router.get("/operations/types")
async def get_operation_types():
    """获取所有操作类型"""
    return {
        "types": [
            {"value": op.value, "label": op.name}
            for op in OperationType
        ]
    }


@router.delete("/operations/cleanup", dependencies=[Depends(get_current_user)])
async def cleanup_old_logs(
    max_age_days: int = Query(30, ge=1, le=365, description="保留天数"),
    current_user: dict = Depends(get_current_user),
):
    """清理旧日志（仅 admin）"""
    is_admin = current_user.get("role") == "admin"
    if not is_admin:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅 admin 可清理日志"
        )

    deleted = operation_log.cleanup(max_age_days)
    return {"deleted": deleted, "max_age_days": max_age_days}
