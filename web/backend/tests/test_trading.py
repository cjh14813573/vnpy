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
        """获取所有委托"""
        resp = client.get("/api/trading/orders", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_active_orders(self, client, auth_headers):
        """获取活跃委托"""
        resp = client.get("/api/trading/orders/active", headers=auth_headers)
        assert resp.status_code == 200


class TestTrades:
    """成交查询测试"""

    def test_get_trades(self, client, auth_headers):
        """获取所有成交"""
        resp = client.get("/api/trading/trades", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestPositions:
    """持仓查询测试"""

    def test_get_positions(self, client, auth_headers):
        """获取所有持仓"""
        resp = client.get("/api/trading/positions", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestAccounts:
    """账户查询测试"""

    def test_get_accounts(self, client, auth_headers):
        """获取所有账户"""
        resp = client.get("/api/trading/accounts", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["balance"] == 1000000
        assert data[0]["accountid"] == "001"
