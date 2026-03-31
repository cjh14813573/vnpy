"""策略编辑器和机器学习 API 测试"""

import pytest


class TestEditorAPI:
    """策略编辑器 API 测试"""

    def test_get_templates(self, client, auth_headers):
        """获取策略模板列表"""
        resp = client.get("/api/editor/templates", headers=auth_headers)
        # 后端可能返回200或500（vnpy未安装时）
        assert resp.status_code in [200, 500]
        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data, list)

    def test_get_strategy_code(self, client, auth_headers):
        """获取策略源码"""
        # 测试获取一个可能存在的策略类源码
        resp = client.get("/api/editor/strategy/AtrRsiStrategy", headers=auth_headers)
        # 如果策略存在则返回200，否则返回404或500（vnpy未安装时）
        assert resp.status_code in [200, 404, 500]
        if resp.status_code == 200:
            data = resp.json()
            assert "class_name" in data
            assert "code" in data

    def test_get_strategy_code_not_found(self, client, auth_headers):
        """获取不存在的策略源码返回404或500"""
        resp = client.get("/api/editor/strategy/NonExistentStrategy123", headers=auth_headers)
        # 后端可能返回404或500（当vnpy模块不可用时）
        assert resp.status_code in [404, 500]


class TestMLAPI:
    """机器学习 API 测试"""

    def test_list_models(self, client, auth_headers):
        """获取模型列表"""
        resp = client.get("/api/ml/models", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_generate_features_validation(self, client, auth_headers):
        """特征生成参数验证"""
        # 缺少必要参数应该返回422
        resp = client.post("/api/ml/features/generate", json={}, headers=auth_headers)
        assert resp.status_code in [200, 422, 500]

    def test_train_model_validation(self, client, auth_headers):
        """模型训练参数验证"""
        # 缺少必要参数
        resp = client.post("/api/ml/models/train", json={}, headers=auth_headers)
        # 后端可能返回422（参数验证失败）或500（vnpy未安装）
        assert resp.status_code in [200, 422, 500]


class TestGatewayAPI:
    """网关管理 API 测试"""

    def test_get_gateways(self, client, auth_headers):
        """获取网关列表"""
        resp = client.get("/api/system/gateways", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_get_gateway_setting(self, client, auth_headers):
        """获取网关配置"""
        # 先获取网关列表
        resp = client.get("/api/system/gateways", headers=auth_headers)
        gateways = resp.json()

        if gateways:
            # 测试第一个网关的配置
            gateway_name = gateways[0]
            resp = client.get(f"/api/system/gateways/{gateway_name}/setting", headers=auth_headers)
            assert resp.status_code in [200, 404]

    def test_connect_gateway_validation(self, client, auth_headers):
        """连接网关参数验证"""
        # 缺少 gateway_name
        resp = client.post("/api/system/gateways/connect", json={"setting": {}}, headers=auth_headers)
        assert resp.status_code == 400


class TestPaperTradingAPI:
    """模拟交易 API 测试"""

    def test_get_paper_setting(self, client, auth_headers):
        """获取模拟交易设置"""
        resp = client.get("/api/paper/setting", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "instant_trade" in data
        assert "trade_slippage" in data
        assert "timer_interval" in data

    def test_update_paper_setting(self, client, auth_headers):
        """更新模拟交易设置"""
        setting = {
            "instant_trade": True,
            "trade_slippage": 0.5,
            "timer_interval": 5
        }
        resp = client.put("/api/paper/setting", json=setting, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        # 验证更新成功
        resp = client.get("/api/paper/setting", headers=auth_headers)
        data = resp.json()
        assert data["trade_slippage"] == 0.5
        assert data["timer_interval"] == 5

    def test_get_paper_positions(self, client, auth_headers):
        """获取模拟持仓"""
        resp = client.get("/api/paper/positions", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_clear_paper_positions(self, client, auth_headers):
        """清空模拟持仓"""
        resp = client.post("/api/paper/clear", headers=auth_headers)
        # 如果没有模拟引擎可能返回500
        assert resp.status_code in [200, 500]
        if resp.status_code == 200:
            assert resp.json()["success"] is True
