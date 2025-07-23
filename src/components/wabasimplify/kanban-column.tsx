
'use client';

import { CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DroppableProvided } from 'react-beautiful-dnd';

interface KanbanColumnProps {
    title: string;
    children: React.ReactNode;
    innerRef: DroppableProvided['innerRef'];
    droppableProps: DroppableProvided['droppableProps'];
    isDraggingOver: boolean;
}

export function KanbanColumn({ title, children, innerRef, droppableProps, isDraggingOver }: KanbanColumnProps) {
    return (
        <div className="w-80 flex-shrink-0 h-full flex flex-col rounded-lg bg-muted/50">
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 capitalize">
                    <span>{title.replace(/_/g, ' ')}</span>
                </CardTitle>
            </CardHeader>
            <ScrollArea 
                className={cn("flex-1 p-2 rounded-b-lg", isDraggingOver && 'bg-primary/10')}
                ref={innerRef as any}
                {...droppableProps}
            >
                <div className="space-y-3">
                    {children}
                </div>
            </ScrollArea>
        </div>
    );
}
