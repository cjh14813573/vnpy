import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

interface WSMessage {
  type: string;
  topic?: string;
  data?: any;
  timestamp?: number;
}

export function useWebSocket(handlers?: Record<string, (data: any) => void>) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const reconnectTimer = useRef<number>(0);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = `${WS_URL}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      // 心跳
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
      (ws as any)._pingInterval = pingInterval;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setLastMessage(msg);
        if (msg.topic && handlersRef.current?.[msg.topic]) {
          handlersRef.current[msg.topic](msg.data);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval((ws as any)._pingInterval);
      // 自动重连
      reconnectTimer.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        clearInterval((wsRef.current as any)._pingInterval);
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connected, lastMessage };
}
