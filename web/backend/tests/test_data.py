"""数据管理路由测试"""

import pytest


class TestDataManagement:
    """数据管理测试（当前返回 501）"""

    def test_overview_not_implemented(self, client, auth_headers):
        resp = client.get("/api/data/overview", headers=auth_headers)
        assert resp.status_code == 501

    def test_download_not_implemented(self, client, auth_headers):
        resp = client.post("/api/data/download", json={}, headers=auth_headers)
        assert resp.status_code == 501

    def test_delete_not_implemented(self, client, auth_headers):
        import json as json_mod
        resp = client.request("DELETE", "/api/data/delete",
            content=json_mod.dumps({"vt_symbol": "rb2410.SHFE", "interval": "1m"}),
            headers={**auth_headers, "Content-Type": "application/json"},
        )
        assert resp.status_code == 501

    def test_import_csv_not_implemented(self, client, auth_headers):
        resp = client.post("/api/data/import-csv", json={
            "file_path": "/tmp/test.csv",
            "vt_symbol": "rb2410.SHFE",
        }, headers=auth_headers)
        assert resp.status_code == 501

    def test_export_csv_not_implemented(self, client, auth_headers):
        resp = client.post("/api/data/export-csv", json={
            "vt_symbol": "rb2410.SHFE",
            "file_path": "/tmp/test.csv",
        }, headers=auth_headers)
        assert resp.status_code == 501

    def test_unauthenticated(self, client):
        resp = client.get("/api/data/overview")
        assert resp.status_code == 401


class TestRiskManagement:
    """风控管理测试（当前返回 501）"""

    def test_rules_not_implemented(self, client, auth_headers):
        resp = client.get("/api/risk/rules", headers=auth_headers)
        assert resp.status_code == 501

    def test_rule_detail_not_implemented(self, client, auth_headers):
        resp = client.get("/api/risk/rules/test_rule", headers=auth_headers)
        assert resp.status_code == 501

    def test_update_rule_not_implemented(self, client, auth_headers):
        resp = client.put("/api/risk/rules/test_rule", json={
            "active": True,
            "setting": {},
        }, headers=auth_headers)
        assert resp.status_code == 501

    def test_unauthenticated(self, client):
        resp = client.get("/api/risk/rules")
        assert resp.status_code == 401


class TestPaperTrading:
    """模拟盘测试（当前返回 501）"""

    def test_setting_not_implemented(self, client, auth_headers):
        resp = client.get("/api/paper/setting", headers=auth_headers)
        assert resp.status_code == 501

    def test_update_setting_not_implemented(self, client, auth_headers):
        resp = client.put("/api/paper/setting", json={
            "instant_trade": True,
            "trade_slippage": 0.0,
        }, headers=auth_headers)
        assert resp.status_code == 501

    def test_clear_not_implemented(self, client, auth_headers):
        resp = client.post("/api/paper/clear", headers=auth_headers)
        assert resp.status_code == 501

    def test_unauthenticated(self, client):
        resp = client.get("/api/paper/setting")
        assert resp.status_code == 401
