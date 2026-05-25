import { useEffect } from 'react';
import { WsProjectTimeLog } from '@/lib/worksuite/time-types';

export function useTimeLogsWebsocket(onUpdate: (data: WsProjectTimeLog[]) => void) {
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://echo.websocket.events';
    let socket: WebSocket;
    let isConnected = false;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        isConnected = true;
        // In a real app, you might subscribe to a specific channel
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'TIME_LOGS_UPDATE' && Array.isArray(message.data)) {
            onUpdate(message.data);
          }
        } catch (e) {
          console.error("Failed to parse time logs websocket message", e);
        }
      };

      socket.onerror = (error) => {
        console.error("Time logs websocket error", error);
      };
    } catch (e) {
      console.error("Failed to initialize time logs websocket", e);
    }

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [onUpdate]);
}
