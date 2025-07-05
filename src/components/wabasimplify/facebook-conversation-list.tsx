
'use client';

import type { FacebookConversation } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';

interface FacebookConversationListProps {
    conversations: FacebookConversation[];
    selectedConversationId?: string;
    onSelectConversation: (conversation: FacebookConversation) => void;
    isLoading: boolean;
}

export function FacebookConversationList({ conversations, selectedConversationId, onSelectConversation, isLoading }: FacebookConversationListProps) {

    const ConversationSkeleton = () => (
        <div className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    );
    
    const getParticipant = (convo: FacebookConversation) => {
        return convo.participants.data.find(p => !p.name.includes("Page")); // A bit brittle but should work for most cases
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-2 space-y-1">
                        {[...Array(8)].map((_, i) => <ConversationSkeleton key={i} />)}
                    </div>
                ) : conversations.length > 0 ? (
                    <>
                        {conversations.map(convo => {
                            const participant = getParticipant(convo);
                            return (
                                <button
                                    key={convo.id}
                                    onClick={() => onSelectConversation(convo)}
                                    className={cn(
                                        "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted",
                                        selectedConversationId === convo.id && "bg-muted"
                                    )}
                                >
                                    <Avatar>
                                        <AvatarImage src={`https://graph.facebook.com/${participant?.id}/picture`} alt={participant?.name || 'U'} data-ai-hint="person avatar"/>
                                        <AvatarFallback>{participant?.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold truncate">{participant?.name || 'Unknown User'}</p>
                                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDistanceToNow(new Date(convo.updated_time), { addSuffix: true })}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-muted-foreground truncate">{convo.snippet}</p>
                                            {convo.unread_count > 0 && (
                                                <Badge variant="default" className="h-5 w-5 flex items-center justify-center p-0">{convo.unread_count}</Badge>
                                            )}
                                        </div>
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
    );
}
