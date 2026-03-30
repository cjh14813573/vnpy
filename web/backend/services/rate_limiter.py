"""限流服务 - 基于内存令牌桶算法

支持：
- 按用户限流（已认证用户）
- 按IP限流（未认证请求）
- 按端点单独配置
- 突发流量平滑处理
"""

import time
import threading
from dataclasses import dataclass, field
from typing import Optional
from collections import defaultdict


@dataclass
class TokenBucket:
    """令牌桶"""
    rate: float       # 每秒产生令牌数
    capacity: int     # 桶容量（最大突发）
    tokens: float = field(default=None)  # 初始为None，首次acquire时填满
    last_update: float = field(default_factory=time.time)

    def acquire(self, tokens: int = 1) -> bool:
        """尝试获取令牌

        Args:
            tokens: 需要的令牌数

        Returns:
            是否获取成功
        """
        now = time.time()
        elapsed = now - self.last_update

        # 首次使用时填满桶（允许突发）
        if self.tokens is None:
            self.tokens = self.capacity
        else:
            # 添加新令牌
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_update = now

        # 尝试消费
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    def get_wait_time(self, tokens: int = 1) -> float:
        """计算需要等待的时间"""
        current_tokens = self.tokens if self.tokens is not None else self.capacity
        if current_tokens >= tokens:
            return 0
        needed = tokens - current_tokens
        return needed / self.rate


class RateLimiter:
    """限流器（线程安全单例）"""

    _instance: Optional["RateLimiter"] = None
    _lock = threading.Lock()

    # 默认限流配置
    DEFAULT_RATE = 10      # 每秒10请求
    DEFAULT_CAPACITY = 20  # 突发最多20请求

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

        # 用户限流桶 {user_id: TokenBucket}
        self._user_buckets: dict[str, TokenBucket] = {}
        # IP限流桶 {ip: TokenBucket}
        self._ip_buckets: dict[str, TokenBucket] = {}
        # 端点特定配置 {(method, path): (rate, capacity)}
        self._endpoint_limits: dict[tuple[str, str], tuple[float, int]] = {}

        self._mutex = threading.RLock()
        self._cleanup_interval = 3600  # 1小时清理一次过期桶
        self._last_cleanup = time.time()

    def set_endpoint_limit(self, method: str, path: str, rate: float, capacity: int):
        """设置特定端点的限流

        Args:
            method: HTTP方法 (GET, POST, etc.)
            path: 路径模式 (/api/trading/order)
            rate: 每秒令牌数
            capacity: 桶容量
        """
        with self._mutex:
            self._endpoint_limits[(method.upper(), path)] = (rate, capacity)

    def _get_bucket_key(self, method: str, path: str, user_id: Optional[str], client_ip: str) -> tuple[str, TokenBucket]:
        """确定使用哪个桶

        Returns:
            (桶标识, 是否是用户桶)
        """
        # 优先按用户限流
        if user_id:
            return f"user:{user_id}", True
        # 未认证按IP限流
        return f"ip:{client_ip}", False

    def _get_limit(self, method: str, path: str) -> tuple[float, int]:
        """获取端点的限流配置"""
        with self._mutex:
            # 精确匹配
            if (method.upper(), path) in self._endpoint_limits:
                return self._endpoint_limits[(method.upper(), path)]

            # 前缀匹配（如 /api/trading/*）
            for (m, p), (r, c) in self._endpoint_limits.items():
                if m == method.upper() and path.startswith(p.rstrip('*')):
                    return r, c

            return self.DEFAULT_RATE, self.DEFAULT_CAPACITY

    def is_allowed(self, method: str, path: str, user_id: Optional[str], client_ip: str) -> tuple[bool, dict]:
        """检查请求是否允许

        Args:
            method: HTTP方法
            path: 请求路径
            user_id: 用户ID（已认证）
            client_ip: 客户端IP

        Returns:
            (是否允许, 限流信息头)
        """
        rate, capacity = self._get_limit(method, path)
        bucket_key, is_user = self._get_bucket_key(method, path, user_id, client_ip)

        with self._mutex:
            # 获取或创建桶
            if is_user:
                if bucket_key not in self._user_buckets:
                    self._user_buckets[bucket_key] = TokenBucket(rate, capacity)
                bucket = self._user_buckets[bucket_key]
            else:
                if bucket_key not in self._ip_buckets:
                    self._ip_buckets[bucket_key] = TokenBucket(rate, capacity)
                bucket = self._ip_buckets[bucket_key]

            # 动态调整桶参数（配置可能已更新）
            if bucket.rate != rate or bucket.capacity != capacity:
                bucket.rate = rate
                bucket.capacity = capacity

            # 尝试获取令牌
            allowed = bucket.acquire(1)

            # 计算限流头信息
            headers = {
                "X-RateLimit-Limit": str(int(rate)),
                "X-RateLimit-Remaining": str(max(0, int(bucket.tokens))),
                "X-RateLimit-Reset": str(int(time.time() + bucket.get_wait_time(1) + 1)),
            }

            if not allowed:
                headers["Retry-After"] = str(int(bucket.get_wait_time(1)) + 1)

        # 定期清理过期桶
        self._maybe_cleanup()

        return allowed, headers

    def _maybe_cleanup(self):
        """定期清理长时间未使用的桶"""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return

        with self._mutex:
            # 清理空桶（这里简单处理，实际可根据最后访问时间）
            # 实际生产环境应记录 last_access_time
            pass

        self._last_cleanup = now

    def get_stats(self) -> dict:
        """获取限流统计"""
        with self._mutex:
            return {
                "user_buckets": len(self._user_buckets),
                "ip_buckets": len(self._ip_buckets),
                "endpoint_limits": len(self._endpoint_limits),
                "default_rate": self.DEFAULT_RATE,
                "default_capacity": self.DEFAULT_CAPACITY,
            }


# 全局单例
rate_limiter = RateLimiter()
