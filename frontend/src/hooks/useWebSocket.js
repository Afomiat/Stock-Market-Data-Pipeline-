import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (token) => {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  const [lastAlert, setLastAlert] = useState(null);
  const reconnectTimeout = useRef(null);
  const mounted = useRef(true);

  const connect = useCallback(() => {
    if (!token || !mounted.current) return;

    let wsBaseUrl = import.meta.env.VITE_WS_URL;
    if (!wsBaseUrl) {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      wsBaseUrl = isLocal
        ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
        : `wss://stock-market-data-pipeline-cnsy.onrender.com/ws`;
    }

    const url = `${wsBaseUrl}?token=${token}`;

    try {
      setConnecting(true);
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        if (mounted.current) {
          setConnected(true);
          setConnecting(false);
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!mounted.current) return;
          if (data.type === 'price_update') {
            setLastPriceUpdate(data);
          } else if (data.type === 'alert_triggered') {
            setLastAlert(data);
          }
        } catch (_) {}
      };

      ws.current.onclose = () => {
        if (mounted.current) {
          setConnected(false);
          setConnecting(false);
          // Reconnect after 1.5 seconds
          reconnectTimeout.current = setTimeout(connect, 1500);
        }
      };

      ws.current.onerror = () => {
        if (mounted.current) setConnecting(false);
        ws.current?.close();
      };
    } catch (_) {
      setConnecting(false);
    }
  }, [token]);

  useEffect(() => {
    mounted.current = true;
    connect();
    return () => {
      mounted.current = false;
      clearTimeout(reconnectTimeout.current);
      ws.current?.close();
    };
  }, [connect]);

  return { connected, connecting, lastPriceUpdate, lastAlert };
};
