import { CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';
import { ReactNode } from 'react';

interface KanbanColumnProps {
    title: string;
    children: ReactNode;
    columnId: string;
    count?: number;
}

export function KanbanColumn({ title, children, columnId, count = 0 }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: columnId });

    return (
        <div
            ref={setNodeRef}
            className={cn("w-80 flex-shrink-0 h-full flex flex-col rounded-lg bg-muted/50 transition-colors", isOver && 'bg-primary/10')}
        >
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 capitalize">
                    <span>{title.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{count}</span>
                </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-2">
                <div className="space-y-3">
                    {children}
                </div>
            </ScrollArea>
        </div>
    );
}
