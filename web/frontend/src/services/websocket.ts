/**
 * WebSocket服务 - 实时数据连接
 *
 * 功能：
 * - 自动连接/重连
 * - 心跳检测
 * - 订阅管理
 * - 消息分发
 */

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useRealtimeStore } from '../stores/realtimeStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
const RECONNECT_INTERVAL = 3000;
const HEARTBEAT_INTERVAL = 30000;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: Set<string> = new Set();
  private isConnecting = false;
  private token: string | null = null;

  // 连接状态回调
  private onConnectCallbacks: (() => void)[] = [];
  private onDisconnectCallbacks: (() => void)[] = [];
  private onErrorCallbacks: ((error: Event) => void)[] = [];

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string | null) {
    this.token = token;
  }

  connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    // 更新 store 中的连接状态
    const store = useRealtimeStore.getState();
    store.setConnectionState('connecting');

    const token = this.token || localStorage.getItem('token');
    if (!token) {
      console.warn('[WebSocket] No token available');
      this.isConnecting = false;
      return;
    }

    const url = `${WS_URL}?token=${token}`;
    console.log('[WebSocket] Connecting...');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.isConnecting = false;
        this.startHeartbeat();
        this.onConnectCallbacks.forEach(cb => cb());

        // 更新 store 中的连接状态
        const store = useRealtimeStore.getState();
        store.setConnectionState('connected');

        // 恢复订阅
        if (this.subscriptions.size > 0) {
          this.subscribe(Array.from(this.subscriptions));
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.isConnecting = false;
        this.stopHeartbeat();
        this.onDisconnectCallbacks.forEach(cb => cb());

        // 更新 store 中的连接状态
        const store = useRealtimeStore.getState();
        store.setConnectionState('disconnected');

        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.isConnecting = false;
        this.onErrorCallbacks.forEach(cb => cb(error));
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    console.log(`[WebSocket] Reconnecting in ${RECONNECT_INTERVAL}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_INTERVAL);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  subscribe(symbols: string[]) {
    symbols.forEach(s => this.subscriptions.add(s));
    this.send({ type: 'subscribe', symbols });
  }

  unsubscribe(symbols: string[]) {
    symbols.forEach(s => this.subscriptions.delete(s));
    this.send({ type: 'unsubscribe', symbols });
  }

  onConnect(callback: () => void) {
    this.onConnectCallbacks.push(callback);
    return () => {
      const index = this.onConnectCallbacks.indexOf(callback);
      if (index > -1) this.onConnectCallbacks.splice(index, 1);
    };
  }

  onDisconnect(callback: () => void) {
    this.onDisconnectCallbacks.push(callback);
    return () => {
      const index = this.onDisconnectCallbacks.indexOf(callback);
      if (index > -1) this.onDisconnectCallbacks.splice(index, 1);
    };
  }

  onError(callback: (error: Event) => void) {
    this.onErrorCallbacks.push(callback);
    return () => {
      const index = this.onErrorCallbacks.indexOf(callback);
      if (index > -1) this.onErrorCallbacks.splice(index, 1);
    };
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);
      const store = useRealtimeStore.getState();

      switch (msg.type) {
        case 'event':
          this.handleEventMessage(msg.topic, msg.data);
          break;
        case 'backtest_progress':
          store.setBacktestProgress(msg.task_id, msg.progress, msg.message);
          break;
        case 'pong':
          // 心跳响应
          break;
        case 'subscribe_response':
          console.log('[WebSocket] Subscribed:', msg.subscribed);
          break;
        default:
          console.log('[WebSocket] Unknown message:', msg);
      }
    } catch (error) {
      console.error('[WebSocket] Parse error:', error);
    }
  }

  private handleEventMessage(topic: string, data: Record<string, unknown>) {
    const store = useRealtimeStore.getState();
    const d = data as any;

    switch (topic) {
      case 'tick':
        store.updateTick(d.vt_symbol, d);
        break;
      case 'order':
        store.updateOrder(d.vt_orderid, d);
        break;
      case 'trade':
        store.addTrade(d);
        break;
      case 'position':
        store.updatePosition(d.vt_symbol, d);
        break;
      case 'account':
        store.updateAccount(d.vt_accountid, d);
        break;
      case 'log':
        store.addLog(d);
        break;
      case 'contract':
        store.updateContract(d.vt_symbol, d);
        break;
    }
  }

  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (this.isConnecting) return 'connecting';
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
    return 'disconnected';
  }
}

// 单例实例
export const wsService = new WebSocketService();

// React Hook - 在组件中使用
export function useWebSocket() {
  const store = useRealtimeStore();
  const token = useAuthStore(s => s.token);

  useEffect(() => {
    if (token) {
      wsService.setToken(token);
      wsService.connect();
    }

    return () => {
      // 组件卸载时不断开，保持全局连接
    };
  }, [token]);

  return {
    subscribe: useCallback((symbols: string[]) => wsService.subscribe(symbols), []),
    unsubscribe: useCallback((symbols: string[]) => wsService.unsubscribe(symbols), []),
    connectionState: store.connectionState,
  };
}

// Hook - 监听特定合约的tick
export function useTick(vtSymbol: string) {
  const tick = useRealtimeStore(s => s.ticks[vtSymbol]);

  useEffect(() => {
    if (vtSymbol) {
      wsService.subscribe([vtSymbol]);
      return () => {
        wsService.unsubscribe([vtSymbol]);
      };
    }
  }, [vtSymbol]);

  return tick;
}

// Hook - 监听所有订单
export function useOrders() {
  return useRealtimeStore(s => Object.values(s.orders));
}

// Hook - 监听所有成交
export function useTrades() {
  return useRealtimeStore(s => s.trades);
}
