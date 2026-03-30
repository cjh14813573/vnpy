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
    """风控管理测试"""

    def test_rules_list(self, client, auth_headers):
        resp = client.get("/api/risk/rules", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_rule_detail(self, client, auth_headers):
        # 先获取列表，然后测试第一个规则
        resp = client.get("/api/risk/rules", headers=auth_headers)
        rules = resp.json()
        if rules:
            rule_name = rules[0]["name"]
            resp = client.get(f"/api/risk/rules/{rule_name}", headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["name"] == rule_name

    def test_update_rule(self, client, auth_headers):
        # 先获取列表
        resp = client.get("/api/risk/rules", headers=auth_headers)
        rules = resp.json()
        if rules:
            rule_name = rules[0]["name"]
            resp = client.put(f"/api/risk/rules/{rule_name}", json={
                "enabled": False,
                "limit": 100,
            }, headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["enabled"] == False

    def test_rule_not_found(self, client, auth_headers):
        resp = client.get("/api/risk/rules/non_existent_rule", headers=auth_headers)
        assert resp.status_code == 404

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
