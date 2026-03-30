"""回测异步任务测试

测试回测异步任务管理功能，包括：
- 任务创建
- 任务状态查询
- 任务取消
- 并发控制
- 结果查询
"""

import time
import pytest
from services.backtest_runner import backtest_runner, TaskStatus


class TestBacktestTaskService:
    """回测任务服务单元测试"""

    def setup_method(self):
        """每个测试前清理任务"""
        backtest_runner._tasks = {}
        backtest_runner._running_count = 0

    def test_create_task(self):
        """创建回测任务"""
        params = {
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "interval": "1m",
            "start": "2024-01-01",
            "end": "2024-02-01",
        }

        task_id = backtest_runner.create_task("backtest", params)

        assert task_id.startswith("bt-")
        assert len(task_id) == 15  # bt- + 12位hex

        task = backtest_runner.get_task(task_id)
        assert task is not None
        assert task["task_type"] == "backtest"
        assert task["status"] == "pending"
        assert task["params"] == params

    def test_start_task(self):
        """启动任务"""
        task_id = backtest_runner.create_task("backtest", {"test": True})

        success = backtest_runner.start_task(task_id)
        assert success is True

        task = backtest_runner.get_task(task_id)
        assert task["status"] == "running"
        assert task["started_at"] is not None

    def test_start_nonexistent_task(self):
        """启动不存在的任务"""
        success = backtest_runner.start_task("bt-nonexistent")
        assert success is False

    def test_start_already_running_task(self):
        """启动已在运行的任务"""
        task_id = backtest_runner.create_task("backtest", {"test": True})
        backtest_runner.start_task(task_id)

        # 再次启动同一任务
        success = backtest_runner.start_task(task_id)
        assert success is False  # 应该失败

    def test_concurrent_limit(self):
        """并发限制测试"""
        backtest_runner._max_workers = 1  # 限制为1个并发

        # 创建并启动第一个任务
        task1 = backtest_runner.create_task("backtest", {"test": 1})
        backtest_runner.start_task(task1)

        # 创建第二个任务
        task2 = backtest_runner.create_task("backtest", {"test": 2})

        # 尝试启动第二个任务（应该失败，因为并发限制）
        success = backtest_runner.start_task(task2)
        assert success is False

        # 第二个任务应保持 pending 状态
        task_info = backtest_runner.get_task(task2)
        assert task_info["status"] == "pending"

    def test_cancel_pending_task(self):
        """取消等待中的任务"""
        task_id = backtest_runner.create_task("backtest", {"test": True})

        success = backtest_runner.cancel_task(task_id)
        assert success is True

        task = backtest_runner.get_task(task_id)
        assert task["status"] == "cancelled"

    def test_cancel_running_task(self):
        """取消运行中的任务"""
        task_id = backtest_runner.create_task("backtest", {"test": True, "delay": 5})
        backtest_runner.start_task(task_id)

        # 立即取消（在任务完成前）
        success = backtest_runner.cancel_task(task_id)
        assert success is True

        task = backtest_runner.get_task(task_id)
        assert task["status"] == "cancelled"

    def test_cancel_completed_task(self):
        """取消已完成的任务（应该失败）"""
        task_id = backtest_runner.create_task("backtest", {"test": True})

        # 模拟任务完成
        backtest_runner._tasks[task_id].status = TaskStatus.COMPLETED

        success = backtest_runner.cancel_task(task_id)
        assert success is False

    def test_cancel_nonexistent_task(self):
        """取消不存在的任务"""
        success = backtest_runner.cancel_task("bt-nonexistent")
        assert success is False

    def test_get_all_tasks(self):
        """获取所有任务"""
        # 创建多个任务
        for i in range(5):
            backtest_runner.create_task("backtest", {"index": i})

        tasks = backtest_runner.get_all_tasks()
        assert len(tasks) == 5

    def test_get_tasks_by_status(self):
        """按状态过滤任务"""
        # 创建任务
        task1 = backtest_runner.create_task("backtest", {"test": 1})
        task2 = backtest_runner.create_task("backtest", {"test": 2})
        backtest_runner.create_task("optimize", {"test": 3})

        # 启动一个任务
        backtest_runner.start_task(task1)

        # 按状态过滤
        pending_tasks = backtest_runner.get_all_tasks(status="pending")
        running_tasks = backtest_runner.get_all_tasks(status="running")

        assert len(pending_tasks) == 2
        assert len(running_tasks) == 1

    def test_get_tasks_by_type(self):
        """按类型过滤任务"""
        backtest_runner.create_task("backtest", {"test": 1})
        backtest_runner.create_task("backtest", {"test": 2})
        backtest_runner.create_task("optimize", {"test": 3})

        backtest_tasks = backtest_runner.get_all_tasks(task_type="backtest")
        optimize_tasks = backtest_runner.get_all_tasks(task_type="optimize")

        assert len(backtest_tasks) == 2
        assert len(optimize_tasks) == 1

    def test_task_limit(self):
        """任务数量限制"""
        for i in range(10):
            backtest_runner.create_task("backtest", {"index": i})

        # 限制返回5个
        tasks = backtest_runner.get_all_tasks(limit=5)
        assert len(tasks) == 5

    def test_cleanup_old_tasks(self):
        """清理旧任务"""
        # 创建一个已完成的老任务
        task_id = backtest_runner.create_task("backtest", {"test": True})
        backtest_runner._tasks[task_id].status = TaskStatus.COMPLETED
        backtest_runner._tasks[task_id].created_at = time.time() - 48 * 3600  # 48小时前

        # 清理24小时前的任务
        backtest_runner.cleanup_old_tasks(max_age_hours=24)

        assert backtest_runner.get_task(task_id) is None

    def test_progress_callback(self):
        """进度回调测试"""
        progress_updates = []

        def mock_callback(task_id: str, progress: int, message: str):
            progress_updates.append((task_id, progress, message))

        backtest_runner.register_progress_callback(mock_callback)

        task_id = backtest_runner.create_task("backtest", {"test": True})
        backtest_runner.start_task(task_id)

        # 等待任务完成
        time.sleep(6)

        # 应该有多个进度更新
        assert len(progress_updates) > 0
        assert any(p[0] == task_id for p in progress_updates)


class TestBacktestAsyncAPI:
    """回测异步任务 API 集成测试"""

    def setup_method(self):
        """每个测试前清理任务"""
        backtest_runner._tasks = {}
        backtest_runner._running_count = 0

    def test_create_backtest_task(self, client, auth_headers):
        """API: 创建回测任务"""
        resp = client.post("/api/backtest/tasks", json={
            "class_name": "AtrRsiStrategy",
            "vt_symbol": "rb2410.SHFE",
            "interval": "1m",
            "start": "2024-01-01",
            "end": "2024-02-01",
            "rate": 0.0001,
            "slippage": 0.5,
            "size": 10,
            "pricetick": 1.0,
            "capital": 100000.0,
            "setting": {"atr_length": 20}
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert "task_id" in data
        assert data["task_id"].startswith("bt-")
        assert data["status"] in ["running", "pending"]

    def test_get_task(self, client, auth_headers):
        """API: 获取任务详情"""
        # 先创建任务
        create_resp = client.post("/api/backtest/tasks", json={
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

        task_id = create_resp.json()["task_id"]

        # 获取任务详情
        resp = client.get(f"/api/backtest/tasks/{task_id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["task_id"] == task_id
        assert data["task_type"] == "backtest"
        assert "progress" in data

    def test_get_nonexistent_task(self, client, auth_headers):
        """API: 获取不存在的任务"""
        resp = client.get("/api/backtest/tasks/bt-nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    def test_get_all_tasks(self, client, auth_headers):
        """API: 获取任务列表"""
        # 创建几个任务
        for i in range(3):
            client.post("/api/backtest/tasks", json={
                "class_name": "AtrRsiStrategy",
                "vt_symbol": f"rb241{i}.SHFE",
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

        # 获取所有任务
        resp = client.get("/api/backtest/tasks", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "tasks" in data
        assert len(data["tasks"]) >= 3

    def test_get_tasks_with_filter(self, client, auth_headers):
        """API: 按状态过滤任务"""
        # 创建任务
        client.post("/api/backtest/tasks", json={
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

        # 按状态过滤
        resp = client.get("/api/backtest/tasks?status=pending", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert all(t["status"] == "pending" for t in data["tasks"])

    def test_cancel_task(self, client, auth_headers):
        """API: 取消任务"""
        # 创建任务
        create_resp = client.post("/api/backtest/tasks", json={
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

        task_id = create_resp.json()["task_id"]

        # 取消任务
        resp = client.delete(f"/api/backtest/tasks/{task_id}", headers=auth_headers)
        assert resp.status_code == 200

        # 验证任务已取消
        task_resp = client.get(f"/api/backtest/tasks/{task_id}", headers=auth_headers)
        assert task_resp.json()["status"] == "cancelled"

    def test_cancel_nonexistent_task(self, client, auth_headers):
        """API: 取消不存在的任务"""
        resp = client.delete("/api/backtest/tasks/bt-nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    def test_get_task_result_not_completed(self, client, auth_headers):
        """API: 获取未完成任务的結果（应该失败）"""
        # 创建但不启动任务
        create_resp = client.post("/api/backtest/tasks", json={
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

        task_id = create_resp.json()["task_id"]

        # 尝试获取结果
        resp = client.get(f"/api/backtest/tasks/{task_id}/result", headers=auth_headers)
        assert resp.status_code == 400

    def test_create_optimize_task(self, client, auth_headers):
        """API: 创建优化任务"""
        resp = client.post("/api/backtest/optimize-tasks", json={
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
            "optimization_setting": {"atr_length": {"start": 10, "end": 30, "step": 5}},
            "use_ga": False,
            "max_workers": 4
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert "task_id" in data

    def test_create_download_task(self, client, auth_headers):
        """API: 创建下载任务"""
        resp = client.post("/api/backtest/download-tasks", json={
            "vt_symbol": "rb2410.SHFE",
            "interval": "1m",
            "start": "2024-01-01",
            "end": "2024-02-01"
        }, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert "task_id" in data

    def test_get_task_chart(self, client, auth_headers):
        """API: 获取回测图表数据"""
        # 创建任务
        create_resp = client.post("/api/backtest/tasks", json={
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

        task_id = create_resp.json()["task_id"]

        # 获取图表数据
        resp = client.get(f"/api/backtest/tasks/{task_id}/chart", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "capital_curve" in data
        assert "initial_capital" in data
