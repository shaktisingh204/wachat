'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/sabcrm/20ui';

export function AnnouncementPresence({ entityId }: { entityId: string }) {
    const [viewers, setViewers] = useState<{ id: string; name: string; color: string }[]>([
        { id: '1', name: 'You', color: 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' }
    ]);
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
                
                // Simulate other users joining
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        setViewers(prev => [...prev, { 
                            id: '2', 
                            name: 'Alice S.', 
                            color: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]' 
                        }]);
                    }
                }, 3000);

                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        setViewers(prev => [...prev, { 
                            id: '3', 
                            name: 'Bob J.', 
                            color: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]' 
                        }]);
                    }
                }, 8000);
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'presence_join' && data.userId !== '1') {
                        // In a real app we'd add the user here
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
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isConnected ? 'bg-[var(--st-bg-muted)]' : 'bg-[var(--st-bg-muted)]'}`}></span>
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-[var(--st-text)]' : 'bg-[var(--st-text)]'}`}></span>
                    </span>
                    <span className="text-xs text-[var(--st-text)]">{isConnected ? 'Live' : 'Offline'}</span>
                </div>
            </CardHeader>
            <CardBody className="pb-4 pt-0">
                <div className="flex -space-x-2 overflow-hidden">
                    {viewers.map((viewer, i) => (
                        <div 
                            key={viewer.id} 
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white text-xs font-medium dark:ring-[var(--st-border)] ${viewer.color} ${i > 0 ? 'animate-in fade-in zoom-in duration-300' : ''}`}
                            title={viewer.name}
                        >
                            {viewer.name.charAt(0)}
                        </div>
                    ))}
                    {viewers.length > 3 && (
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-bg-muted)] ring-2 ring-white text-xs font-medium text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)] dark:ring-[var(--st-border)]">
                            +{viewers.length - 3}
                        </div>
                    )}
                </div>
                <p className="mt-2 text-xs text-[var(--st-text)]">
                    {viewers.length} person{viewers.length === 1 ? '' : 's'} viewing this announcement.
                </p>
            </CardBody>
        </Card>
    );
}
