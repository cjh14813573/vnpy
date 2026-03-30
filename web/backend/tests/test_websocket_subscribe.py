"""WebSocket 订阅管理测试

测试 WebSocket 订阅管理功能，包括：
- 订阅/取消订阅合约
- 按订阅过滤推送
- 心跳检测
- 获取订阅列表
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from ws_manager import ConnectionManager, ConnectionInfo


class TestConnectionInfo:
    """连接信息单元测试"""

    def test_subscribe(self):
        """订阅合约"""
        conn = ConnectionInfo("test_id", MagicMock(), "test_user")
        conn.subscribe(["rb2410.SHFE", "cu2505.SHFE"])

        assert conn.is_subscribed("rb2410.SHFE")
        assert conn.is_subscribed("cu2505.SHFE")
        assert not conn.is_subscribed("au2412.SHFE")

    def test_unsubscribe(self):
        """取消订阅"""
        conn = ConnectionInfo("test_id", MagicMock(), "test_user")
        conn.subscribe(["rb2410.SHFE", "cu2505.SHFE"])
        conn.unsubscribe(["cu2505.SHFE"])

        assert conn.is_subscribed("rb2410.SHFE")
        assert not conn.is_subscribed("cu2505.SHFE")

    def test_get_subscriptions(self):
        """获取订阅列表"""
        conn = ConnectionInfo("test_id", MagicMock(), "test_user")
        conn.subscribe(["rb2410.SHFE", "cu2505.SHFE"])

        subs = conn.get_subscriptions()
        assert len(subs) == 2
        assert "rb2410.SHFE" in subs
        assert "cu2505.SHFE" in subs


class TestConnectionManager:
    """连接管理器单元测试"""

    @pytest.fixture
    def manager(self):
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        mock = MagicMock()
        mock.send_json = AsyncMock()
        mock.accept = AsyncMock()
        return mock

    @pytest.mark.asyncio
    async def test_connect(self, manager, mock_websocket):
        """连接管理"""
        conn_info = await manager.connect(mock_websocket, "client1", "user1")

        assert conn_info.client_id == "client1"
        assert conn_info.username == "user1"
        assert manager.connection_count == 1
        mock_websocket.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_disconnect(self, manager, mock_websocket):
        """断开连接"""
        await manager.connect(mock_websocket, "client1", "user1")
        await manager.disconnect("client1")

        assert manager.connection_count == 0

    @pytest.mark.asyncio
    async def test_subscribe(self, manager, mock_websocket):
        """订阅合约"""
        await manager.connect(mock_websocket, "client1", "user1")

        success = await manager.subscribe("client1", ["rb2410.SHFE", "cu2505.SHFE"])
        assert success is True

        subs = await manager.get_subscriptions("client1")
        assert len(subs) == 2

    @pytest.mark.asyncio
    async def test_subscribe_nonexistent_client(self, manager):
        """订阅不存在的客户端"""
        success = await manager.subscribe("nonexistent", ["rb2410.SHFE"])
        assert success is False

    @pytest.mark.asyncio
    async def test_unsubscribe(self, manager, mock_websocket):
        """取消订阅"""
        await manager.connect(mock_websocket, "client1", "user1")
        await manager.subscribe("client1", ["rb2410.SHFE", "cu2505.SHFE"])

        success = await manager.unsubscribe("client1", ["cu2505.SHFE"])
        assert success is True

        subs = await manager.get_subscriptions("client1")
        assert len(subs) == 1
        assert "rb2410.SHFE" in subs

    @pytest.mark.asyncio
    async def test_broadcast_to_subscribers(self, manager, mock_websocket):
        """按订阅过滤广播"""
        # 创建两个连接
        mock_ws2 = MagicMock()
        mock_ws2.send_json = AsyncMock()
        mock_ws2.accept = AsyncMock()

        await manager.connect(mock_websocket, "client1", "user1")
        await manager.connect(mock_ws2, "client2", "user2")

        # client1 订阅 rb2410，client2 订阅 cu2505
        await manager.subscribe("client1", ["rb2410.SHFE"])
        await manager.subscribe("client2", ["cu2505.SHFE"])

        # 广播 rb2410 的行情
        await manager.broadcast_to_subscribers("rb2410.SHFE", {"price": 3800})

        # client1 应该收到，client2 不应该收到
        mock_websocket.send_json.assert_called_with({"price": 3800})
        mock_ws2.send_json.assert_not_called()

    @pytest.mark.asyncio
    async def test_broadcast_event_with_symbol(self, manager, mock_websocket):
        """广播带 symbol 的事件"""
        await manager.connect(mock_websocket, "client1", "user1")
        await manager.subscribe("client1", ["rb2410.SHFE"])

        await manager.broadcast_event("tick", {"price": 3800}, "rb2410.SHFE")

        mock_websocket.send_json.assert_called_once()
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == "event"
        assert call_args["topic"] == "tick"
        assert call_args["data"]["price"] == 3800

    @pytest.mark.asyncio
    async def test_broadcast_event_without_symbol(self, manager, mock_websocket):
        """广播不带 symbol 的事件（全量广播）"""
        await manager.connect(mock_websocket, "client1", "user1")

        await manager.broadcast_event("log", {"msg": "test"}, None)

        mock_websocket.send_json.assert_called_once()
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["topic"] == "log"

    @pytest.mark.asyncio
    async def test_send_pong(self, manager, mock_websocket):
        """发送心跳响应"""
        await manager.connect(mock_websocket, "client1", "user1")

        await manager.send_pong("client1")

        mock_websocket.send_json.assert_called_once()
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == "pong"
        assert "timestamp" in call_args

    def test_update_heartbeat(self, manager, mock_websocket):
        """更新心跳时间"""
        import time

        conn = ConnectionInfo("client1", mock_websocket, "user1")
        old_ping = conn.last_ping

        # 等待一小段时间
        time.sleep(0.01)

        manager._connections["client1"] = conn
        manager.update_heartbeat("client1")

        assert conn.last_ping > old_ping

    def test_get_stats(self, manager, mock_websocket):
        """获取连接统计"""
        manager._connections["client1"] = ConnectionInfo("client1", mock_websocket, "user1")
        manager._connections["client1"].subscribe(["rb2410.SHFE"])

        stats = manager.get_stats()

        assert stats["total_connections"] == 1
        assert len(stats["clients"]) == 1
        assert stats["clients"][0]["subscriptions"] == 1


class TestWebSocketSubscribeAPI:
    """WebSocket 订阅管理 API 集成测试

    注意：这些测试需要实际运行的服务器，通常在开发环境手动测试
    """

    @pytest.mark.skip(reason="需要运行中的服务器，手动测试")
    @pytest.mark.asyncio
    async def test_websocket_subscribe_flow(self, client, auth_headers):
        """WebSocket 订阅流程测试"""
        pass

    @pytest.mark.skip(reason="需要运行中的服务器，手动测试")
    @pytest.mark.asyncio
    async def test_websocket_ping_pong(self, client, auth_headers):
        """WebSocket 心跳测试"""
        pass


# 同步测试（不使用 asyncio）
class TestWebSocketSync:
    """同步 WebSocket 测试"""

    def test_connection_manager_init(self):
        """连接管理器初始化"""
        manager = ConnectionManager()
        assert manager.connection_count == 0
        assert manager._heartbeat_interval == 30
        assert manager._heartbeat_timeout == 60
