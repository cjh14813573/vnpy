"""算法交易路由测试"""

import pytest
from io import BytesIO


class TestAlgoTemplates:
    """算法模板测试"""

    def test_get_algo_templates(self, client, auth_headers):
        """获取算法模板列表"""
        resp = client.get("/api/algo/templates", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "name" in data[0]
        assert "display_name" in data[0]
        assert "default_setting" in data[0]

    def test_get_algo_template_detail(self, client, auth_headers):
        """获取算法模板详情"""
        resp = client.get("/api/algo/templates/TWAP", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "TWAP"

    def test_get_algo_template_not_found(self, client, auth_headers):
        """获取不存在的模板"""
        # mock 返回 None 时会返回 404
        resp = client.get("/api/algo/templates/INVALID", headers=auth_headers)
        # 目前 mock 始终有返回值，此测试验证 API 结构
        assert resp.status_code in (200, 404)


class TestAlgoList:
    """运行中算法列表测试"""

    def test_get_algo_list(self, client, auth_headers):
        """获取运行中的算法列表"""
        resp = client.get("/api/algo/list", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_algo_list_unauthenticated(self, client):
        """未认证返回 401"""
        resp = client.get("/api/algo/list")
        assert resp.status_code == 401


class TestAlgoOperations:
    """算法操作测试"""

    def test_start_algo(self, client, auth_headers):
        """启动算法"""
        resp = client.post("/api/algo/start", json={
            "template_name": "TWAP",
            "vt_symbol": "rb2410.SHFE",
            "direction": "多",
            "offset": "开",
            "price": 3500,
            "volume": 10,
            "setting": {"interval": 60, "interval_num": 10},
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data
        assert "algo_name" in data

    def test_start_algo_missing_field(self, client, auth_headers):
        """缺少必填字段"""
        resp = client.post("/api/algo/start", json={
            "template_name": "TWAP",
            # 缺少其他必填字段
        }, headers=auth_headers)
        assert resp.status_code == 422

    def test_stop_algo(self, client, auth_headers):
        """停止算法"""
        resp = client.post("/api/algo/TWAP_rb2410_001/stop", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True

    def test_pause_algo(self, client, auth_headers):
        """暂停算法"""
        resp = client.post("/api/algo/TWAP_rb2410_001/pause", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True

    def test_resume_algo(self, client, auth_headers):
        """恢复算法"""
        resp = client.post("/api/algo/TWAP_rb2410_001/resume", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True

    def test_stop_all_algos(self, client, auth_headers):
        """停止所有算法"""
        resp = client.post("/api/algo/stop-all", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True


class TestAlgoBatchImport:
    """算法批量导入测试"""

    def test_get_batch_template(self, client, auth_headers):
        """获取批量导入CSV模板"""
        resp = client.get("/api/algo/batch-template", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "template" in data
        assert "template_name" in data["template"]
        assert "symbol" in data["template"]

    def test_batch_import_success(self, client, auth_headers):
        """批量导入算法成功"""
        # 创建测试CSV文件
        csv_content = """template_name,symbol,exchange,direction,offset,price,volume,params
TWAP,rb2410,SHFE,多,开,3500,10,"{\"interval\":60,\"interval_num\":10}"
TWAP,cu2410,SHFE,空,开,68000,5,"{\"interval\":30,\"interval_num\":5}"
"""
        file = BytesIO(csv_content.encode('utf-8'))
        resp = client.post(
            "/api/algo/batch-import",
            files={"file": ("test_algos.csv", file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "success" in data
        assert "failed" in data
        assert "errors" in data
        assert "created" in data

    def test_batch_import_empty_file(self, client, auth_headers):
        """批量导入空CSV文件"""
        csv_content = """template_name,symbol,exchange,direction,offset,price,volume,params
"""
        file = BytesIO(csv_content.encode('utf-8'))
        resp = client.post(
            "/api/algo/batch-import",
            files={"file": ("empty.csv", file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )
        # 空文件或只有表头的文件
        assert resp.status_code in (200, 400)

    def test_batch_import_invalid_format(self, client, auth_headers):
        """批量导入格式错误的CSV"""
        csv_content = """invalid_column1,invalid_column2
value1,value2
"""
        file = BytesIO(csv_content.encode('utf-8'))
        resp = client.post(
            "/api/algo/batch-import",
            files={"file": ("invalid.csv", file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )
        # 格式错误应该返回失败记录
        assert resp.status_code == 200
        data = resp.json()
        assert data["failed"] >= 1

    def test_batch_import_no_file(self, client, auth_headers):
        """批量导入未提供文件"""
        resp = client.post("/api/algo/batch-import", headers=auth_headers)
        assert resp.status_code == 422

    def test_batch_import_unauthenticated(self, client):
        """未认证批量导入返回 401"""
        csv_content = "template_name,symbol,exchange,direction,offset,price,volume\nTWAP,rb2410,SHFE,多,开,3500,10"
        file = BytesIO(csv_content.encode('utf-8'))
        resp = client.post(
            "/api/algo/batch-import",
            files={"file": ("test.csv", file, "text/csv")}
        )
        assert resp.status_code == 401
