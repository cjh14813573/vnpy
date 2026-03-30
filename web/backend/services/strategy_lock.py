"""策略锁服务 - 防止多用户同时操作同一策略

实现基于内存的策略锁，支持：
- 获取锁（带过期时间）
- 释放锁（需验证持有者）
- 强制释放（admin权限）
- 自动过期清理
"""

import threading
import time
from dataclasses import dataclass, field
from typing import Optional, Dict


@dataclass
class LockInfo:
    """锁信息"""
    strategy_name: str
    user_id: str
    acquired_at: float = field(default_factory=time.time)
    expires_at: float = field(default_factory=lambda: time.time() + 300)  # 默认5分钟


class StrategyLockService:
    """策略锁服务（线程安全单例）"""

    _instance: Optional["StrategyLockService"] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self, default_ttl: int = 300):
        """
        Args:
            default_ttl: 默认锁过期时间（秒）
        """
        if self._initialized:
            return
        self._initialized = True

        self._locks: Dict[str, LockInfo] = {}  # strategy_name -> LockInfo
        self._default_ttl = default_ttl
        self._mutex = threading.RLock()

    def acquire(
        self,
        strategy_name: str,
        user_id: str,
        ttl: Optional[int] = None,
        force: bool = False
    ) -> tuple[bool, Optional[str]]:
        """获取策略锁

        Args:
            strategy_name: 策略名称
            user_id: 用户ID
            ttl: 过期时间（秒），默认300
            force: 是否强制获取（会覆盖现有锁）

        Returns:
            (success, message): 是否成功，及提示信息
        """
        with self._mutex:
            # 清理过期锁
            self._cleanup_expired()

            now = time.time()
            expire_time = now + (ttl or self._default_ttl)

            if strategy_name in self._locks:
                existing = self._locks[strategy_name]

                # 如果持有者是自己，续期
                if existing.user_id == user_id:
                    existing.expires_at = expire_time
                    return True, "锁已续期"

                # 如果不强制，返回失败
                if not force:
                    remaining = int(existing.expires_at - now)
                    return False, f"策略已被用户 {existing.user_id} 锁定，剩余 {remaining} 秒"

                # 强制获取，覆盖现有锁
                self._locks[strategy_name] = LockInfo(
                    strategy_name=strategy_name,
                    user_id=user_id,
                    acquired_at=now,
                    expires_at=expire_time
                )
                return True, "已强制获取锁（覆盖原持有者）"

            # 新锁
            self._locks[strategy_name] = LockInfo(
                strategy_name=strategy_name,
                user_id=user_id,
                acquired_at=now,
                expires_at=expire_time
            )
            return True, "锁获取成功"

    def release(self, strategy_name: str, user_id: str, is_admin: bool = False) -> tuple[bool, str]:
        """释放策略锁

        Args:
            strategy_name: 策略名称
            user_id: 用户ID
            is_admin: 是否为admin（可释放他人锁）

        Returns:
            (success, message): 是否成功，及提示信息
        """
        with self._mutex:
            self._cleanup_expired()

            if strategy_name not in self._locks:
                return True, "锁已过期或不存在"

            lock_info = self._locks[strategy_name]

            # 验证持有者或admin
            if lock_info.user_id != user_id and not is_admin:
                return False, f"无权释放，锁持有者为 {lock_info.user_id}"

            del self._locks[strategy_name]
            return True, "锁释放成功"

    def get_lock_holder(self, strategy_name: str) -> Optional[str]:
        """获取锁的持有者

        Returns:
            user_id 或 None（未锁定）
        """
        with self._mutex:
            self._cleanup_expired()

            if strategy_name in self._locks:
                return self._locks[strategy_name].user_id
            return None

    def is_locked_by(self, strategy_name: str, user_id: str) -> bool:
        """检查策略是否被指定用户锁定"""
        with self._mutex:
            self._cleanup_expired()

            if strategy_name in self._locks:
                return self._locks[strategy_name].user_id == user_id
            return False

    def get_all_locks(self, user_id: Optional[str] = None) -> dict:
        """获取所有锁信息

        Args:
            user_id: 如果指定，只返回该用户的锁

        Returns:
            {strategy_name: {"holder": user_id, "expires_at": timestamp, "remaining": seconds}}
        """
        with self._mutex:
            self._cleanup_expired()

            result = {}
            now = time.time()

            for name, info in self._locks.items():
                if user_id and info.user_id != user_id:
                    continue

                result[name] = {
                    "holder": info.user_id,
                    "acquired_at": info.acquired_at,
                    "expires_at": info.expires_at,
                    "remaining": int(info.expires_at - now)
                }

            return result

    def _cleanup_expired(self):
        """清理过期锁（内部方法）"""
        now = time.time()
        expired = [
            name for name, info in self._locks.items()
            if info.expires_at < now
        ]
        for name in expired:
            del self._locks[name]

    def extend_lock(self, strategy_name: str, user_id: str, ttl: int = 300) -> bool:
        """延长锁的过期时间

        Args:
            strategy_name: 策略名称
            user_id: 用户ID
            ttl: 延长的秒数

        Returns:
            是否成功
        """
        with self._mutex:
            self._cleanup_expired()

            if strategy_name not in self._locks:
                return False

            lock_info = self._locks[strategy_name]
            if lock_info.user_id != user_id:
                return False

            lock_info.expires_at = time.time() + ttl
            return True


# 全局单例
lock_service = StrategyLockService()
