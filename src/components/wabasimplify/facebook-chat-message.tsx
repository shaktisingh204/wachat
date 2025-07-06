
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
            <div className={cn("max-w-md rounded-lg p-2 text-sm flex flex-col shadow-sm", isOutgoing ? "bg-primary text-primary-foreground" : "bg-white dark:bg-muted")}>
                <p className="whitespace-pre-wrap">{message.message}</p>
                <div className={cn("flex items-center gap-1.5 self-end mt-1 text-xs", isOutgoing ? 'text-primary-foreground/80' : 'text-muted-foreground/80')}>
                    <p>
                        {format(new Date(message.created_time), 'p')}
                    </p>
                </div>
            </div>
        </div>
    );
});
