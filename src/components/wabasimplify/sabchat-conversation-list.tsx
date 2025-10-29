
'use client';

import type { WithId, SabChatSession } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Search, Edit } from 'lucide-react';
import { Input } from '../ui/input';
import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface SabChatConversationListProps {
    conversations: WithId<SabChatSession>[];
    selectedConversationId?: string;
    onSelectConversation: (conversation: WithId<SabChatSession>) => void;
    isLoading: boolean;
}

export function SabChatConversationList({ 
    conversations, 
    selectedConversationId, 
    onSelectConversation, 
    isLoading
}: SabChatConversationListProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
    }, 300);

    const filteredConversations = conversations.filter(convo => 
        convo.visitorInfo?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        convo.history.some(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const ConversationSkeleton = () => (
        <div className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    );
    
    return (
        <>
            <div className="h-full flex flex-col overflow-hidden bg-card">
                <div className="p-3 border-b flex-shrink-0">
                     <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by email or message..." 
                            className="pl-10" 
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    {isLoading ? (
                        <div className="p-2 space-y-1">
                            {[...Array(8)].map((_, i) => <ConversationSkeleton key={i} />)}
                        </div>
                    ) : filteredConversations.length > 0 ? (
                        <>
                            {filteredConversations.map(convo => {
                                const lastMessage = convo.history[convo.history.length - 1];
                                return (
                                    <button
                                        key={convo._id.toString()}
                                        onClick={() => onSelectConversation(convo)}
                                        className={cn(
                                            "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-accent border-b",
                                            selectedConversationId === convo._id.toString() && "bg-accent"
                                        )}
                                    >
                                        <Avatar>
                                            <AvatarFallback>{convo.visitorInfo?.email?.charAt(0).toUpperCase() || 'V'}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex items-center justify-between">
                                                <p className="font-semibold truncate">{convo.visitorInfo?.email || 'New Visitor'}</p>
                                                <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDistanceToNow(new Date(convo.updatedAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">{lastMessage?.content || 'No messages yet.'}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </>
                    ) : (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No conversations found.
                        </div>
                    )}
                </ScrollArea>
            </div>
        </>
    );
}
