"""WebSocket 连接管理器（带订阅管理）

支持：
- 客户端连接管理
- 按客户端订阅管理（合约级别的行情订阅）
- 心跳检测
- 定向推送和广播
"""

import asyncio
import json
import time
from typing import Any, Optional

from fastapi import WebSocket


class ConnectionInfo:
    """连接信息"""
    def __init__(self, client_id: str, websocket: WebSocket, username: str):
        self.client_id = client_id
        self.websocket = websocket
        self.username = username
        self.subscriptions: set[str] = set()  # 订阅的 vt_symbol 集合
        self.last_ping: float = time.time()
        self.connected_at: float = time.time()

    def subscribe(self, symbols: list[str]):
        """订阅合约"""
        self.subscriptions.update(symbols)

    def unsubscribe(self, symbols: list[str]):
        """取消订阅"""
        self.subscriptions.difference_update(symbols)

    def is_subscribed(self, symbol: str) -> bool:
        """检查是否订阅了指定合约"""
        return symbol in self.subscriptions

    def get_subscriptions(self) -> list[str]:
        """获取所有订阅"""
        return list(self.subscriptions)


class ConnectionManager:
    """WebSocket 连接管理（带订阅管理）"""

    def __init__(self):
        self._connections: dict[str, ConnectionInfo] = {}
        self._lock = asyncio.Lock()
        self._heartbeat_interval = 30  # 心跳检测间隔（秒）
        self._heartbeat_timeout = 60   # 心跳超时时间（秒）

    async def connect(self, websocket: WebSocket, client_id: str, username: str) -> ConnectionInfo:
        """接受连接"""
        await websocket.accept()
        async with self._lock:
            conn_info = ConnectionInfo(client_id, websocket, username)
            self._connections[client_id] = conn_info
            return conn_info

    async def disconnect(self, client_id: str):
        """断开连接"""
        async with self._lock:
            self._connections.pop(client_id, None)

    def get_connection(self, client_id: str) -> Optional[ConnectionInfo]:
        """获取连接信息"""
        return self._connections.get(client_id)

    async def subscribe(self, client_id: str, symbols: list[str]) -> bool:
        """客户端订阅合约"""
        async with self._lock:
            conn = self._connections.get(client_id)
            if not conn:
                return False
            conn.subscribe(symbols)
            return True

    async def unsubscribe(self, client_id: str, symbols: list[str]) -> bool:
        """客户端取消订阅"""
        async with self._lock:
            conn = self._connections.get(client_id)
            if not conn:
                return False
            conn.unsubscribe(symbols)
            return True

    async def get_subscriptions(self, client_id: str) -> Optional[list[str]]:
        """获取客户端订阅列表"""
        async with self._lock:
            conn = self._connections.get(client_id)
            if not conn:
                return None
            return conn.get_subscriptions()

    async def send_personal(self, client_id: str, message: dict[str, Any]) -> bool:
        """发送给指定客户端"""
        conn = self._connections.get(client_id)
        if not conn:
            return False
        try:
            await conn.websocket.send_json(message)
            return True
        except Exception:
            await self.disconnect(client_id)
            return False

    async def broadcast(self, message: dict[str, Any]):
        """广播给所有连接（全量广播）"""
        disconnected = []
        for client_id, conn in self._connections.items():
            try:
                await conn.websocket.send_json(message)
            except Exception:
                disconnected.append(client_id)

        for client_id in disconnected:
            await self.disconnect(client_id)

    async def broadcast_to_subscribers(self, symbol: str, message: dict[str, Any]):
        """推送给订阅了指定合约的客户端"""
        disconnected = []
        for client_id, conn in self._connections.items():
            if conn.is_subscribed(symbol):
                try:
                    await conn.websocket.send_json(message)
                except Exception:
                    disconnected.append(client_id)

        for client_id in disconnected:
            await self.disconnect(client_id)

    async def broadcast_event(self, topic: str, data: dict, symbol: Optional[str] = None):
        """广播事件

        Args:
            topic: 事件类型 (tick, order, trade, etc.)
            data: 事件数据
            symbol: 关联的合约代码（如果有），用于订阅过滤
        """
        message = {
            "type": "event",
            "topic": topic,
            "data": data,
            "timestamp": time.time()
        }

        if symbol:
            # 只推送给订阅了该合约的客户端
            await self.broadcast_to_subscribers(symbol, message)
        else:
            # 全量广播（日志、系统消息等）
            await self.broadcast(message)

    async def send_pong(self, client_id: str):
        """发送心跳响应"""
        await self.send_personal(client_id, {
            "type": "pong",
            "timestamp": time.time()
        })

    async def check_heartbeat(self):
        """检查所有连接的心跳，断开超时的客户端"""
        now = time.time()
        disconnected = []

        async with self._lock:
            for client_id, conn in self._connections.items():
                if now - conn.last_ping > self._heartbeat_timeout:
                    disconnected.append(client_id)

        for client_id in disconnected:
            await self.disconnect(client_id)

    def update_heartbeat(self, client_id: str):
        """更新客户端心跳时间"""
        conn = self._connections.get(client_id)
        if conn:
            conn.last_ping = time.time()

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    def get_client_ids(self) -> list[str]:
        return list(self._connections.keys())

    def get_stats(self) -> dict:
        """获取连接统计"""
        return {
            "total_connections": len(self._connections),
            "clients": [
                {
                    "client_id": cid,
                    "username": conn.username,
                    "subscriptions": len(conn.subscriptions),
                    "connected_at": conn.connected_at,
                    "last_ping": conn.last_ping
                }
                for cid, conn in self._connections.items()
            ]
        }


# 全局实例
ws_manager = ConnectionManager()
