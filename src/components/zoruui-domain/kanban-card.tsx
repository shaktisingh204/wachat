'use client';

import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Button, Avatar, AvatarFallback, Badge } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

import { MessageSquare } from 'lucide-react';
import type { WithId, Contact } from '@/lib/definitions';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface KanbanCardProps {
    contact: WithId<Contact>;
    index: number;
}

export function KanbanCard({ contact, index }: KanbanCardProps) {
    const router = useRouter();
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: contact._id.toString(),
        data: { index, contact },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : undefined,
    };

    const handleGoToChat = () => {
        router.push(`/wachat/chat?contactId=${contact._id.toString()}`);
    }

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <Card className="cursor-grab active:cursor-grabbing bg-[var(--st-bg-secondary)]">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-semibold">{contact.name}</CardTitle>
                        {contact.unreadCount && contact.unreadCount > 0 && (
                            <Badge variant="default" className="h-5 w-5 flex items-center justify-center p-0">{contact.unreadCount}</Badge>
                        )}
                    </div>
                    <CardDescription className="text-xs">{contact.waId}</CardDescription>
                </CardHeader>
                <CardBody>
                    <p className="text-xs text-[var(--st-text-secondary)] line-clamp-2">
                        {contact.lastMessage || 'No recent activity.'}
                    </p>
                </CardBody>
                <CardFooter>
                    <Button variant="outline" size="sm" className="w-full" onClick={handleGoToChat}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open Chat
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
