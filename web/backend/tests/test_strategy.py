"""CTA 策略管理路由测试"""

import pytest


class TestStrategyClasses:
    """策略类测试"""

    def test_get_classes(self, client, auth_headers):
        """获取策略类列表"""
        resp = client.get("/api/strategy/classes", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "AtrRsiStrategy" in data
        assert "BollChannelStrategy" in data

    def test_get_class_params(self, client, auth_headers):
        """获取策略类参数模板"""
        resp = client.get("/api/strategy/classes/AtrRsiStrategy/params", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "atr_length" in data

    def test_get_class_code(self, client, auth_headers):
        """获取策略类源码"""
        resp = client.get("/api/strategy/classes/AtrRsiStrategy/code", headers=auth_headers)
        assert resp.status_code == 200
        assert "code" in resp.json()


class TestStrategyInstances:
    """策略实例测试"""

    def test_get_instances(self, client, auth_headers):
        """获取所有策略实例"""
        resp = client.get("/api/strategy/instances", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["strategy_name"] == "atr_rsi_01"

    def test_get_instance(self, client, auth_headers):
        """获取单个策略实例"""
        resp = client.get("/api/strategy/instances/atr_rsi_01", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["class_name"] == "AtrRsiStrategy"
        assert data["inited"] is True
        assert data["trading"] is True

    def test_get_instance_not_found(self, client, auth_headers):
        """策略不存在"""
        resp = client.get("/api/strategy/instances/nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    def test_add_strategy(self, client, auth_headers):
        """添加策略"""
        resp = client.post("/api/strategy/instances", json={
            "class_name": "AtrRsiStrategy",
            "strategy_name": "atr_test_02",
            "vt_symbol": "rb2410.SHFE",
            "setting": {"atr_length": 14},
        }, headers=auth_headers)
        assert resp.status_code == 200

    def test_edit_strategy(self, client, auth_headers):
        """修改策略参数"""
        resp = client.put("/api/strategy/instances/atr_rsi_01", json={
            "setting": {"atr_length": 25},
        }, headers=auth_headers)
        assert resp.status_code == 200

    def test_remove_strategy(self, client, auth_headers):
        """删除策略"""
        resp = client.delete("/api/strategy/instances/atr_rsi_01", headers=auth_headers)
        assert resp.status_code == 200


class TestStrategyLifecycle:
    """策略生命周期测试"""

    def test_init_strategy(self, client, auth_headers):
        """初始化策略"""
        resp = client.post("/api/strategy/instances/atr_rsi_01/init", headers=auth_headers)
        assert resp.status_code == 200

    def test_start_strategy(self, client, auth_headers):
        """启动策略"""
        resp = client.post("/api/strategy/instances/atr_rsi_01/start", headers=auth_headers)
        assert resp.status_code == 200

    def test_stop_strategy(self, client, auth_headers):
        """停止策略"""
        resp = client.post("/api/strategy/instances/atr_rsi_01/stop", headers=auth_headers)
        assert resp.status_code == 200

    def test_init_all(self, client, auth_headers):
        """初始化所有策略"""
        resp = client.post("/api/strategy/instances/init-all", headers=auth_headers)
        assert resp.status_code == 200

    def test_start_all(self, client, auth_headers):
        """启动所有策略"""
        resp = client.post("/api/strategy/instances/start-all", headers=auth_headers)
        assert resp.status_code == 200

    def test_stop_all(self, client, auth_headers):
        """停止所有策略"""
        resp = client.post("/api/strategy/instances/stop-all", headers=auth_headers)
        assert resp.status_code == 200


class TestStrategyVariables:
    """策略变量测试"""

    def test_get_variables(self, client, auth_headers):
        """获取策略变量"""
        resp = client.get("/api/strategy/instances/atr_rsi_01/variables", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "atr_value" in data
