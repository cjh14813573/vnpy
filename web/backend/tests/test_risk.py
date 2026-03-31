"""风控管理路由测试"""

import pytest


class TestRiskRules:
    """风控规则测试"""

    def test_get_rules(self, client, auth_headers):
        """获取所有风控规则"""
        resp = client.get("/api/risk/rules", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_rule_detail(self, client, auth_headers):
        """获取规则详情"""
        resp = client.get("/api/risk/rules/order_flow_limit", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "name" in data
        assert "enabled" in data

    def test_update_rule(self, client, auth_headers):
        """更新风控规则"""
        resp = client.put("/api/risk/rules/order_flow_limit", json={
            "enabled": True,
            "limit": 100
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["limit"] == 100

    def test_update_rule_not_found(self, client, auth_headers):
        """更新不存在的规则"""
        resp = client.put("/api/risk/rules/nonexistent_rule", json={
            "enabled": True
        }, headers=auth_headers)
        assert resp.status_code == 404

    def test_get_risk_events(self, client, auth_headers):
        """获取风控事件"""
        resp = client.get("/api/risk/events", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_risk_status(self, client, auth_headers):
        """获取风控状态"""
        resp = client.get("/api/risk/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "enabled" in data
        assert "total_events" in data
        assert "active_rules" in data
        assert "total_rules" in data

    def test_reset_rules(self, client, auth_headers):
        """重置风控规则"""
        resp = client.post("/api/risk/reset", headers=auth_headers)
        assert resp.status_code == 200
        assert "message" in resp.json()


class TestOrderFlowMonitoring:
    """订单流监控测试"""

    def test_get_order_flow(self, client, auth_headers):
        """获取订单流数据"""
        resp = client.get("/api/risk/order-flow", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_order_flow_with_limit(self, client, auth_headers):
        """获取订单流（带limit参数）"""
        resp = client.get("/api/risk/order-flow?limit=10", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) <= 10

    def test_get_order_flow_with_status_filter(self, client, auth_headers):
        """获取订单流（按状态筛选）"""
        resp = client.get("/api/risk/order-flow?status=passed", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        for item in data:
            assert item["status"] == "passed"

    def test_get_order_flow_stats(self, client, auth_headers):
        """获取订单流统计"""
        resp = client.get("/api/risk/order-flow/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "last_minute" in data
        assert "last_hour" in data
        assert "passed" in data
        assert "blocked" in data
        assert "pending" in data

    def test_check_order_passed(self, client, auth_headers):
        """检查订单（通过风控）"""
        resp = client.post("/api/risk/order-flow/check", json={
            "vt_symbol": "rb2410.SHFE",
            "direction": "多",
            "offset": "开",
            "price": 3800,
            "volume": 1
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "passed" in data
        assert data["passed"] is True
        assert "checked_rules" in data

    def test_check_order_blocked_volume(self, client, auth_headers):
        """检查订单（数量超限被拦截）"""
        resp = client.post("/api/risk/order-flow/check", json={
            "vt_symbol": "rb2410.SHFE",
            "direction": "多",
            "offset": "开",
            "price": 3800,
            "volume": 99999  # 超过限制
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["passed"] is False
        assert "reason" in data
