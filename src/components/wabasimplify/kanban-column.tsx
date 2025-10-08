
'use client';

import { CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DroppableProvided } from 'react-beautiful-dnd';
import { KanbanCard } from './kanban-card';
import type { WithId, Contact } from '@/lib/definitions';
import { Draggable } from 'react-beautiful-dnd';

interface KanbanColumnProps {
    title: string;
    contacts: WithId<Contact>[];
}

export function KanbanColumn({ title, contacts, innerRef, droppableProps, isDraggingOver }: KanbanColumnProps & { innerRef: DroppableProvided['innerRef'], droppableProps: DroppableProvided['droppableProps'], isDraggingOver: boolean }) {
    return (
        <div 
            ref={innerRef}
            {...droppableProps}
            className={cn("w-80 flex-shrink-0 h-full flex flex-col rounded-lg bg-muted/50 transition-colors", isDraggingOver && 'bg-primary/10')}
        >
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 capitalize">
                    <span>{title.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{contacts.length}</span>
                </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-2">
                <div className="space-y-3">
                    {contacts.map((contact, index) => (
                        <KanbanCard key={contact._id.toString()} contact={contact} index={index} />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
