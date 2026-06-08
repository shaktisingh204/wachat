'use client';

import { useEffect, useState } from 'react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Avatar,
    AvatarGroup,
    Badge,
    Dot,
} from '@/components/sabcrm/20ui';

type Viewer = { id: string; name: string };

export function AnnouncementPresence({ entityId }: { entityId: string }) {
    const [viewers, setViewers] = useState<Viewer[]>([{ id: '1', name: 'You' }]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Simulated WebSocket for real-time presence
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//echo.websocket.org`;

        let ws: WebSocket;
        let pingInterval: NodeJS.Timeout;

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setIsConnected(true);
                ws.send(JSON.stringify({ type: 'presence_join', entityId, userId: '1' }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (
                        data.type === 'presence_join' &&
                        typeof data.userId === 'string' &&
                        data.userId !== '1' &&
                        typeof data.name === 'string'
                    ) {
                        setViewers((prev) =>
                            prev.some((v) => v.id === data.userId)
                                ? prev
                                : [...prev, { id: data.userId, name: data.name }],
                        );
                    }
                } catch (e) {
                    console.error('Failed to parse websocket message', e);
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
            };

            pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);
        } catch (e) {
            console.error('Failed to connect WebSocket', e);
        }

        return () => {
            clearInterval(pingInterval);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [entityId]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-medium">Active Viewers</CardTitle>
                <Badge tone={isConnected ? 'success' : 'neutral'}>
                    <Dot tone={isConnected ? 'success' : 'neutral'} pulse={isConnected} />
                    {isConnected ? 'Live' : 'Offline'}
                </Badge>
            </CardHeader>
            <CardBody className="pb-4 pt-0">
                <AvatarGroup
                    size="md"
                    shape="round"
                    max={3}
                    label={`${viewers.length} ${viewers.length === 1 ? 'person' : 'people'} viewing`}
                >
                    {viewers.map((viewer) => (
                        <Avatar key={viewer.id} name={viewer.name} shape="round" size="md" />
                    ))}
                </AvatarGroup>
                <p className="mt-2 text-xs text-[var(--st-text-secondary)]">
                    {viewers.length} person{viewers.length === 1 ? '' : 's'} viewing this announcement.
                </p>
            </CardBody>
        </Card>
    );
}
