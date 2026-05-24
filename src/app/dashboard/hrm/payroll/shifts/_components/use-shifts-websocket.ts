import { useEffect, useState } from 'react';
import type { CrmShiftDoc } from '@/lib/rust-client/crm-shifts';

export function useShiftsWebsocket(initialShifts: CrmShiftDoc[]) {
    const [shifts, setShifts] = useState(initialShifts);

    useEffect(() => {
        setShifts(initialShifts);
    }, [initialShifts]);

    useEffect(() => {
        // Mocking WebSockets for collaborative editing (Shift tracking)
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.example.com/ws/shifts';
        let socket: WebSocket;
        
        try {
            socket = new WebSocket(wsUrl);
            
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'SHIFT_UPDATED') {
                        setShifts(prev => prev.map(s => s._id === data.payload._id ? { ...s, ...data.payload } : s));
                    } else if (data.type === 'SHIFT_CREATED') {
                        setShifts(prev => [data.payload, ...prev]);
                    } else if (data.type === 'SHIFT_DELETED') {
                        setShifts(prev => prev.filter(s => s._id !== data.payload._id));
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

    return { shifts, setShifts };
}
