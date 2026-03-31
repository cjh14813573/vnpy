"""系统管理路由测试"""

import pytest


class TestSystemStatus:
    """系统状态测试"""

    def test_status(self, client, auth_headers):
        """获取系统状态"""
        resp = client.get("/api/system/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "gateways" in data
        assert "connections" in data

    def test_status_unauthenticated(self, client):
        """未认证返回 401"""
        resp = client.get("/api/system/status")
        assert resp.status_code == 401


class TestGateways:
    """网关管理测试"""

    def test_get_gateways(self, client, auth_headers):
        """获取网关列表"""
        resp = client.get("/api/system/gateways", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "CTP" in data
        assert "IB" in data

    def test_get_gateway_setting(self, client, auth_headers):
        """获取网关默认配置"""
        resp = client.get("/api/system/gateways/CTP/setting", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "用户名" in data

    def test_connect_gateway(self, client, auth_headers):
        """连接网关"""
        resp = client.post("/api/system/gateways/connect", json={
            "gateway_name": "CTP",
            "setting": {"用户名": "test", "密码": "test"},
        }, headers=auth_headers)
        assert resp.status_code == 200

    def test_connect_gateway_missing_name(self, client, auth_headers):
        """缺少网关名称"""
        resp = client.post("/api/system/gateways/connect", json={
            "setting": {},
        }, headers=auth_headers)
        assert resp.status_code == 400


class TestApps:
    """应用列表测试"""

    def test_get_apps(self, client, auth_headers):
        """获取所有应用"""
        resp = client.get("/api/system/apps", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["app_name"] == "cta_strategy"


class TestExchanges:
    """交易所列表测试"""

    def test_get_exchanges(self, client, auth_headers):
        """获取所有交易所"""
        resp = client.get("/api/system/exchanges", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "SHFE" in data
        assert "CFFEX" in data


class TestLogs:
    """系统日志测试"""

    def test_get_logs(self, client, auth_headers):
        """获取系统日志"""
        resp = client.get("/api/system/logs", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "total" in data
        assert isinstance(data["data"], list)

    def test_get_logs_with_level_filter(self, client, auth_headers):
        """按级别筛选日志"""
        resp = client.get("/api/system/logs?level=INFO", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        # 验证返回的日志级别匹配
        for log in data["data"]:
            assert log.get("level", "").upper() == "INFO"

    def test_get_logs_with_keyword_search(self, client, auth_headers):
        """按关键词搜索日志"""
        resp = client.get("/api/system/logs?keyword=test", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data

    def test_get_logs_with_source_filter(self, client, auth_headers):
        """按来源筛选日志"""
        resp = client.get("/api/system/logs?source=CTP", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data

    def test_get_logs_with_time_range(self, client, auth_headers):
        """按时间范围筛选日志"""
        resp = client.get(
            "/api/system/logs?start_time=2024-01-01T00:00:00&end_time=2024-12-31T23:59:59",
            headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data

    def test_get_logs_with_limit(self, client, auth_headers):
        """限制返回条数"""
        resp = client.get("/api/system/logs?limit=10", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "total" in data
        assert len(data["data"]) <= 10
