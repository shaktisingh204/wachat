import { useEffect, useState, useRef } from 'react';
import type { CrmShiftDoc } from '@/lib/rust-client/crm-shifts';

export function useShiftWebsocket(initialShift: CrmShiftDoc) {
  const [shift, setShift] = useState<CrmShiftDoc>(initialShift);
  const [isConnected, setIsConnected] = useState(false);
  // Track last modified by just to show collaborative aspect
  const [lastModifiedBy, setLastModifiedBy] = useState<string | null>(null);

  useEffect(() => {
    // Rehydrate shift if initialShift changes (from server action revalidation)
    setShift(initialShift);
  }, [initialShift]);

  useEffect(() => {
    // In a real application, this would connect to a real WS endpoint:
    // const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.sabnode.com/ws/shifts';
    // const socket = new WebSocket(`${wsUrl}/${initialShift._id}`);
    
    // Simulating websocket connection delay
    const connectTimer = setTimeout(() => {
      setIsConnected(true);
    }, 1000);

    // Simulating random background updates from other collaborators
    const simulateUpdatesInterval = setInterval(() => {
      if (Math.random() > 0.8) {
        setLastModifiedBy('Jane (HR)');
        setShift(prev => ({
          ...prev,
          // Minor arbitrary change for demo
          graceMinutes: prev.graceMinutes === 15 ? 20 : 15,
        }));
        
        // Clear message after 3 seconds
        setTimeout(() => setLastModifiedBy(null), 3000);
      }
    }, 15000);

    return () => {
      clearTimeout(connectTimer);
      clearInterval(simulateUpdatesInterval);
      setIsConnected(false);
    };
  }, [initialShift._id]);

  return { 
    shift, 
    setShift,
    isConnected,
    lastModifiedBy 
  };
}
