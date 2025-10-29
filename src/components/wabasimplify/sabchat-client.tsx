
'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { getChatSessionsForUser, getFullChatSession } from '@/app/actions/sabchat.actions';
import type { WithId, SabChatSession } from '@/lib/definitions';
import { SabChatConversationList } from './sabchat-conversation-list';
import { SabChatWindow } from './sabchat-chat-window';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, MessageSquare } from 'lucide-react';
import { Card } from '../ui/card';
import { useProject } from '@/context/project-context';

function ChatPageSkeleton() {
    return <Skeleton className="h-full w-full rounded-xl" />;
}

export function SabChatClient() {
    const searchParams = useSearchParams();
    const { sessionUser } = useProject();

    const conversationIdFromUrl = searchParams.get('conversationId');
    
    const [conversations, setConversations] = useState<WithId<SabChatSession>[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<WithId<SabChatSession> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [loadingConversation, startConversationLoadTransition] = useTransition();
    
    const fetchInitialData = useCallback(() => {
        startLoadingTransition(async () => {
            const sessions = await getChatSessionsForUser();
            setConversations(sessions);

            if (conversationIdFromUrl) {
                const convo = sessions.find(c => c._id.toString() === conversationIdFromUrl);
                if (convo) {
                    handleSelectConversation(convo);
                }
            } else if (sessions.length > 0) {
                 handleSelectConversation(sessions[0]);
            }
        });
    }, [conversationIdFromUrl]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const handleSelectConversation = useCallback(async (conversation: WithId<SabChatSession>) => {
        startConversationLoadTransition(async () => {
            const fullConvo = await getFullChatSession(conversation._id.toString());
            setSelectedConversation(fullConvo);
        });
    }, []);

    const onMessageSent = useCallback(() => {
        if(selectedConversation) {
            handleSelectConversation(selectedConversation);
        }
    }, [selectedConversation, handleSelectConversation]);

    if (isLoading) {
        return <ChatPageSkeleton />;
    }

    if (!sessionUser) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Not Logged In</AlertTitle>
                    <AlertDescription>Please log in to use the live chat inbox.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <Card className="h-full w-full flex flex-col overflow-hidden bg-muted/30 dark:bg-background">
            <div className="flex flex-1 overflow-hidden">
                <div className="w-full flex-col border-r bg-background md:w-[320px] flex-shrink-0 flex">
                    <SabChatConversationList
                        conversations={conversations}
                        selectedConversationId={selectedConversation?._id.toString()}
                        onSelectConversation={handleSelectConversation}
                        isLoading={isLoading}
                    />
                </div>

                <div className="w-full flex-col flex-1 flex">
                     {selectedConversation ? (
                        <SabChatWindow
                            key={selectedConversation._id.toString()}
                            session={selectedConversation}
                            isLoading={loadingConversation}
                            onMessageSent={onMessageSent}
                        />
                    ) : (
                        <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground gap-4 p-8 text-center bg-chat-texture">
                            <MessageSquare className="h-16 w-16" />
                            <h2 className="text-xl font-semibold">Select a conversation</h2>
                            <p>Choose a chat from the list to start messaging.</p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}

```
- src/components/wabasimplify/sabchat-conversation-list.tsx:
```tsx
'use client';

import type { WithId, SabChatSession } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';

interface SabChatConversationListProps {
    conversations: WithId<SabChatSession>[];
    selectedConversationId?: string;
    onSelectConversation: (conversation: WithId<SabChatSession>) => void;
    isLoading: boolean;
}

export function SabChatConversationList({ conversations, selectedConversationId, onSelectConversation, isLoading }: SabChatConversationListProps) {

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
        <div className="h-full flex flex-col overflow-hidden">
            <div className="p-3 border-b flex-shrink-0">
                 <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search inbox..." className="pl-10" />
                </div>
            </div>
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-2 space-y-1">
                        {[...Array(8)].map((_, i) => <ConversationSkeleton key={i} />)}
                    </div>
                ) : conversations.length > 0 ? (
                    <>
                        {conversations.map(convo => (
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
                                    <p className="text-sm text-muted-foreground truncate">{convo.history?.[convo.history.length-1]?.content || 'No messages yet'}</p>
                                </div>
                            </button>
                        ))}
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
