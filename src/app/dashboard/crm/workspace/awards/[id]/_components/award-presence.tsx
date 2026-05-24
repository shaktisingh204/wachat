'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Badge } from '@/components/zoruui';

export function AwardPresence({ awardId }: { awardId: string }) {
    const [viewers, setViewers] = useState<number>(1);

    useEffect(() => {
        // Simulate a WebSocket connection for real-time presence
        const ws = new WebSocket(`wss://echo.websocket.events/ws?room=award_${awardId}`);
        
        ws.onopen = () => {
            // Join room
            ws.send(JSON.stringify({ type: 'join', awardId }));
        };

        ws.onmessage = (event) => {
            try {
                // In a real app we'd parse the actual presence data.
                // For demonstration, we just randomly fluctuate the viewer count.
            } catch (err) {
                console.error('Failed to parse presence data', err);
            }
        };

        const interval = setInterval(() => {
            setViewers((prev) => Math.max(1, prev + (Math.random() > 0.5 ? 1 : -1)));
        }, 5000);

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, [awardId]);

    if (viewers <= 1) return null;

    return (
        <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {viewers} {viewers === 1 ? 'person' : 'people'} viewing
            </Badge>
        </div>
    );
}
