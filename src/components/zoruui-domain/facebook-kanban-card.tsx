'use client';

import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Button, Avatar, AvatarFallback, AvatarImage } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

import { MessageSquare } from 'lucide-react';
import type { WithId, FacebookSubscriber } from '@/lib/definitions';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface FacebookKanbanCardProps {
    conversation: WithId<FacebookSubscriber>;
    index: number;
}

export function FacebookKanbanCard({ conversation, index }: FacebookKanbanCardProps) {
    const router = useRouter();
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: conversation._id.toString(),
        data: { index, conversation },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : undefined,
    };

    const handleGoToChat = () => {
        router.push(`/dashboard/facebook/messages?conversationId=${conversation.psid}`);
    }

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <Card
                className="cursor-grab active:cursor-grabbing bg-[var(--st-bg-secondary)]"
            >
                <CardHeader className="flex-row items-center gap-3 p-3">
                    <Avatar>
                        <AvatarImage src={`https://graph.facebook.com/${conversation.psid}/picture`} alt={conversation.name} data-ai-hint="person avatar"/>
                        <AvatarFallback>{conversation.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                         <CardTitle className="text-sm font-semibold">{conversation.name}</CardTitle>
                         <CardDescription className="text-xs font-mono">{conversation.psid}</CardDescription>
                    </div>
                </CardHeader>
                <CardBody className="px-3 pb-3">
                    <p className="text-xs text-[var(--st-text-secondary)] line-clamp-2">
                        {conversation.snippet || 'No recent messages.'}
                    </p>
                </CardBody>
                <CardFooter className="p-3 pt-0">
                     <Button variant="outline" size="sm" className="w-full" onClick={handleGoToChat}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        View Conversation
                     </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
