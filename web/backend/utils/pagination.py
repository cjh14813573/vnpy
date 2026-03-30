"""分页工具模块

提供通用的分页和过滤功能。
"""

from typing import Any, Callable, Optional, TypeVar
from schemas import PaginationParams, FilterParams, PaginationResponse

T = TypeVar("T")


class PaginatedResponse(dict):
    """分页响应包装器"""

    def __init__(self, data: list, pagination: PaginationResponse):
        super().__init__()
        self["data"] = data
        self["pagination"] = pagination.model_dump()


def paginate_list(
    items: list[T],
    params: PaginationParams
) -> tuple[list[T], PaginationResponse]:
    """对列表进行分页

    Args:
        items: 原始数据列表
        params: 分页参数

    Returns:
        (当前页数据, 分页信息)
    """
    total = len(items)

    # 排序
    if params.sort_by and items:
        reverse = params.sort_order == "desc"
        # 获取排序字段，如果不存在则使用第一个字段
        def sort_key(x):
            if isinstance(x, dict):
                return x.get(params.sort_by, "")
            return getattr(x, params.sort_by, "")

        try:
            items = sorted(items, key=sort_key, reverse=reverse)
        except (TypeError, AttributeError):
            # 排序失败时保持原顺序
            pass

    # 计算分页
    total_pages = (total + params.page_size - 1) // params.page_size if total > 0 else 1
    start_idx = (params.page - 1) * params.page_size
    end_idx = start_idx + params.page_size

    # 切片获取当前页数据
    paginated_items = items[start_idx:end_idx]

    pagination_info = PaginationResponse(
        page=params.page,
        page_size=params.page_size,
        total=total,
        total_pages=total_pages
    )

    return paginated_items, pagination_info


def filter_by_keyword(items: list[dict], keyword: Optional[str], fields: list[str]) -> list[dict]:
    """按关键词过滤列表

    Args:
        items: 数据列表
        keyword: 搜索关键词（不区分大小写）
        fields: 要搜索的字段名列表

    Returns:
        过滤后的列表
    """
    if not keyword:
        return items

    keyword_lower = keyword.lower()
    filtered = []

    for item in items:
        for field in fields:
            value = str(item.get(field, "")).lower()
            if keyword_lower in value:
                filtered.append(item)
                break

    return filtered


def filter_and_paginate(
    items: list[dict],
    pagination_params: PaginationParams,
    filter_params: Optional[FilterParams] = None,
    keyword_fields: Optional[list[str]] = None
) -> PaginatedResponse:
    """过滤并分页

    Args:
        items: 原始数据列表
        pagination_params: 分页参数
        filter_params: 过滤参数
        keyword_fields: 关键词搜索的字段列表

    Returns:
        分页响应
    """
    result = items.copy()

    # 应用过滤
    if filter_params:
        # 关键词搜索
        if filter_params.keyword and keyword_fields:
            result = filter_by_keyword(result, filter_params.keyword, keyword_fields)

        # 交易所过滤
        if filter_params.exchange:
            result = [
                item for item in result
                if filter_params.exchange.lower() in str(item.get("exchange", "")).lower()
            ]

        # 状态过滤（精确匹配，不区分大小写）
        if filter_params.status:
            result = [
                item for item in result
                if str(item.get("status", "")).lower() == filter_params.status.lower()
            ]

        # 日期范围过滤（AND 逻辑）
        if filter_params.start_date:
            result = [
                item for item in result
                if str(item.get("datetime", "") or item.get("date", "")) >= filter_params.start_date
            ]

        if filter_params.end_date:
            result = [
                item for item in result
                if str(item.get("datetime", "") or item.get("date", "")) <= filter_params.end_date
            ]

    # 分页
    paginated_items, pagination_info = paginate_list(result, pagination_params)

    return PaginatedResponse(data=paginated_items, pagination=pagination_info)
