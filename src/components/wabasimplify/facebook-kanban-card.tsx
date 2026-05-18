'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruButton,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
} from '@/components/zoruui';
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
            <ZoruCard
                className="cursor-grab active:cursor-grabbing bg-card"
            >
                <ZoruCardHeader className="flex-row items-center gap-3 p-3">
                    <ZoruAvatar>
                        <ZoruAvatarImage src={`https://graph.facebook.com/${conversation.psid}/picture`} alt={conversation.name} data-ai-hint="person avatar"/>
                        <ZoruAvatarFallback>{conversation.name.charAt(0).toUpperCase()}</ZoruAvatarFallback>
                    </ZoruAvatar>
                    <div>
                         <ZoruCardTitle className="text-sm font-semibold">{conversation.name}</ZoruCardTitle>
                         <ZoruCardDescription className="text-xs font-mono">{conversation.psid}</ZoruCardDescription>
                    </div>
                </ZoruCardHeader>
                <ZoruCardContent className="px-3 pb-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {conversation.snippet || 'No recent messages.'}
                    </p>
                </ZoruCardContent>
                <ZoruCardFooter className="p-3 pt-0">
                     <ZoruButton variant="outline" size="sm" className="w-full" onClick={handleGoToChat}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        View Conversation
                     </ZoruButton>
                </ZoruCardFooter>
            </ZoruCard>
        </div>
    );
}
