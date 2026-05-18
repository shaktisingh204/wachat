
'use client';

import { useRouter } from 'next/navigation';
import { ZoruCard, ZoruCardContent, ZoruCardDescription, ZoruCardFooter, ZoruCardHeader, ZoruCardTitle, ZoruButton } from '@/components/zoruui';
import { ZoruAvatar, ZoruAvatarFallback } from '@/components/zoruui';
import { ZoruBadge } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
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
            <ZoruCard className="cursor-grab active:cursor-grabbing bg-card">
                <ZoruCardHeader>
                    <div className="flex justify-between items-start">
                        <ZoruCardTitle className="text-sm font-semibold">{contact.name}</ZoruCardTitle>
                        {contact.unreadCount && contact.unreadCount > 0 && (
                            <ZoruBadge variant="default" className="h-5 w-5 flex items-center justify-center p-0">{contact.unreadCount}</ZoruBadge>
                        )}
                    </div>
                    <ZoruCardDescription className="text-xs">{contact.waId}</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {contact.lastMessage || 'No recent activity.'}
                    </p>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <ZoruButton variant="outline" size="sm" className="w-full" onClick={handleGoToChat}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open Chat
                    </ZoruButton>
                </ZoruCardFooter>
            </ZoruCard>
        </div>
    );
}
