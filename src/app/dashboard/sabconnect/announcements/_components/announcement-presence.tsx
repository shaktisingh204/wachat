'use client';

import { useEffect, useState } from 'react';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent } from '@/components/zoruui';

export function AnnouncementPresence({ entityId }: { entityId: string }) {
    const [viewers, setViewers] = useState<{ id: string; name: string; color: string }[]>([
        { id: '1', name: 'You', color: 'bg-zoru-surface-2 text-zoru-ink' }
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
                            color: 'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink dark:text-zoru-ink-muted' 
                        }]);
                    }
                }, 3000);

                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        setViewers(prev => [...prev, { 
                            id: '3', 
                            name: 'Bob J.', 
                            color: 'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink dark:text-zoru-ink-muted' 
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
            <ZoruCardHeader className="flex flex-row items-center justify-between py-3">
                <ZoruCardTitle className="text-sm font-medium">Active Viewers</ZoruCardTitle>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isConnected ? 'bg-zoru-surface-2' : 'bg-zoru-surface-2'}`}></span>
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-zoru-ink' : 'bg-zoru-ink'}`}></span>
                    </span>
                    <span className="text-xs text-zoru-ink">{isConnected ? 'Live' : 'Offline'}</span>
                </div>
            </ZoruCardHeader>
            <ZoruCardContent className="pb-4 pt-0">
                <div className="flex -space-x-2 overflow-hidden">
                    {viewers.map((viewer, i) => (
                        <div 
                            key={viewer.id} 
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white text-xs font-medium dark:ring-zoru-line ${viewer.color} ${i > 0 ? 'animate-in fade-in zoom-in duration-300' : ''}`}
                            title={viewer.name}
                        >
                            {viewer.name.charAt(0)}
                        </div>
                    ))}
                    {viewers.length > 3 && (
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2 ring-2 ring-white text-xs font-medium text-zoru-ink dark:bg-zoru-ink dark:text-zoru-ink-muted dark:ring-zoru-line">
                            +{viewers.length - 3}
                        </div>
                    )}
                </div>
                <p className="mt-2 text-xs text-zoru-ink">
                    {viewers.length} person{viewers.length === 1 ? '' : 's'} viewing this announcement.
                </p>
            </ZoruCardContent>
        </Card>
    );
}
