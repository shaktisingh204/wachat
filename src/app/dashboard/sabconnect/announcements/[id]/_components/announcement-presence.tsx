'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Badge } from '@/components/sabcrm/20ui';

export function AnnouncementPresence({ announcementId }: { announcementId: string }) {
    const [viewers, setViewers] = useState<number>(1);

    useEffect(() => {
        // Simulate a WebSocket connection for real-time presence
        const ws = new WebSocket(`wss://echo.websocket.events/ws?room=announcement_${announcementId}`);

        ws.onopen = () => {
            // Join room
            ws.send(JSON.stringify({ type: 'join', announcementId }));
        };

        ws.onmessage = () => {
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
    }, [announcementId]);

    if (viewers <= 1) return null;

    return (
        <Badge
            tone="info"
            className="inline-flex items-center gap-1"
            role="status"
            aria-live="polite"
        >
            <Users className="h-3 w-3" aria-hidden="true" />
            {viewers} people viewing
        </Badge>
    );
}
