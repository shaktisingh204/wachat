'use client';

import { Avatar, ZoruAvatarImage, ZoruAvatarFallback } from '@/components/sabcrm/20ui/compat';
import {
  cn } from '@/lib/utils';
import { format } from 'date-fns';

import React from 'react';
import type { FacebookMessage } from '@/lib/definitions';

interface FacebookChatMessageProps {
    message: FacebookMessage;
    pageId: string;
}

export const FacebookChatMessage = React.memo(function FacebookChatMessage({ message, pageId }: FacebookChatMessageProps) {
    const isOutgoing = message.from.id === pageId;
    const participant = isOutgoing ? { name: "You", id: pageId } : message.from;

    return (
        <div className={cn("flex items-end gap-2 group/message", isOutgoing ? "justify-end" : "justify-start")}>
            {!isOutgoing && (
                 <Avatar className="h-8 w-8 self-end">
                    <ZoruAvatarImage src={`https://graph.facebook.com/${participant.id}/picture`} alt={participant.name}/>
                    <ZoruAvatarFallback>{participant.name.charAt(0).toUpperCase()}</ZoruAvatarFallback>
                </Avatar>
            )}
            <div
                className={cn(
                    "max-w-[70%] rounded-lg p-2 px-3 text-sm flex flex-col shadow-sm",
                    isOutgoing
                        ? "bg-zoru-ink text-white rounded-br-none"
                        : "bg-white dark:bg-zoru-surface-2 rounded-bl-none"
                )}
            >
                <p className="whitespace-pre-wrap">{message.message}</p>
                <div className={cn("flex items-center gap-1.5 self-end mt-1 text-xs", isOutgoing ? 'text-white/80' : 'text-zoru-ink-muted/80')}>
                    <p>
                        {format(new Date(message.created_time), 'p')}
                    </p>
                </div>
            </div>
        </div>
    );
});
