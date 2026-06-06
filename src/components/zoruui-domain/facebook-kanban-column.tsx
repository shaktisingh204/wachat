'use client';

import { ZoruCardHeader, ZoruCardTitle, ScrollArea } from '@/components/sabcrm/20ui/compat';
import { cn } from '@/lib/utils';
import { FacebookKanbanCard } from './facebook-kanban-card';
import type { WithId, FacebookSubscriber } from '@/lib/definitions';
import { useDroppable } from '@dnd-kit/core';

interface FacebookKanbanColumnProps {
    title: string;
    conversations: WithId<FacebookSubscriber>[];
}

export function FacebookKanbanColumn({ title, conversations }: FacebookKanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: title });

    return (
        <div
            ref={setNodeRef}
            className={cn("w-80 flex-shrink-0 h-full flex flex-col rounded-lg bg-zoru-surface-2/50 transition-colors", isOver && 'bg-zoru-ink/10')}
        >
            <ZoruCardHeader className="flex-shrink-0">
                <ZoruCardTitle className="flex items-center gap-2 capitalize">
                    <span>{title.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-normal bg-zoru-ink/10 text-zoru-ink px-2 py-0.5 rounded-full">{conversations.length}</span>
                </ZoruCardTitle>
            </ZoruCardHeader>
            <ScrollArea className="flex-1 p-2">
                <div className="space-y-3">
                    {conversations.map((convo, index) => (
                        <FacebookKanbanCard key={convo._id.toString()} conversation={convo} index={index} />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
