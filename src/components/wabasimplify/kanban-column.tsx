
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KanbanCard } from './kanban-card';
import type { WithId, Contact } from '@/lib/definitions';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
    title: 'New' | 'Open' | 'Resolved';
    contacts: WithId<Contact>[];
    onDrop: (contactId: string, newStatus: 'new' | 'open' | 'resolved') => void;
}

export function KanbanColumn({ title, contacts, onDrop }: KanbanColumnProps) {
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
        const contactId = e.dataTransfer.getData('contactId');
        onDrop(contactId, title.toLowerCase() as 'new' | 'open' | 'resolved');
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
                <CardTitle className="flex items-center gap-2">
                    <span>{title}</span>
                    <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{contacts.length}</span>
                </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-2">
                <div className="space-y-3">
                    {contacts.map(contact => (
                        <KanbanCard key={contact._id.toString()} contact={contact} />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
