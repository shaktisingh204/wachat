'use client';

import { useState } from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FacebookKanbanCard } from './facebook-kanban-card';
import type { WithId, FacebookSubscriber } from '@/lib/definitions';
import { cn } from '@/lib/utils';

interface FacebookKanbanColumnProps {
    title: string;
    conversations: WithId<FacebookSubscriber>[];
    onDrop: (subscriberId: string, newStatus: string) => void;
}

export function FacebookKanbanColumn({ title, conversations, onDrop }: FacebookKanbanColumnProps) {
    const [isOver, setIsOver] = useState(false);
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(true);
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(false);
        const subscriberId = e.dataTransfer.getData('subscriberId');
        onDrop(subscriberId, title);
    };
    
    return (
        <div 
            className={cn(
                'w-80 flex-shrink-0 h-full flex flex-col rounded-lg transition-colors',
                isOver ? 'bg-muted' : 'bg-muted/50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 capitalize">
                    <span>{title.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{conversations.length}</span>
                </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-2">
                <div className="space-y-3">
                    {conversations.map(convo => (
                        <FacebookKanbanCard key={convo._id.toString()} conversation={convo} />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}