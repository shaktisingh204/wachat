import { useEffect, useState } from 'react';
import type { HrmPermissionGroup } from '@/app/actions/hrm-permission-groups.actions';

export function usePermissionGroupWebsocket(initialGroups: HrmPermissionGroup[]) {
  const [groups, setGroups] = useState(initialGroups);

  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  useEffect(() => {
    // Real-time updates using WebSockets for collaborative editing.
    // In a real app, this connects to the actual WebSocket endpoint.
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.example.com/ws/hrm/permissions';
    let socket: WebSocket;
    
    try {
      socket = new WebSocket(wsUrl);
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'GROUP_UPDATED') {
            setGroups(prev => prev.map(g => g._id === data.payload._id ? { ...g, ...data.payload } : g));
          } else if (data.type === 'GROUP_CREATED') {
            setGroups(prev => [data.payload, ...prev]);
          } else if (data.type === 'GROUP_DELETED') {
            setGroups(prev => prev.filter(g => g._id !== data.payload._id));
          }
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };
    } catch (e) {
      console.warn("WebSocket connection unavailable, falling back to initial data.");
    }

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  return { groups, setGroups };
}
