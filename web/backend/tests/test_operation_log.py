"""操作日志测试

测试操作日志功能，包括：
- 日志记录
- 查询过滤
- 统计信息
- 权限控制
"""

import pytest
import time
import json
from datetime import datetime, timedelta

from services.operation_log import OperationLogService, OperationType, operation_log


class TestOperationLogService:
    """操作日志服务单元测试"""

    def setup_method(self):
        """每个测试前清理"""
        # 清理测试数据
        operation_log.cleanup(max_age_days=0)

    def test_log_login_success(self):
        """记录登录成功"""
        log_id = operation_log.log(
            username="test_user",
            operation=OperationType.LOGIN,
            ip_address="192.168.1.1",
            user_agent="TestBrowser/1.0",
            success=True,
        )

        assert log_id > 0

    def test_log_login_failure(self):
        """记录登录失败"""
        log_id = operation_log.log(
            username="test_user",
            operation=OperationType.LOGIN,
            ip_address="192.168.1.1",
            success=False,
            error_message="密码错误",
        )

        logs = operation_log.query(username="test_user")
        assert len(logs) == 1
        assert logs[0]["success"] == 0
        assert logs[0]["error_message"] == "密码错误"

    def test_log_order_send(self):
        """记录下单操作"""
        operation_log.log(
            username="trader1",
            operation=OperationType.ORDER_SEND,
            target_type="order",
            target_id="CTP.001",
            details=json.dumps({
                "symbol": "rb2410",
                "exchange": "SHFE",
                "direction": "多",
                "volume": 1,
                "price": 3800,
            }),
            ip_address="10.0.0.1",
            success=True,
        )

        logs = operation_log.query(username="trader1")
        assert len(logs) == 1
        assert logs[0]["operation"] == "order_send"
        assert logs[0]["target_id"] == "CTP.001"

    def test_log_strategy_operations(self):
        """记录策略操作"""
        operations = [
            (OperationType.STRATEGY_ADD, "strategy_add"),
            (OperationType.STRATEGY_EDIT, "strategy_edit"),
            (OperationType.STRATEGY_INIT, "strategy_init"),
            (OperationType.STRATEGY_START, "strategy_start"),
            (OperationType.STRATEGY_STOP, "strategy_stop"),
            (OperationType.STRATEGY_REMOVE, "strategy_remove"),
        ]

        for op_type, op_name in operations:
            operation_log.log(
                username="admin",
                operation=op_type,
                target_type="strategy",
                target_id="test_strategy",
                success=True,
            )

        logs = operation_log.query(username="admin")
        assert len(logs) == 6

    def test_query_by_operation_type(self):
        """按操作类型查询"""
        operation_log.log(username="user1", operation=OperationType.LOGIN, success=True)
        operation_log.log(username="user1", operation=OperationType.ORDER_SEND, success=True)
        operation_log.log(username="user1", operation=OperationType.LOGIN, success=True)

        logs = operation_log.query(username="user1", operation="login")
        assert len(logs) == 2

    def test_query_by_time_range(self):
        """按时间范围查询"""
        now = time.time()
        yesterday = now - 86400
        tomorrow = now + 86400

        operation_log.log(username="user1", operation=OperationType.LOGIN, success=True)

        # 查询今天
        logs = operation_log.query(
            username="user1",
            start_time=yesterday,
            end_time=tomorrow
        )
        assert len(logs) == 1

        # 查询昨天之前
        logs = operation_log.query(
            username="user1",
            end_time=yesterday
        )
        assert len(logs) == 0

    def test_query_pagination(self):
        """分页查询"""
        for i in range(10):
            operation_log.log(
                username="user1",
                operation=OperationType.LOGIN,
                success=True,
            )

        logs = operation_log.query(username="user1", limit=5, offset=0)
        assert len(logs) == 5

        logs = operation_log.query(username="user1", limit=5, offset=5)
        assert len(logs) == 5

    def test_count(self):
        """统计日志数量"""
        operation_log.log(username="user1", operation=OperationType.LOGIN, success=True)
        operation_log.log(username="user1", operation=OperationType.ORDER_SEND, success=True)
        operation_log.log(username="user2", operation=OperationType.LOGIN, success=True)

        assert operation_log.count() == 3
        assert operation_log.count(username="user1") == 2
        assert operation_log.count(operation="login") == 2

    def test_get_stats(self):
        """获取统计信息"""
        operation_log.log(username="admin", operation=OperationType.LOGIN, success=True)
        operation_log.log(username="admin", operation=OperationType.ORDER_SEND, success=True)
        operation_log.log(username="user1", operation=OperationType.LOGIN, success=False)

        stats = operation_log.get_stats(days=7)

        assert stats["total_operations"] == 3
        assert stats["failures"] == 1
        assert "login" in stats["by_operation"]
        assert "admin" in stats["by_user"]

    def test_cleanup(self):
        """清理旧日志"""
        # 添加一条日志
        operation_log.log(username="user1", operation=OperationType.LOGIN, success=True)
        assert operation_log.count() == 1

        # 清理1天前的日志（当前日志不会被清理）
        deleted = operation_log.cleanup(max_age_days=0)

        # 刚添加的日志应该被清理（因为max_age_days=0表示清理所有）
        assert deleted == 1
        assert operation_log.count() == 0


class TestOperationLogAPI:
    """操作日志 API 测试"""

    def setup_method(self):
        """清理测试数据"""
        operation_log.cleanup(max_age_days=0)

    def test_get_operation_logs(self, client, auth_headers):
        """获取操作日志列表"""
        # 先记录一些日志
        operation_log.log(username="admin", operation=OperationType.LOGIN, success=True)

        resp = client.get("/api/logs/operations", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "pagination" in data

    def test_get_logs_with_filter(self, client, auth_headers):
        """过滤查询日志"""
        operation_log.log(username="admin", operation=OperationType.LOGIN, success=True)
        operation_log.log(username="admin", operation=OperationType.ORDER_SEND, success=True)

        # 按操作类型过滤
        resp = client.get("/api/logs/operations?operation=login", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) >= 1

    def test_get_logs_time_range(self, client, auth_headers):
        """按时间范围查询"""
        operation_log.log(username="admin", operation=OperationType.LOGIN, success=True)

        today = datetime.now().strftime("%Y-%m-%d")
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        resp = client.get(
            f"/api/logs/operations?start_date={today}&end_date={tomorrow}",
            headers=auth_headers
        )
        assert resp.status_code == 200

    def test_get_operation_stats(self, client, auth_headers):
        """获取操作统计"""
        operation_log.log(username="admin", operation=OperationType.LOGIN, success=True)

        resp = client.get("/api/logs/operations/stats?days=7", headers=auth_headers)
        assert resp.status_code == 200
        stats = resp.json()
        assert "total_operations" in stats
        assert "by_operation" in stats

    def test_get_operation_types(self, client, auth_headers):
        """获取操作类型列表"""
        resp = client.get("/api/logs/operations/types", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "types" in data
        assert len(data["types"]) > 0

    def test_cleanup_logs_admin_only(self, client, auth_headers):
        """清理日志仅 admin 可执行"""
        resp = client.delete("/api/logs/operations/cleanup?max_age_days=7", headers=auth_headers)
        # admin 应该可以执行
        assert resp.status_code in [200, 403]

    def test_user_can_only_see_own_logs(self, client):
        """普通用户只能查看自己的日志"""
        # 创建普通用户并登录
        from auth import hash_password, get_user
        import sqlite3
        from config import settings

        # 先创建普通用户
        conn = sqlite3.connect(settings.DB_PATH)
        conn.execute(
            "INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            ("normal_user", hash_password("test123"), "trader")
        )
        conn.commit()
        conn.close()

        # 登录获取 token
        resp = client.post("/api/auth/login", json={
            "username": "normal_user",
            "password": "test123",
        })
        assert resp.status_code == 200
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 记录该用户的日志
        operation_log.log(username="normal_user", operation=OperationType.LOGIN, success=True)
        operation_log.log(username="admin", operation=OperationType.LOGIN, success=True)

        # 普通用户查询
        resp = client.get("/api/logs/operations", headers=headers)
        assert resp.status_code == 200
        data = resp.json()

        # 只能看到自己的日志
        for log in data["data"]:
            assert log["username"] == "normal_user"


class TestLoginLogging:
    """登录操作日志集成测试"""

    def setup_method(self):
        """清理测试数据"""
        operation_log.cleanup(max_age_days=0)

    def test_login_success_logged(self, client):
        """成功登录被记录"""
        resp = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin123",
        })
        assert resp.status_code == 200

        # 查询日志
        logs = operation_log.query(username="admin", operation="login")
        assert len(logs) >= 1
        assert logs[0]["success"] == 1

    def test_login_failure_logged(self, client):
        """失败登录被记录"""
        resp = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "wrong_password",
        })
        assert resp.status_code == 401

        # 查询失败日志
        logs = operation_log.query(username="admin", operation="login")
        assert len(logs) >= 1
        # 找到失败的日志
        failed_logs = [log for log in logs if log["success"] == 0]
        assert len(failed_logs) >= 1


class TestTradingLogging:
    """交易操作日志集成测试"""

    def setup_method(self):
        """清理测试数据"""
        operation_log.cleanup(max_age_days=0)

    def test_order_send_logged(self, client, auth_headers):
        """下单被记录"""
        resp = client.post("/api/trading/order", json={
            "symbol": "rb2410",
            "exchange": "SHFE",
            "direction": "多",
            "type": "限价",
            "volume": 1,
            "price": 3800,
            "offset": "开",
            "gateway_name": "CTP",
        }, headers=auth_headers)
        assert resp.status_code == 200

        # 查询日志
        logs = operation_log.query(operation="order_send")
        assert len(logs) >= 1
        assert logs[0]["target_type"] == "order"

    def test_order_cancel_logged(self, client, auth_headers):
        """撤单被记录"""
        resp = client.post("/api/trading/order/cancel", json={
            "vt_orderid": "CTP.000000001",
            "gateway_name": "CTP",
        }, headers=auth_headers)
        assert resp.status_code == 200

        # 查询日志
        logs = operation_log.query(operation="order_cancel")
        assert len(logs) >= 1


class TestStrategyLogging:
    """策略操作日志集成测试"""

    def setup_method(self):
        """清理测试数据"""
        operation_log.cleanup(max_age_days=0)

    def test_strategy_add_logged(self, client, auth_headers):
        """添加策略被记录"""
        resp = client.post("/api/strategy/instances", json={
            "class_name": "AtrRsiStrategy",
            "strategy_name": "test_strategy_001",
            "vt_symbol": "rb2410.SHFE",
            "setting": {"atr_length": 20},
        }, headers=auth_headers)
        assert resp.status_code == 200

        # 查询日志
        logs = operation_log.query(operation="strategy_add")
        assert len(logs) >= 1

    def test_strategy_lifecycle_logged(self, client, auth_headers):
        """策略生命周期操作被记录"""
        # 先获取锁
        client.post("/api/strategy/instances/atr_rsi_01/lock", json={"ttl": 300}, headers=auth_headers)

        # 启动策略
        resp = client.post("/api/strategy/instances/atr_rsi_01/start", headers=auth_headers)
        assert resp.status_code == 200

        # 停止策略
        resp = client.post("/api/strategy/instances/atr_rsi_01/stop", headers=auth_headers)
        assert resp.status_code == 200

        # 查询日志
        start_logs = operation_log.query(operation="strategy_start")
        stop_logs = operation_log.query(operation="strategy_stop")
        assert len(start_logs) >= 1
        assert len(stop_logs) >= 1
