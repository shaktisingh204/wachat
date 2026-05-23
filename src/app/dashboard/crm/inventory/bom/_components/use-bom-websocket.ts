import { useEffect, useState } from 'react';
import type { CrmBomDoc } from '@/app/actions/crm-bom.actions';

export function useBomWebsocket(initialBoms: (CrmBomDoc & { _id: string })[]) {
  const [boms, setBoms] = useState(initialBoms);

  useEffect(() => {
    // Real-time updates using WebSockets for live inventory tracking.
    // In a real app, this would connect to the actual WebSocket endpoint.
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.example.com/ws/inventory';
    let socket: WebSocket;
    
    try {
      socket = new WebSocket(wsUrl);
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'BOM_UPDATED') {
            setBoms(prev => prev.map(b => b._id === data.payload._id ? { ...b, ...data.payload } : b));
          } else if (data.type === 'BOM_CREATED') {
            setBoms(prev => [data.payload, ...prev]);
          } else if (data.type === 'BOM_DELETED') {
            setBoms(prev => prev.filter(b => b._id !== data.payload._id));
          }
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };
    } catch (e) {
      console.error("WebSocket connection failed", e);
    }

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  return { boms, setBoms };
}
