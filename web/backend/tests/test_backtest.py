"""回测引擎路由测试"""

import time
import pytest
from services.backtest_runner import backtest_runner


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


class TestBacktestDeprecatedEndpoints:
    """旧版回测接口测试（已弃用）"""

    def test_run_deprecated(self, client, auth_headers):
        """旧版回测接口返回 410 已弃用"""
        resp = client.post("/api/backtest/run", json={
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "interval": "1m",
            "start": "2024-01-01",
            "end": "2024-12-31",
            "setting": {},
        }, headers=auth_headers)
        assert resp.status_code == 410

    def test_optimize_deprecated(self, client, auth_headers):
        """旧版优化接口返回 410 已弃用"""
        resp = client.post("/api/backtest/optimize", json={
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "parameters": {"atr_length": [10, 20, 30]},
        }, headers=auth_headers)
        assert resp.status_code == 410

    def test_download_deprecated(self, client, auth_headers):
        """旧版下载接口返回 410 已弃用"""
        resp = client.post("/api/backtest/download", json={
            "vt_symbol": "rb2410.SHFE",
            "start": "2024-01-01",
            "end": "2024-12-31",
        }, headers=auth_headers)
        assert resp.status_code == 410

    def test_result_deprecated(self, client, auth_headers):
        """旧版结果接口返回 410 已弃用"""
        resp = client.get("/api/backtest/result", headers=auth_headers)
        assert resp.status_code == 410


class TestBacktestAsyncTasks:
    """回测异步任务测试"""

    def setup_method(self):
        """每个测试前清理任务"""
        backtest_runner._tasks = {}
        backtest_runner._running_count = 0

    def test_create_task(self, client, auth_headers):
        """创建回测任务"""
        resp = client.post("/api/backtest/tasks", json={
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "interval": "1m",
            "start": "2024-01-01",
            "end": "2024-02-01",
            "rate": 0.0,
            "slippage": 0.0,
            "size": 1,
            "pricetick": 0.01,
            "capital": 100000.0,
            "setting": {}
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert "task_id" in data
        assert data["task_id"].startswith("bt-")

    def test_get_task_list(self, client, auth_headers):
        """获取任务列表"""
        resp = client.get("/api/backtest/tasks", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "tasks" in data


class TestBacktestOptimization:
    """参数优化任务测试"""

    def setup_method(self):
        """每个测试前清理任务"""
        backtest_runner._tasks = {}
        backtest_runner._running_count = 0

    def test_create_optimize_task(self, client, auth_headers):
        """创建参数优化任务"""
        resp = client.post("/api/backtest/optimize-tasks", json={
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "interval": "1m",
            "start": "2024-01-01",
            "end": "2024-02-01",
            "parameters": {
                "atr_length": ["10", "20", "30"],
                "rsi_length": ["5", "10", "14"]
            },
            "target_name": "sharpe_ratio"
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert "task_id" in data

    def test_get_optimize_task_result(self, client, auth_headers):
        """获取优化任务结果"""
        # 先创建优化任务
        resp = client.post("/api/backtest/optimize-tasks", json={
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "interval": "1m",
            "start": "2024-01-01",
            "end": "2024-02-01",
            "parameters": {
                "atr_length": ["10", "20"],
                "rsi_length": ["5", "10"]
            },
            "target_name": "sharpe_ratio"
        }, headers=auth_headers)
        task_id = resp.json()["task_id"]

        # 获取任务结果
        resp = client.get(f"/api/backtest/tasks/{task_id}/result", headers=auth_headers)
        assert resp.status_code in [200, 404]  # 可能还未完成

    def test_cancel_task(self, client, auth_headers):
        """取消任务"""
        # 创建任务
        resp = client.post("/api/backtest/tasks", json={
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "interval": "1m",
            "start": "2024-01-01",
            "end": "2024-02-01",
            "rate": 0.0,
            "slippage": 0.0,
            "size": 1,
            "pricetick": 0.01,
            "capital": 100000.0,
            "setting": {}
        }, headers=auth_headers)
        task_id = resp.json()["task_id"]

        # 取消任务（任务可能已完成，返回200或404都可接受）
        resp = client.post(f"/api/backtest/tasks/{task_id}/cancel", headers=auth_headers)
        assert resp.status_code in [200, 404]
