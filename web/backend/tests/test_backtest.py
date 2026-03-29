"""回测引擎路由测试"""

import pytest


class TestBacktestClasses:
    """回测策略类测试"""

    def test_get_classes(self, client, auth_headers):
        """获取可回测的策略类"""
        resp = client.get("/api/backtest/classes", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "AtrRsiStrategy" in data

    def test_get_class_setting(self, client, auth_headers):
        """获取策略类参数"""
        resp = client.get("/api/backtest/classes/AtrRsiStrategy/setting", headers=auth_headers)
        assert resp.status_code == 200

    def test_unauthenticated(self, client):
        """未认证返回 401"""
        resp = client.get("/api/backtest/classes")
        assert resp.status_code == 401


class TestBacktestRun:
    """回测执行测试（当前返回 501）"""

    def test_run_not_implemented(self, client, auth_headers):
        """回测接口尚未实现"""
        resp = client.post("/api/backtest/run", json={
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "interval": "1m",
            "start": "2024-01-01",
            "end": "2024-12-31",
            "setting": {},
        }, headers=auth_headers)
        assert resp.status_code == 501

    def test_optimize_not_implemented(self, client, auth_headers):
        """参数优化接口尚未实现"""
        resp = client.post("/api/backtest/optimize", json={
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "parameters": {"atr_length": [10, 20, 30]},
        }, headers=auth_headers)
        assert resp.status_code == 501

    def test_download_not_implemented(self, client, auth_headers):
        """数据下载接口尚未实现"""
        resp = client.post("/api/backtest/download", json={
            "vt_symbol": "rb2410.SHFE",
            "start": "2024-01-01",
            "end": "2024-12-31",
        }, headers=auth_headers)
        assert resp.status_code == 501


class TestBacktestResult:
    """回测结果测试（当前返回 501）"""

    def test_result_not_implemented(self, client, auth_headers):
        resp = client.get("/api/backtest/result", headers=auth_headers)
        assert resp.status_code == 501

    def test_daily_not_implemented(self, client, auth_headers):
        resp = client.get("/api/backtest/result/daily", headers=auth_headers)
        assert resp.status_code == 501

    def test_trades_not_implemented(self, client, auth_headers):
        resp = client.get("/api/backtest/result/trades", headers=auth_headers)
        assert resp.status_code == 501

    def test_orders_not_implemented(self, client, auth_headers):
        resp = client.get("/api/backtest/result/orders", headers=auth_headers)
        assert resp.status_code == 501

    def test_chart_not_implemented(self, client, auth_headers):
        resp = client.get("/api/backtest/result/chart", headers=auth_headers)
        assert resp.status_code == 501
