
'use client';

import type { FacebookConversation } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { format } from 'date-fns';
import { Search, MessageSquarePlus } from 'lucide-react';
import { Input } from '../ui/input';

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
        // A simple way to get the user, not the page
        return convo.participants.data.find(p => !p.name.includes("Page"));
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-card">
            <div className="p-3 border-b flex-shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">Messenger Chats</h2>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MessageSquarePlus className="h-5 w-5" />
                        <span className="sr-only">New Chat</span>
                    </Button>
                </div>
                 <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search conversations..." className="pl-8" />
                </div>
            </div>
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
                                        "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent",
                                        selectedConversationId === convo.id && "bg-accent"
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
                                                {format(new Date(convo.updated_time), 'p')}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-muted-foreground truncate">{convo.snippet}</p>
                                            {convo.unread_count > 0 && (
                                                <Badge className="h-5 w-5 flex items-center justify-center p-0 rounded-full bg-primary text-primary-foreground">{convo.unread_count}</Badge>
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
