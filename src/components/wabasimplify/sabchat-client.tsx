
'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
    const router = useRouter();
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
            router.replace(`/dashboard/sabchat/inbox?conversationId=${conversation._id.toString()}`, { scroll: false });
        });
    }, [router]);

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
