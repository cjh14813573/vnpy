"""数据管理路由测试"""

import io
import pytest


class TestDataOverview:
    """数据概览测试"""

    def test_get_overview(self, client, auth_headers):
        """获取数据概览"""
        resp = client.get("/api/data/overview", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_overview_unauthenticated(self, client):
        """未认证返回 401"""
        resp = client.get("/api/data/overview")
        assert resp.status_code == 401


class TestDataDelete:
    """数据删除测试"""

    def test_delete_data(self, client, auth_headers):
        """删除指定数据"""
        # 先导入数据
        csv_content = """datetime,open,high,low,close,volume,open_interest
2024-01-01 09:00:00,3500.0,3510.0,3495.0,3505.0,1000,5000
"""
        file = io.BytesIO(csv_content.encode('utf-8'))
        client.post(
            "/api/data/import-csv?vt_symbol=rb2410.SHFE&interval=1m",
            files={"file": ("test.csv", file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )

        # 删除数据
        resp = client.request(
            "DELETE",
            "/api/data/delete",
            json={"vt_symbol": "rb2410.SHFE", "interval": "1m"},
            headers=auth_headers
        )
        assert resp.status_code == 200


class TestDataImport:
    """CSV 导入测试"""

    def test_import_csv_success(self, client, auth_headers):
        """CSV 导入成功"""
        csv_content = """datetime,open,high,low,close,volume,open_interest
2024-01-01 09:00:00,3500.0,3510.0,3495.0,3505.0,1000,5000
2024-01-01 09:01:00,3505.0,3520.0,3500.0,3515.0,1200,5100
2024-01-01 09:02:00,3515.0,3525.0,3510.0,3520.0,800,5200
"""
        file = io.BytesIO(csv_content.encode('utf-8'))
        resp = client.post(
            "/api/data/import-csv?vt_symbol=rb2410.SHFE&interval=1m",
            files={"file": ("test.csv", file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["imported"] == 3

    def test_import_csv_missing_columns(self, client, auth_headers):
        """CSV 缺少必需列"""
        csv_content = """datetime,open,high
2024-01-01 09:00:00,3500.0,3510.0
"""
        file = io.BytesIO(csv_content.encode('utf-8'))
        resp = client.post(
            "/api/data/import-csv?vt_symbol=rb2410.SHFE&interval=1m",
            files={"file": ("test.csv", file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )
        assert resp.status_code == 400
        assert "缺少必需列" in resp.json()["detail"]

    def test_import_csv_empty_file(self, client, auth_headers):
        """CSV 文件为空（只有表头）"""
        csv_content = """datetime,open,high,low,close,volume
"""
        file = io.BytesIO(csv_content.encode('utf-8'))
        resp = client.post(
            "/api/data/import-csv?vt_symbol=rb2410.SHFE&interval=1m",
            files={"file": ("test.csv", file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )
        assert resp.status_code == 400
        assert "CSV 文件为空" in resp.json()["detail"]

    def test_import_csv_unauthenticated(self, client):
        """未认证导入返回 401"""
        file = io.BytesIO(b"test")
        resp = client.post(
            "/api/data/import-csv?vt_symbol=rb2410.SHFE&interval=1m",
            files={"file": ("test.csv", file, "text/csv")}
        )
        assert resp.status_code == 401


class TestDataExport:
    """CSV 导出测试"""

    def test_export_csv_success(self, client, auth_headers):
        """CSV 导出成功"""
        # 先导入数据
        csv_content = """datetime,open,high,low,close,volume,open_interest
2024-01-01 09:00:00,3500.0,3510.0,3495.0,3505.0,1000,5000
2024-01-01 09:01:00,3505.0,3520.0,3500.0,3515.0,1200,5100
"""
        file = io.BytesIO(csv_content.encode('utf-8'))
        client.post(
            "/api/data/import-csv?vt_symbol=rb2410.SHFE&interval=1m",
            files={"file": ("test.csv", file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )

        # 导出数据
        resp = client.post(
            "/api/data/export-csv",
            json={"vt_symbol": "rb2410.SHFE", "interval": "1m"},
            headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "text/csv; charset=utf-8"

    def test_export_csv_with_date_range(self, client, auth_headers):
        """CSV 导出带日期范围"""
        resp = client.post(
            "/api/data/export-csv",
            json={"vt_symbol": "rb2410.SHFE", "interval": "1m", "start": "2024-01-01", "end": "2024-12-31"},
            headers=auth_headers
        )
        assert resp.status_code == 200

    def test_export_csv_unauthenticated(self, client):
        """未认证导出返回 401"""
        resp = client.post("/api/data/export-csv", json={"vt_symbol": "rb2410.SHFE", "interval": "1m"})
        # 路由有依赖认证，未认证应该返回 401
        assert resp.status_code == 401


class TestDataPreview:
    """数据预览测试"""

    def test_preview_data(self, client, auth_headers):
        """预览数据"""
        resp = client.get(
            "/api/data/preview?vt_symbol=rb2410.SHFE&interval=1m&limit=10",
            headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "vt_symbol" in data
        assert "interval" in data
        assert "total" in data
        assert "preview" in data
        assert isinstance(data["preview"], list)

    def test_preview_unauthenticated(self, client):
        """未认证预览返回 401"""
        resp = client.get("/api/data/preview?vt_symbol=rb2410.SHFE&interval=1m")
        assert resp.status_code == 401


class TestRiskManagement:
    """风控管理测试"""

    def test_rules_list(self, client, auth_headers):
        resp = client.get("/api/risk/rules", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_rule_detail(self, client, auth_headers):
        resp = client.get("/api/risk/rules", headers=auth_headers)
        rules = resp.json()
        if rules:
            rule_name = rules[0]["name"]
            resp = client.get(f"/api/risk/rules/{rule_name}", headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["name"] == rule_name

    def test_update_rule(self, client, auth_headers):
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
    """模拟盘测试"""

    def test_setting(self, client, auth_headers):
        resp = client.get("/api/paper/setting", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)

    def test_update_setting(self, client, auth_headers):
        resp = client.put("/api/paper/setting", json={
            "instant_trade": True,
            "trade_slippage": 0.0,
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json().get("success") is True

    def test_clear(self, client, auth_headers):
        resp = client.post("/api/paper/clear", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json().get("success") is True

    def test_get_positions(self, client, auth_headers):
        resp = client.get("/api/paper/positions", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_unauthenticated(self, client):
        resp = client.get("/api/paper/setting")
        assert resp.status_code == 401
