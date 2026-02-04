'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Star, Paperclip } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mockConversations } from './email-data';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isToday, format } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export function EmailList() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const selectedId = searchParams.get('id');
    const folder = searchParams.get('folder') || 'inbox';

    // In real app, this would filter by folder from API
    // For mock, we just filter client side
    const filteredConversations = mockConversations.filter(c =>
        folder === 'inbox' ? c.folder === 'inbox' : c.folder === folder
    );

    const handleSelect = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('id', id);
        router.push(`?${params.toString()}`);
    }

    return (
        <div className="flex flex-col h-full bg-background border-r group">
            <div className="p-4 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search mail"
                        className="pl-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-muted transition-all"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1 p-2">
                    {filteredConversations.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No emails in {folder}.
                        </div>
                    ) : filteredConversations.map((item) => (
                        <button
                            key={item._id.toString()}
                            onClick={() => handleSelect(item._id.toString())}
                            className={cn(
                                "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
                                selectedId === item._id.toString() && "bg-accent"
                            )}
                        >
                            <div className="flex w-full flex-col gap-1">
                                <div className="flex items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="font-semibold text-foreground">
                                            {item.participants[0].name}
                                        </div>
                                        {!item.status || item.status === 'unread' && (
                                            <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                                        )}
                                    </div>
                                    <div className={cn(
                                        "ml-auto text-xs",
                                        selectedId === item._id.toString() ? "text-foreground" : "text-muted-foreground"
                                    )}>
                                        {isToday(new Date(item.lastMessageAt))
                                            ? format(new Date(item.lastMessageAt), 'h:mm a')
                                            : formatDistanceToNow(new Date(item.lastMessageAt), { addSuffix: true })
                                        }
                                    </div>
                                </div>
                                <div className="text-xs font-medium text-foreground truncate w-full">
                                    {item.subject}
                                </div>
                            </div>
                            <div className="line-clamp-2 text-xs text-muted-foreground w-full">
                                {item.snippet.substring(0, 300)}
                            </div>
                            {item.labels && item.labels.length > 0 && (
                                <div className="flex items-center gap-2 w-full overflow-hidden mt-1">
                                    {item.labels.map((label) => (
                                        <Badge key={label} variant={getLabelVariant(label) as any} className="px-1 py-0 text-[10px] rounded-sm font-medium h-5">
                                            {label}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

function getLabelVariant(label: string) {
    if (['work', 'urgent'].includes(label.toLowerCase())) {
        return 'default';
    }
    if (['personal'].includes(label.toLowerCase())) {
        return 'outline';
    }
    return 'secondary';
}
