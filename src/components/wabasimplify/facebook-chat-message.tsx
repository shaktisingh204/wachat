
'use client';

import React from 'react';
import type { FacebookMessage } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FacebookChatMessageProps {
    message: FacebookMessage;
    pageId: string;
}

export const FacebookChatMessage = React.memo(function FacebookChatMessage({ message, pageId }: FacebookChatMessageProps) {
    const isOutgoing = message.from.id === pageId;

    return (
        <div className={cn("flex items-end gap-2 group/message", isOutgoing ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-md rounded-lg p-3 text-sm flex flex-col", isOutgoing ? "bg-primary text-primary-foreground" : "bg-card")}>
                <p className="whitespace-pre-wrap">{message.message}</p>
                <div className={cn("flex items-center gap-2 self-end mt-1 pt-1 text-xs", isOutgoing ? 'opacity-80' : 'opacity-60')}>
                    <p>
                        {format(new Date(message.created_time), 'p')}
                    </p>
                </div>
            </div>
        </div>
    );
});
