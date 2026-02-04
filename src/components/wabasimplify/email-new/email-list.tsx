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

export function EmailList({ initialAccountId }: { initialAccountId?: string }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const selectedId = searchParams.get('id');
    const folder = searchParams.get('folder') || 'inbox';
    const accountId = searchParams.get('accountId') || initialAccountId;

    const [conversations, setConversations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchConversations = async () => {
            setIsLoading(true);
            try {
                // Import dynamically to avoid server-action-in-client issues depending on build set up, 
                // but standard import is usually fine in Next.js 14. 
                // We'll use the imported action.
                const { getEmailConversations } = await import('@/app/actions/email.actions');
                const data = await getEmailConversations(accountId || undefined);
                setConversations(data);
            } catch (error) {
                console.error("Failed to load emails", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchConversations();
    }, [accountId, folder]);

    const filteredConversations = conversations; // Server filters by folder/account ideally, for now assuming action returns relevant list

    const handleSelect = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('id', id);
        router.push(`?${params.toString()}`);
    }

    // Loading State
    if (isLoading) {
        return (
            <div className="flex flex-col h-full bg-background border-r">
                <div className="p-4 border-b space-y-3">
                    <div className="h-8 bg-muted rounded animate-pulse" />
                </div>
                <div className="p-2 space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-24 bg-muted rounded animate-pulse" />
                    ))}
                </div>
            </div>
        )
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
                            No emails found.
                        </div>
                    ) : filteredConversations.map((item) => (
                        <button
                            key={item.id || item._id.toString()}
                            onClick={() => handleSelect(item.id || item._id.toString())}
                            className={cn(
                                "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
                                selectedId === (item.id || item._id.toString()) && "bg-accent"
                            )}
                        >
                            <div className="flex w-full flex-col gap-1">
                                <div className="flex items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="font-semibold text-foreground">
                                            {item.participants?.[0]?.name || 'Unknown'}
                                        </div>
                                        {!item.isRead && (
                                            <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                                        )}
                                    </div>
                                    <div className={cn(
                                        "ml-auto text-xs",
                                        selectedId === (item.id || item._id.toString()) ? "text-foreground" : "text-muted-foreground"
                                    )}>
                                        {item.lastMessageAt && (isToday(new Date(item.lastMessageAt))
                                            ? format(new Date(item.lastMessageAt), 'h:mm a')
                                            : formatDistanceToNow(new Date(item.lastMessageAt), { addSuffix: true }))
                                        }
                                    </div>
                                </div>
                                <div className="text-xs font-medium text-foreground truncate w-full">
                                    {item.subject}
                                </div>
                            </div>
                            <div className="line-clamp-2 text-xs text-muted-foreground w-full">
                                {item.snippet?.substring(0, 100)}
                            </div>
                            {item.labels && item.labels.length > 0 && (
                                <div className="flex items-center gap-2 w-full overflow-hidden mt-1">
                                    {item.labels.map((label: string) => (
                                        <Badge key={label} variant="secondary" className="px-1 py-0 text-[10px] rounded-sm font-medium h-5">
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
