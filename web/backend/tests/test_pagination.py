"""分页工具测试

测试分页工具函数的功能。
"""

import pytest
from schemas import PaginationParams, FilterParams
from utils.pagination import paginate_list, filter_by_keyword, filter_and_paginate


class TestPaginateList:
    """列表分页测试"""

    def test_paginate_first_page(self):
        """第一页分页"""
        items = [{"id": i} for i in range(100)]
        params = PaginationParams(page=1, page_size=10)

        paginated, info = paginate_list(items, params)

        assert len(paginated) == 10
        assert info.page == 1
        assert info.page_size == 10
        assert info.total == 100
        assert info.total_pages == 10

    def test_paginate_second_page(self):
        """第二页分页"""
        items = [{"id": i} for i in range(100)]
        params = PaginationParams(page=2, page_size=10)

        paginated, info = paginate_list(items, params)

        assert len(paginated) == 10
        assert paginated[0]["id"] == 10
        assert paginated[9]["id"] == 19

    def test_paginate_last_page(self):
        """最后一页（不足 page_size）"""
        items = [{"id": i} for i in range(95)]
        params = PaginationParams(page=10, page_size=10)

        paginated, info = paginate_list(items, params)

        assert len(paginated) == 5
        assert info.total_pages == 10

    def test_paginate_empty_list(self):
        """空列表分页"""
        items = []
        params = PaginationParams(page=1, page_size=10)

        paginated, info = paginate_list(items, params)

        assert len(paginated) == 0
        assert info.total == 0
        assert info.total_pages == 1  # 空列表至少1页

    def test_paginate_with_sorting(self):
        """分页排序"""
        items = [
            {"name": "C", "value": 3},
            {"name": "A", "value": 1},
            {"name": "B", "value": 2},
        ]
        params = PaginationParams(page=1, page_size=10, sort_by="name", sort_order="asc")

        paginated, info = paginate_list(items, params)

        assert paginated[0]["name"] == "A"
        assert paginated[1]["name"] == "B"
        assert paginated[2]["name"] == "C"

    def test_paginate_desc_sorting(self):
        """降序排序"""
        items = [
            {"name": "A", "value": 1},
            {"name": "B", "value": 2},
            {"name": "C", "value": 3},
        ]
        params = PaginationParams(page=1, page_size=10, sort_by="value", sort_order="desc")

        paginated, info = paginate_list(items, params)

        assert paginated[0]["value"] == 3
        assert paginated[1]["value"] == 2
        assert paginated[2]["value"] == 1


class TestFilterByKeyword:
    """关键词过滤测试"""

    def test_filter_single_field(self):
        """单字段过滤"""
        items = [
            {"symbol": "rb2410", "name": "螺纹钢"},
            {"symbol": "cu2505", "name": "铜"},
            {"symbol": "au2412", "name": "黄金"},
        ]

        result = filter_by_keyword(items, "rb", ["symbol"])

        assert len(result) == 1
        assert result[0]["symbol"] == "rb2410"

    def test_filter_multiple_fields(self):
        """多字段过滤"""
        items = [
            {"symbol": "rb2410", "name": "螺纹钢"},
            {"symbol": "cu2505", "name": "铜"},
            {"symbol": "au2412", "name": "黄金"},
        ]

        result = filter_by_keyword(items, "铜", ["symbol", "name"])

        assert len(result) == 1
        assert result[0]["symbol"] == "cu2505"

    def test_filter_case_insensitive(self):
        """不区分大小写"""
        items = [
            {"symbol": "RB2410", "name": "螺纹钢"},
            {"symbol": "rb2411", "name": "螺纹钢"},
        ]

        result = filter_by_keyword(items, "rb", ["symbol"])

        assert len(result) == 2

    def test_filter_no_match(self):
        """无匹配结果"""
        items = [
            {"symbol": "rb2410", "name": "螺纹钢"},
        ]

        result = filter_by_keyword(items, "xxx", ["symbol"])

        assert len(result) == 0

    def test_filter_empty_keyword(self):
        """空关键词返回全部"""
        items = [
            {"symbol": "rb2410", "name": "螺纹钢"},
            {"symbol": "cu2505", "name": "铜"},
        ]

        result = filter_by_keyword(items, None, ["symbol"])

        assert len(result) == 2


class TestFilterAndPaginate:
    """过滤并分页测试"""

    def test_basic_pagination(self):
        """基本分页功能"""
        items = [{"id": i, "symbol": f"rb{i}"} for i in range(50)]
        pagination_params = PaginationParams(page=1, page_size=10)

        result = filter_and_paginate(items, pagination_params)

        assert len(result["data"]) == 10
        assert result["pagination"]["total"] == 50

    def test_filter_by_exchange(self):
        """按交易所过滤"""
        items = [
            {"symbol": "rb2410", "exchange": "SHFE"},
            {"symbol": "cu2505", "exchange": "SHFE"},
            {"symbol": "IF2406", "exchange": "CFFEX"},
        ]
        pagination_params = PaginationParams(page=1, page_size=10)
        filter_params = FilterParams(exchange="SHFE")

        result = filter_and_paginate(items, pagination_params, filter_params)

        assert len(result["data"]) == 2
        assert all(item["exchange"] == "SHFE" for item in result["data"])

    def test_filter_by_status(self):
        """按状态过滤"""
        items = [
            {"symbol": "rb2410", "status": "active"},
            {"symbol": "cu2505", "status": "inactive"},
        ]
        pagination_params = PaginationParams(page=1, page_size=10)
        filter_params = FilterParams(status="active")

        result = filter_and_paginate(items, pagination_params, filter_params)

        assert len(result["data"]) == 1
        assert result["data"][0]["status"] == "active"

    def test_filter_by_keyword_with_fields(self):
        """关键词搜索指定字段"""
        items = [
            {"symbol": "rb2410", "name": "螺纹钢"},
            {"symbol": "cu2505", "name": "铜"},
        ]
        pagination_params = PaginationParams(page=1, page_size=10)
        filter_params = FilterParams(keyword="rb")

        result = filter_and_paginate(
            items, pagination_params, filter_params, keyword_fields=["symbol"]
        )

        assert len(result["data"]) == 1
        assert result["data"][0]["symbol"] == "rb2410"

    def test_filter_by_date_range(self):
        """按日期范围过滤"""
        items = [
            {"symbol": "rb2410", "datetime": "2024-01-15"},
            {"symbol": "cu2505", "datetime": "2024-02-20"},
            {"symbol": "au2412", "datetime": "2024-03-10"},
        ]
        pagination_params = PaginationParams(page=1, page_size=10)
        filter_params = FilterParams(start_date="2024-01-01", end_date="2024-02-28")

        result = filter_and_paginate(items, pagination_params, filter_params)

        assert len(result["data"]) == 2

    def test_combined_filters(self):
        """组合过滤条件"""
        items = [
            {"symbol": "rb2410", "exchange": "SHFE", "status": "active"},
            {"symbol": "rb2411", "exchange": "SHFE", "status": "inactive"},
            {"symbol": "cu2505", "exchange": "SHFE", "status": "active"},
            {"symbol": "IF2406", "exchange": "CFFEX", "status": "active"},
        ]
        pagination_params = PaginationParams(page=1, page_size=10)
        filter_params = FilterParams(exchange="SHFE", status="active")

        result = filter_and_paginate(items, pagination_params, filter_params)

        assert len(result["data"]) == 2

    def test_empty_result(self):
        """过滤结果为空"""
        items = [
            {"symbol": "rb2410", "exchange": "SHFE"},
        ]
        pagination_params = PaginationParams(page=1, page_size=10)
        filter_params = FilterParams(exchange="CFFEX")

        result = filter_and_paginate(items, pagination_params, filter_params)

        assert len(result["data"]) == 0
        assert result["pagination"]["total"] == 0
        assert result["pagination"]["total_pages"] == 1

    def test_no_params_returns_all(self):
        """无过滤参数返回全部"""
        items = [{"id": i} for i in range(100)]
        pagination_params = PaginationParams(page=1, page_size=50)

        result = filter_and_paginate(items, pagination_params)

        assert len(result["data"]) == 50
        assert result["pagination"]["total"] == 100
