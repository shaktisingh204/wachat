import { useEffect, useState } from 'react';
import type { OnboardingTask } from '@/lib/hrm-advanced-types';

export function useOnboardingWebsocket(initialTasks: OnboardingTask[]) {
  const [tasks, setTasks] = useState<OnboardingTask[]>(initialTasks);

  // Sync initial tasks when they change (e.g., from Server Actions or Revalidation)
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    // Real-time updates using WebSockets for collaborative editing.
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.example.com/ws/hrm/onboarding';
    let socket: WebSocket;
    
    try {
      socket = new WebSocket(wsUrl);
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TASK_UPDATED') {
            setTasks(prev => prev.map(t => t._id === data.payload._id ? { ...t, ...data.payload } : t));
          } else if (data.type === 'TASK_CREATED') {
            setTasks(prev => [data.payload, ...prev]);
          } else if (data.type === 'TASK_DELETED') {
            setTasks(prev => prev.filter(t => t._id !== data.payload._id));
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

  return { tasks, setTasks };
}
