"""操作日志服务

记录用户关键操作，支持审计追溯。
"""

import sqlite3
import threading
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
from typing import Optional

from config import settings


class OperationType(str, Enum):
    """操作类型"""
    LOGIN = "login"
    LOGOUT = "logout"
    ORDER_SEND = "order_send"
    ORDER_CANCEL = "order_cancel"
    STRATEGY_ADD = "strategy_add"
    STRATEGY_REMOVE = "strategy_remove"
    STRATEGY_EDIT = "strategy_edit"
    STRATEGY_INIT = "strategy_init"
    STRATEGY_START = "strategy_start"
    STRATEGY_STOP = "strategy_stop"
    GATEWAY_CONNECT = "gateway_connect"
    BACKTEST_CREATE = "backtest_create"
    BACKTEST_CANCEL = "backtest_cancel"


@dataclass
class OperationLog:
    """操作日志条目"""
    id: Optional[int] = None
    timestamp: float = 0
    username: str = ""
    operation: str = ""
    target_type: str = ""      # 目标类型：order, strategy, gateway
    target_id: str = ""        # 目标标识
    details: str = ""          # JSON 格式的详细参数
    ip_address: str = ""       # 客户端IP
    user_agent: str = ""       # 客户端UA
    success: bool = True       # 是否成功
    error_message: str = ""    # 失败原因

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "datetime": datetime.fromtimestamp(self.timestamp).isoformat(),
            "username": self.username,
            "operation": self.operation,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "success": self.success,
            "error_message": self.error_message,
        }


class OperationLogService:
    """操作日志服务（线程安全单例）"""

    _instance: Optional["OperationLogService"] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        self._db_path = settings.DB_PATH
        self._mutex = threading.RLock()
        self._init_table()

    def _init_table(self):
        """初始化日志表"""
        with sqlite3.connect(self._db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS operation_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    username TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    target_type TEXT,
                    target_id TEXT,
                    details TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    success INTEGER DEFAULT 1,
                    error_message TEXT
                )
            """)
            # 创建索引
            conn.execute("CREATE INDEX IF NOT EXISTS idx_logs_time ON operation_logs(timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(username)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_logs_op ON operation_logs(operation)")
            conn.commit()

    def log(
        self,
        username: str,
        operation: OperationType | str,
        target_type: str = "",
        target_id: str = "",
        details: str = "",
        ip_address: str = "",
        user_agent: str = "",
        success: bool = True,
        error_message: str = "",
    ) -> int:
        """记录操作日志

        Returns:
            日志ID
        """
        with self._mutex:
            with sqlite3.connect(self._db_path) as conn:
                cursor = conn.execute(
                    """INSERT INTO operation_logs
                        (timestamp, username, operation, target_type, target_id,
                         details, ip_address, user_agent, success, error_message)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        time.time(),
                        username,
                        operation.value if isinstance(operation, OperationType) else operation,
                        target_type,
                        target_id,
                        details,
                        ip_address,
                        user_agent,
                        1 if success else 0,
                        error_message,
                    )
                )
                conn.commit()
                return cursor.lastrowid

    def query(
        self,
        username: Optional[str] = None,
        operation: Optional[str] = None,
        target_type: Optional[str] = None,
        start_time: Optional[float] = None,
        end_time: Optional[float] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        """查询日志"""
        conditions = ["1=1"]
        params = []

        if username:
            conditions.append("username = ?")
            params.append(username)
        if operation:
            conditions.append("operation = ?")
            params.append(operation)
        if target_type:
            conditions.append("target_type = ?")
            params.append(target_type)
        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time)
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time)

        where_clause = " AND ".join(conditions)

        with sqlite3.connect(self._db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                f"""SELECT * FROM operation_logs
                    WHERE {where_clause}
                    ORDER BY timestamp DESC
                    LIMIT ? OFFSET ?
                """,
                params + [limit, offset]
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def count(
        self,
        username: Optional[str] = None,
        operation: Optional[str] = None,
        target_type: Optional[str] = None,
        start_time: Optional[float] = None,
        end_time: Optional[float] = None,
    ) -> int:
        """统计日志数量"""
        conditions = ["1=1"]
        params = []

        if username:
            conditions.append("username = ?")
            params.append(username)
        if operation:
            conditions.append("operation = ?")
            params.append(operation)
        if target_type:
            conditions.append("target_type = ?")
            params.append(target_type)
        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time)
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time)

        where_clause = " AND ".join(conditions)

        with sqlite3.connect(self._db_path) as conn:
            cursor = conn.execute(
                f"SELECT COUNT(*) FROM operation_logs WHERE {where_clause}",
                params
            )
            return cursor.fetchone()[0]

    def get_stats(self, days: int = 7) -> dict:
        """获取统计信息"""
        since = time.time() - days * 86400

        with sqlite3.connect(self._db_path) as conn:
            # 总操作数
            total = conn.execute(
                "SELECT COUNT(*) FROM operation_logs WHERE timestamp >= ?",
                (since,)
            ).fetchone()[0]

            # 按操作类型统计
            cursor = conn.execute(
                """SELECT operation, COUNT(*) as count
                    FROM operation_logs
                    WHERE timestamp >= ?
                    GROUP BY operation
                    ORDER BY count DESC
                """,
                (since,)
            )
            by_operation = {row[0]: row[1] for row in cursor.fetchall()}

            # 活跃用户
            cursor = conn.execute(
                """SELECT username, COUNT(*) as count
                    FROM operation_logs
                    WHERE timestamp >= ?
                    GROUP BY username
                    ORDER BY count DESC
                    LIMIT 10
                """,
                (since,)
            )
            by_user = {row[0]: row[1] for row in cursor.fetchall()}

            # 失败操作
            failures = conn.execute(
                """SELECT COUNT(*) FROM operation_logs
                    WHERE timestamp >= ? AND success = 0
                """,
                (since,)
            ).fetchone()[0]

        return {
            "total_operations": total,
            "by_operation": by_operation,
            "by_user": by_user,
            "failures": failures,
            "days": days,
        }

    def cleanup(self, max_age_days: int = 30) -> int:
        """清理旧日志

        Returns:
            删除的记录数
        """
        cutoff = time.time() - max_age_days * 86400

        with self._mutex:
            with sqlite3.connect(self._db_path) as conn:
                cursor = conn.execute(
                    "DELETE FROM operation_logs WHERE timestamp < ?",
                    (cutoff,)
                )
                conn.commit()
                return cursor.rowcount


# 全局单例
operation_log = OperationLogService()
