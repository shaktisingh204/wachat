
'use client';

import { CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KanbanCard } from './kanban-card';
import type { WithId, Contact } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Droppable } from 'react-beautiful-dnd';

interface KanbanColumnProps {
    title: string;
    contacts: WithId<Contact>[];
}

export function KanbanColumn({ title, contacts }: KanbanColumnProps) {
    return (
        <div className="w-80 flex-shrink-0 h-full flex flex-col rounded-lg bg-muted/50">
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 capitalize">
                    <span>{title.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{contacts.length}</span>
                </CardTitle>
            </CardHeader>
            <Droppable droppableId={title}>
                {(provided, snapshot) => (
                     <ScrollArea 
                        className={cn("flex-1 p-2 rounded-b-lg", snapshot.isDraggingOver && 'bg-primary/10')}
                        // @ts-ignore
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                    >
                        <div className="space-y-3">
                            {contacts.map((contact, index) => (
                                <KanbanCard key={contact._id.toString()} contact={contact} index={index}/>
                            ))}
                            {provided.placeholder}
                        </div>
                    </ScrollArea>
                )}
            </Droppable>
        </div>
    );
}
