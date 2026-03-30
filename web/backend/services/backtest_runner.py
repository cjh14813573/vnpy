"""回测异步任务管理器

支持：
- 异步执行回测任务
- 实时进度推送（WebSocket）
- 任务取消
- 并发控制
"""

import asyncio
import inspect
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"      # 等待执行
    RUNNING = "running"      # 执行中
    COMPLETED = "completed"  # 完成
    FAILED = "failed"        # 失败
    CANCELLED = "cancelled"  # 已取消


@dataclass
class BacktestTask:
    """回测任务"""
    task_id: str
    task_type: str  # backtest, optimize, download
    status: TaskStatus = TaskStatus.PENDING
    params: dict = field(default_factory=dict)
    result: Optional[dict] = None
    error_message: Optional[str] = None
    progress: int = 0  # 0-100
    progress_message: str = ""
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    _cancel_event: threading.Event = field(default_factory=threading.Event)
    _thread: Optional[threading.Thread] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "status": self.status.value,
            "params": self.params,
            "result": self.result,
            "error_message": self.error_message,
            "progress": self.progress,
            "progress_message": self.progress_message,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
        }


class BacktestRunner:
    """回测任务运行器（线程安全单例）"""

    _instance: Optional["BacktestRunner"] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self, max_workers: int = 2):
        if self._initialized:
            return
        self._initialized = True

        self._tasks: dict[str, BacktestTask] = {}
        self._max_workers = max_workers
        self._running_count = 0
        self._mutex = threading.RLock()
        self._progress_callbacks: list[Callable[[str, int, str], None]] = []

    def register_progress_callback(self, callback: Callable[[str, int, str], None]):
        """注册进度回调"""
        self._progress_callbacks.append(callback)

    def _notify_progress(self, task_id: str, progress: int, message: str):
        """通知进度更新"""
        for callback in self._progress_callbacks:
            try:
                result = callback(task_id, progress, message)
                # 如果是协程，需要调度执行
                if inspect.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception:
                pass

    def create_task(self, task_type: str, params: dict) -> str:
        """创建任务

        Args:
            task_type: backtest, optimize, download
            params: 任务参数

        Returns:
            task_id
        """
        task_id = f"bt-{uuid.uuid4().hex[:12]}"

        with self._mutex:
            self._tasks[task_id] = BacktestTask(
                task_id=task_id,
                task_type=task_type,
                params=params
            )

        return task_id

    def start_task(self, task_id: str) -> bool:
        """启动任务

        Args:
            task_id: 任务ID

        Returns:
            是否成功启动
        """
        with self._mutex:
            if task_id not in self._tasks:
                return False

            task = self._tasks[task_id]
            if task.status != TaskStatus.PENDING:
                return False

            # 检查并发限制
            if self._running_count >= self._max_workers:
                return False

            # 启动任务
            task.status = TaskStatus.RUNNING
            task.started_at = time.time()
            self._running_count += 1

            # 在后台线程执行
            task._thread = threading.Thread(
                target=self._run_task,
                args=(task_id,),
                daemon=True
            )
            task._thread.start()

        return True

    def _run_task(self, task_id: str):
        """执行任务（在后台线程中）"""
        task = self._tasks.get(task_id)
        if not task:
            return

        try:
            # 模拟回测过程（实际应调用 vnpy 回测引擎）
            self._simulate_backtest(task)

            # 任务完成
            with self._mutex:
                task.status = TaskStatus.COMPLETED
                task.completed_at = time.time()
                task.progress = 100
                task.progress_message = "回测完成"
                self._running_count -= 1

        except Exception as e:
            # 任务失败
            with self._mutex:
                task.status = TaskStatus.FAILED
                task.error_message = str(e)
                task.completed_at = time.time()
                self._running_count -= 1

    def _simulate_backtest(self, task: BacktestTask):
        """模拟回测执行（实际实现时应替换为真实回测逻辑）"""
        params = task.params
        total_steps = 10

        try:
            for i in range(total_steps):
                # 检查是否被取消
                if task._cancel_event.is_set():
                    raise Exception("任务被取消")

                # 模拟工作
                time.sleep(0.1)

                # 更新进度
                progress = int((i + 1) / total_steps * 100)
                message = f"回测进度: {i+1}/{total_steps}"

                task.progress = progress
                task.progress_message = message
                self._notify_progress(task.task_id, progress, message)

            # 生成模拟结果
            task.result = {
                "total_return": 15.5,
                "annual_return": 12.3,
                "max_drawdown": -8.2,
                "sharpe_ratio": 1.45,
                "total_trades": 150,
                "winning_trades": 85,
                "losing_trades": 65,
                "win_rate": 0.567,
            }
        except Exception:
            # 任务被取消或出错，不设置结果
            pass

    def cancel_task(self, task_id: str) -> bool:
        """取消任务

        Args:
            task_id: 任务ID

        Returns:
            是否成功取消
        """
        with self._mutex:
            if task_id not in self._tasks:
                return False

            task = self._tasks[task_id]

            if task.status == TaskStatus.COMPLETED:
                return False

            if task.status == TaskStatus.CANCELLED:
                return True

            # 设置取消标志
            task._cancel_event.set()
            task.status = TaskStatus.CANCELLED
            task.completed_at = time.time()
            task.progress_message = "任务已取消"

            return True

    def get_task(self, task_id: str) -> Optional[dict]:
        """获取任务信息"""
        with self._mutex:
            if task_id not in self._tasks:
                return None
            return self._tasks[task_id].to_dict()

    def get_all_tasks(
        self,
        status: Optional[str] = None,
        task_type: Optional[str] = None,
        limit: int = 50
    ) -> list[dict]:
        """获取任务列表

        Args:
            status: 按状态过滤
            task_type: 按类型过滤
            limit: 返回数量限制
        """
        with self._mutex:
            tasks = list(self._tasks.values())

            # 过滤
            if status:
                tasks = [t for t in tasks if t.status.value == status]
            if task_type:
                tasks = [t for t in tasks if t.task_type == task_type]

            # 按创建时间倒序
            tasks.sort(key=lambda t: t.created_at, reverse=True)

            return [t.to_dict() for t in tasks[:limit]]

    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """清理旧任务

        Args:
            max_age_hours: 最大保留时间（小时）
        """
        cutoff = time.time() - max_age_hours * 3600

        with self._mutex:
            old_tasks = [
                tid for tid, t in self._tasks.items()
                if t.created_at < cutoff and t.status in (
                    TaskStatus.COMPLETED,
                    TaskStatus.FAILED,
                    TaskStatus.CANCELLED
                )
            ]
            for tid in old_tasks:
                del self._tasks[tid]


# 全局单例
backtest_runner = BacktestRunner()
