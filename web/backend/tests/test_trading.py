"""交易下单路由测试"""

import pytest


class TestSendOrder:
    """下单测试"""

    def test_send_order_success(self, client, auth_headers):
        """下单成功"""
        resp = client.post("/api/trading/order", json={
            "symbol": "rb2410",
            "exchange": "SHFE",
            "direction": "多",
            "type": "限价",
            "volume": 1,
            "price": 3800,
            "offset": "开",
            "gateway_name": "CTP",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "vt_orderid" in data
        assert data["vt_orderid"] == "CTP.000000001"

    def test_send_order_missing_field(self, client, auth_headers):
        """缺少必填字段"""
        resp = client.post("/api/trading/order", json={
            "symbol": "rb2410",
            "exchange": "SHFE",
        }, headers=auth_headers)
        assert resp.status_code == 422

    def test_send_order_invalid_direction(self, client, auth_headers):
        """无效方向"""
        resp = client.post("/api/trading/order", json={
            "symbol": "rb2410",
            "exchange": "SHFE",
            "direction": "无效",
            "type": "限价",
            "volume": 1,
            "price": 3800,
        }, headers=auth_headers)
        assert resp.status_code == 422


class TestCancelOrder:
    """撤单测试"""

    def test_cancel_order(self, client, auth_headers):
        """撤单"""
        resp = client.post("/api/trading/order/cancel", json={
            "vt_orderid": "CTP.000000001",
            "gateway_name": "CTP",
        }, headers=auth_headers)
        assert resp.status_code == 200


class TestOrders:
    """委托查询测试"""

    def test_get_orders(self, client, auth_headers):
        """获取所有委托（分页格式）"""
        resp = client.get("/api/trading/orders", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "pagination" in data
        assert isinstance(data["data"], list)
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["total_pages"] >= 1

    def test_get_orders_pagination(self, client, auth_headers):
        """委托分页参数"""
        resp = client.get("/api/trading/orders?page=1&page_size=10", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["pagination"]["page_size"] == 10

    def test_get_orders_filter_by_exchange(self, client, auth_headers):
        """委托交易所过滤"""
        resp = client.get("/api/trading/orders?exchange=SHFE", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data

    def test_get_orders_filter_by_keyword(self, client, auth_headers):
        """委托关键词搜索"""
        resp = client.get("/api/trading/orders?keyword=rb", headers=auth_headers)
        assert resp.status_code == 200

    def test_get_active_orders(self, client, auth_headers):
        """获取活跃委托（分页格式）"""
        resp = client.get("/api/trading/orders/active", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "pagination" in data


class TestTrades:
    """成交查询测试"""

    def test_get_trades(self, client, auth_headers):
        """获取所有成交（分页格式）"""
        resp = client.get("/api/trading/trades", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "pagination" in data
        assert isinstance(data["data"], list)

    def test_get_trades_pagination(self, client, auth_headers):
        """成交分页参数"""
        resp = client.get("/api/trading/trades?page=1&page_size=20&sort_by=symbol&sort_order=asc", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["pagination"]["page_size"] == 20


class TestPositions:
    """持仓查询测试"""

    def test_get_positions(self, client, auth_headers):
        """获取所有持仓（分页格式）"""
        resp = client.get("/api/trading/positions", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "pagination" in data
        assert isinstance(data["data"], list)


class TestAccounts:
    """账户查询测试"""

    def test_get_accounts(self, client, auth_headers):
        """获取所有账户（分页格式）"""
        resp = client.get("/api/trading/accounts", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "pagination" in data
        # 检查账户数据
        assert len(data["data"]) >= 1
        assert data["data"][0]["balance"] == 1000000
        assert data["data"][0]["accountid"] == "001"


class TestTradingEnhancements:
    """交易增强功能测试"""

    def test_cancel_all_orders(self, client, auth_headers):
        """一键全撤"""
        resp = client.post("/api/trading/cancel-all", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "count" in data
        assert "已取消" in data["message"]

    def test_cancel_all_orders_with_gateway(self, client, auth_headers):
        """指定网关一键全撤"""
        resp = client.post("/api/trading/cancel-all?gateway_name=CTP", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "count" in data

    def test_batch_orders(self, client, auth_headers):
        """批量下单"""
        orders = [
            {
                "symbol": "rb2410",
                "exchange": "SHFE",
                "direction": "多",
                "type": "限价",
                "volume": 1,
                "price": 3800,
                "offset": "开",
                "gateway_name": "CTP",
            },
            {
                "symbol": "rb2410",
                "exchange": "SHFE",
                "direction": "空",
                "type": "限价",
                "volume": 1,
                "price": 3805,
                "offset": "开",
                "gateway_name": "CTP",
            },
        ]
        resp = client.post("/api/trading/batch", json={"orders": orders}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "success_count" in data
        assert "results" in data
        assert data["total"] == 2

    def test_conditional_order_create(self, client, auth_headers):
        """创建条件单"""
        resp = client.post("/api/trading/conditional", json={
            "symbol": "rb2410",
            "exchange": "SHFE",
            "direction": "多",
            "type": "限价",
            "volume": 1,
            "price": 3800,
            "offset": "开",
            "gateway_name": "CTP",
            "trigger_type": "price_above",
            "trigger_price": 3850,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "order" in data
        assert data["order"]["trigger_type"] == "price_above"

    def test_conditional_order_list(self, client, auth_headers):
        """获取条件单列表"""
        resp = client.get("/api/trading/conditional", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_conditional_order_cancel(self, client, auth_headers):
        """取消条件单"""
        # 先创建条件单
        create_resp = client.post("/api/trading/conditional", json={
            "symbol": "rb2410",
            "exchange": "SHFE",
            "direction": "多",
            "type": "限价",
            "volume": 1,
            "price": 3800,
            "offset": "开",
            "gateway_name": "CTP",
            "trigger_type": "price_below",
            "trigger_price": 3750,
        }, headers=auth_headers)
        order_id = create_resp.json()["id"]

        # 取消条件单
        resp = client.post(f"/api/trading/conditional/{order_id}/cancel", headers=auth_headers)
        assert resp.status_code == 200
        assert "已取消" in resp.json()["message"]

    def test_conditional_order_cancel_all(self, client, auth_headers):
        """取消所有条件单"""
        resp = client.post("/api/trading/conditional/cancel-all", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "count" in data
        assert "已取消" in data["message"]
