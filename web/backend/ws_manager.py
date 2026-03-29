"""WebSocket 连接管理器"""

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """WebSocket 连接管理"""

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: str):
        """接受连接"""
        await websocket.accept()
        async with self._lock:
            self._connections[client_id] = websocket

    async def disconnect(self, client_id: str):
        """断开连接"""
        async with self._lock:
            self._connections.pop(client_id, None)

    async def send_personal(self, client_id: str, message: dict[str, Any]):
        """发送给指定客户端"""
        ws = self._connections.get(client_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                await self.disconnect(client_id)

    async def broadcast(self, message: dict[str, Any]):
        """广播给所有连接"""
        disconnected = []
        for client_id, ws in self._connections.items():
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(client_id)

        for client_id in disconnected:
            await self.disconnect(client_id)

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    def get_client_ids(self) -> list[str]:
        return list(self._connections.keys())


# 全局实例
ws_manager = ConnectionManager()
