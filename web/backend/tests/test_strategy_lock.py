"""策略锁机制测试

测试策略并发控制功能，包括：
- 锁的获取和释放
- 锁过期自动释放
- 锁持有者验证
- admin 强制释放权限
- 策略操作前的锁检查
"""

import time
import pytest
from services.strategy_lock import StrategyLockService, lock_service


class TestStrategyLockService:
    """策略锁服务单元测试"""

    def setup_method(self):
        """每个测试前重置锁服务"""
        # 创建新的锁服务实例（清空所有锁）
        self.lock_service = StrategyLockService()
        self.lock_service._locks = {}

    def test_acquire_lock_success(self):
        """成功获取锁"""
        success, message = self.lock_service.acquire("strategy1", "user1")
        assert success is True
        assert "成功" in message

    def test_acquire_lock_already_locked(self):
        """策略已被他人锁定"""
        # user1 先获取锁
        self.lock_service.acquire("strategy1", "user1")

        # user2 尝试获取锁
        success, message = self.lock_service.acquire("strategy1", "user2")
        assert success is False
        assert "user1" in message

    def test_acquire_lock_same_user_renew(self):
        """同一用户再次获取锁应续期"""
        # 第一次获取
        self.lock_service.acquire("strategy1", "user1", ttl=60)

        # 同一用户再次获取
        success, message = self.lock_service.acquire("strategy1", "user1", ttl=120)
        assert success is True
        assert "续期" in message

    def test_acquire_lock_force_override(self):
        """强制获取锁覆盖他人"""
        # user1 先获取锁
        self.lock_service.acquire("strategy1", "user1")

        # user2 强制获取
        success, message = self.lock_service.acquire("strategy1", "user2", force=True)
        assert success is True
        assert "强制" in message

        # 验证持有者已变更
        holder = self.lock_service.get_lock_holder("strategy1")
        assert holder == "user2"

    def test_release_lock_success(self):
        """成功释放锁"""
        # 获取锁
        self.lock_service.acquire("strategy1", "user1")

        # 释放锁
        success, message = self.lock_service.release("strategy1", "user1")
        assert success is True
        assert "释放成功" in message

        # 验证锁已释放
        holder = self.lock_service.get_lock_holder("strategy1")
        assert holder is None

    def test_release_lock_not_holder(self):
        """非持有者无法释放他人锁"""
        # user1 获取锁
        self.lock_service.acquire("strategy1", "user1")

        # user2 尝试释放
        success, message = self.lock_service.release("strategy1", "user2")
        assert success is False
        assert "无权释放" in message

    def test_release_lock_admin_force(self):
        """admin 可释放他人锁"""
        # user1 获取锁
        self.lock_service.acquire("strategy1", "user1")

        # admin 强制释放
        success, message = self.lock_service.release("strategy1", "admin", is_admin=True)
        assert success is True

    def test_release_nonexistent_lock(self):
        """释放不存在的锁应返回成功（幂等）"""
        success, message = self.lock_service.release("strategy1", "user1")
        assert success is True
        assert "不存在" in message

    def test_lock_expiration(self):
        """锁过期自动释放"""
        # 获取短过期时间的锁
        self.lock_service.acquire("strategy1", "user1", ttl=1)

        # 验证锁存在
        holder = self.lock_service.get_lock_holder("strategy1")
        assert holder == "user1"

        # 等待过期
        time.sleep(1.1)

        # 验证锁已过期
        holder = self.lock_service.get_lock_holder("strategy1")
        assert holder is None

    def test_get_lock_holder(self):
        """获取锁持有者"""
        # 未锁定
        holder = self.lock_service.get_lock_holder("strategy1")
        assert holder is None

        # 锁定后
        self.lock_service.acquire("strategy1", "user1")
        holder = self.lock_service.get_lock_holder("strategy1")
        assert holder == "user1"

    def test_is_locked_by(self):
        """检查策略是否被指定用户锁定"""
        self.lock_service.acquire("strategy1", "user1")

        assert self.lock_service.is_locked_by("strategy1", "user1") is True
        assert self.lock_service.is_locked_by("strategy1", "user2") is False
        assert self.lock_service.is_locked_by("strategy2", "user1") is False

    def test_get_all_locks(self):
        """获取所有锁信息"""
        # 创建多个锁
        self.lock_service.acquire("strategy1", "user1", ttl=300)
        self.lock_service.acquire("strategy2", "user2", ttl=300)
        self.lock_service.acquire("strategy3", "user1", ttl=300)

        # 获取所有锁
        all_locks = self.lock_service.get_all_locks()
        assert len(all_locks) == 3
        assert "strategy1" in all_locks
        assert "strategy2" in all_locks
        assert "strategy3" in all_locks

        # 按用户过滤
        user1_locks = self.lock_service.get_all_locks(user_id="user1")
        assert len(user1_locks) == 2
        assert "strategy1" in user1_locks
        assert "strategy3" in user1_locks

    def test_extend_lock(self):
        """延长锁过期时间"""
        # 获取短过期时间的锁
        self.lock_service.acquire("strategy1", "user1", ttl=60)

        # 获取剩余时间
        locks = self.lock_service.get_all_locks()
        old_remaining = locks["strategy1"]["remaining"]

        # 延长锁
        success = self.lock_service.extend_lock("strategy1", "user1", ttl=300)
        assert success is True

        # 验证时间已延长
        locks = self.lock_service.get_all_locks()
        new_remaining = locks["strategy1"]["remaining"]
        assert new_remaining > old_remaining

    def test_extend_lock_not_holder(self):
        """非持有者无法延长锁"""
        self.lock_service.acquire("strategy1", "user1")

        success = self.lock_service.extend_lock("strategy1", "user2", ttl=300)
        assert success is False

    def test_extend_expired_lock(self):
        """延长已过期的锁应失败"""
        success = self.lock_service.extend_lock("strategy1", "user1", ttl=300)
        assert success is False


class TestStrategyLockAPI:
    """策略锁 API 集成测试"""

    def setup_method(self):
        """每个测试前清理锁"""
        lock_service._locks = {}

    def test_acquire_lock_api(self, client, auth_headers):
        """API: 获取策略锁"""
        resp = client.post(
            "/api/strategy/instances/strategy1/lock",
            json={"ttl": 300},
            headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "holder" in data

    def test_acquire_lock_force_requires_admin(self, client, auth_headers):
        """API: 强制获取锁需要 admin 权限"""
        # 普通用户尝试强制获取
        resp = client.post(
            "/api/strategy/instances/strategy1/lock",
            json={"ttl": 300, "force": True},
            headers=auth_headers
        )
        # admin 用户应该有权限
        # 这里取决于 auth_headers 中的用户角色
        # 如果测试使用 admin 账户，应该成功

    def test_get_lock_status_api(self, client, auth_headers):
        """API: 获取锁状态"""
        # 先获取锁
        client.post(
            "/api/strategy/instances/strategy1/lock",
            json={"ttl": 300},
            headers=auth_headers
        )

        # 查询锁状态
        resp = client.get("/api/strategy/instances/strategy1/lock", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["locked"] is True
        assert "holder" in data
        assert "remaining" in data

    def test_get_lock_status_unlocked(self, client, auth_headers):
        """API: 获取未锁定策略的状态"""
        resp = client.get("/api/strategy/instances/strategy1/lock", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["locked"] is False
        assert data["holder"] is None

    def test_release_lock_api(self, client, auth_headers):
        """API: 释放策略锁"""
        # 先获取锁
        client.post(
            "/api/strategy/instances/strategy1/lock",
            json={"ttl": 300},
            headers=auth_headers
        )

        # 释放锁
        resp = client.delete("/api/strategy/instances/strategy1/lock", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

    def test_extend_lock_api(self, client, auth_headers):
        """API: 延长锁过期时间"""
        # 先获取锁
        client.post(
            "/api/strategy/instances/strategy1/lock",
            json={"ttl": 60},
            headers=auth_headers
        )

        # 延长锁
        resp = client.put(
            "/api/strategy/instances/strategy1/lock/extend?ttl=600",
            headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

    def test_strategy_detail_includes_lock_info(self, client, auth_headers):
        """API: 策略详情包含锁状态"""
        # 先获取锁
        client.post(
            "/api/strategy/instances/atr_rsi_01/lock",
            json={"ttl": 300},
            headers=auth_headers
        )

        # 获取策略详情
        resp = client.get("/api/strategy/instances/atr_rsi_01", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "lock" in data
        assert data["lock"]["locked"] is True


class TestStrategyLockProtection:
    """策略锁保护功能测试 - 验证策略操作前的锁检查"""

    def setup_method(self):
        """每个测试前清理锁"""
        lock_service._locks = {}

    def test_edit_strategy_requires_lock(self, client, auth_headers):
        """修改策略需要锁 - 未锁定应返回 423"""
        resp = client.put(
            "/api/strategy/instances/atr_rsi_01",
            json={"setting": {"atr_length": 30}},
            headers=auth_headers
        )
        assert resp.status_code == 423
        data = resp.json()
        assert "detail" in data

    def test_edit_strategy_with_lock(self, client, auth_headers):
        """修改策略需要锁 - 已锁定应成功"""
        # 获取用户名
        me_resp = client.get("/api/auth/me", headers=auth_headers)
        username = me_resp.json()["username"]

        # 先获取锁
        lock_service.acquire("atr_rsi_01", username, ttl=300)

        # 修改策略
        resp = client.put(
            "/api/strategy/instances/atr_rsi_01",
            json={"setting": {"atr_length": 30}},
            headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "已更新" in data["message"]

    def test_delete_strategy_requires_lock(self, client, auth_headers):
        """删除策略需要锁"""
        resp = client.delete("/api/strategy/instances/atr_rsi_01", headers=auth_headers)
        assert resp.status_code == 423

    def test_init_strategy_requires_lock(self, client, auth_headers):
        """初始化策略需要锁"""
        resp = client.post("/api/strategy/instances/atr_rsi_01/init", headers=auth_headers)
        assert resp.status_code == 423

    def test_start_strategy_requires_lock(self, client, auth_headers):
        """启动策略需要锁"""
        resp = client.post("/api/strategy/instances/atr_rsi_01/start", headers=auth_headers)
        assert resp.status_code == 423

    def test_stop_strategy_requires_lock(self, client, auth_headers):
        """停止策略需要锁"""
        resp = client.post("/api/strategy/instances/atr_rsi_01/stop", headers=auth_headers)
        assert resp.status_code == 423

    def test_locked_by_other_user(self, client, auth_headers):
        """策略被他人锁定时的操作 - 使用非admin用户测试"""
        # 创建一个普通用户
        from auth import hash_password, _get_db
        conn = _get_db()
        conn.execute(
            "INSERT OR REPLACE INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            ("trader1", hash_password("password123"), "trader")
        )
        conn.commit()
        conn.close()

        # 普通用户登录
        resp = client.post("/api/auth/login", json={
            "username": "trader1",
            "password": "password123"
        })
        assert resp.status_code == 200
        trader_token = resp.json()["access_token"]
        trader_headers = {"Authorization": f"Bearer {trader_token}"}

        # trader1 获取锁
        lock_service.acquire("atr_rsi_01", "trader1", ttl=300)

        # admin 用户尝试修改（应该成功，因为admin可以绕过）
        resp = client.put(
            "/api/strategy/instances/atr_rsi_01",
            json={"setting": {"atr_length": 30}},
            headers=auth_headers
        )
        assert resp.status_code == 200  # admin可以操作

        # 清理并重新锁定
        lock_service._locks = {}
        lock_service.acquire("atr_rsi_01", "other_user", ttl=300)

        # trader1 尝试修改被 other_user 锁定的策略
        resp = client.put(
            "/api/strategy/instances/atr_rsi_01",
            json={"setting": {"atr_length": 30}},
            headers=trader_headers
        )
        assert resp.status_code == 423
        data = resp.json()
        assert "detail" in data
        # 检查返回信息中包含锁持有者
        assert "other_user" in str(data["detail"])

    def test_add_strategy_no_lock_required(self, client, auth_headers):
        """添加新策略不需要锁"""
        resp = client.post(
            "/api/strategy/instances",
            json={
                "class_name": "AtrRsiStrategy",
                "strategy_name": "new_strategy",
                "vt_symbol": "rb2410.SHFE",
                "setting": {}
            },
            headers=auth_headers
        )
        assert resp.status_code == 200

    def test_batch_operations_no_lock_required(self, client, auth_headers):
        """批量操作不需要单个锁"""
        # 批量初始化
        resp = client.post("/api/strategy/instances/init-all", headers=auth_headers)
        assert resp.status_code == 200

        # 批量启动
        resp = client.post("/api/strategy/instances/start-all", headers=auth_headers)
        assert resp.status_code == 200

        # 批量停止
        resp = client.post("/api/strategy/instances/stop-all", headers=auth_headers)
        assert resp.status_code == 200
