"""新增 API 测试：auth refresh/logout + strategy logs/trades"""

import pytest


class TestAuthRefresh:
    """刷新 Token 测试"""

    def test_refresh_success(self, client, auth_headers):
        """刷新 Token 成功"""
        resp = client.post("/api/auth/refresh", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["username"] == "admin"

    def test_refresh_unauthenticated(self, client):
        """未认证无法刷新"""
        resp = client.post("/api/auth/refresh")
        assert resp.status_code == 401


class TestAuthLogout:
    """退出登录测试"""

    def test_logout(self, client, auth_headers):
        """退出成功"""
        resp = client.post("/api/auth/logout", headers=auth_headers)
        assert resp.status_code == 200
        assert "已退出" in resp.json()["message"]


class TestStrategyLogs:
    """策略日志测试"""

    def test_get_logs(self, client, auth_headers):
        """获取策略日志"""
        resp = client.get("/api/strategy/instances/atr_rsi_01/logs", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestStrategyTrades:
    """策略成交记录测试"""

    def test_get_trades(self, client, auth_headers):
        """获取策略成交记录"""
        resp = client.get("/api/strategy/instances/atr_rsi_01/trades", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
