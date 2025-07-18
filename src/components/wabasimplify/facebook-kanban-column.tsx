
'use client';

import { CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FacebookKanbanCard } from './facebook-kanban-card';
import type { WithId, FacebookSubscriber } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Draggable } from 'react-beautiful-dnd';

interface FacebookKanbanColumnProps {
    title: string;
    conversations: WithId<FacebookSubscriber>[];
}

export function FacebookKanbanColumn({ title, conversations }: FacebookKanbanColumnProps) {
    return (
        <div className="w-80 flex-shrink-0 h-full flex flex-col rounded-lg bg-muted/50">
            <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2 capitalize">
                    <span>{title.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{conversations.length}</span>
                </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-2">
                <div className="space-y-3">
                    {conversations.map((convo, index) => (
                         <Draggable key={convo._id.toString()} draggableId={convo._id.toString()} index={index}>
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                >
                                    <FacebookKanbanCard conversation={convo} />
                                </div>
                            )}
                        </Draggable>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
