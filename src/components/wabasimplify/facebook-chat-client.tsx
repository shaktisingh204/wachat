
'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getFacebookChatInitialData, getFacebookConversationMessages } from '@/app/actions/facebook.actions';
import type { WithId, Project, FacebookConversation, FacebookMessage } from '@/lib/definitions';
import { FacebookConversationList } from './facebook-conversation-list';
import { FacebookChatWindow } from './facebook-chat-window';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FacebookChatClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const conversationIdFromUrl = searchParams.get('conversationId');

    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [conversations, setConversations] = useState<FacebookConversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<FacebookConversation | null>(null);
    const [messages, setMessages] = useState<FacebookMessage[]>([]);
    
    const [isLoading, startLoadingTransition] = useTransition();
    const [loadingConversation, startConversationLoadTransition] = useTransition();
    
    const [projectId, setProjectId] = useState<string|null>(null);

    const fetchInitialData = useCallback((pid: string) => {
        startLoadingTransition(async () => {
            const { project: projectData, conversations: convosData, error } = await getFacebookChatInitialData(pid);
            if (error) {
                // handle error, maybe show toast
                console.error(error);
                return;
            }
            setProject(projectData);
            setConversations(convosData);

            if (conversationIdFromUrl) {
                const convo = convosData.find(c => c.id === conversationIdFromUrl);
                if (convo) {
                    handleSelectConversation(convo);
                }
            }
        });
    }, [conversationIdFromUrl]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
        if (storedProjectId) {
            fetchInitialData(storedProjectId);
        }
    }, [fetchInitialData]);

    const handleSelectConversation = useCallback(async (conversation: FacebookConversation) => {
        if (!projectId) return;

        setSelectedConversation(conversation);
        router.push(`/dashboard/facebook/messages?conversationId=${conversation.id}`);

        startConversationLoadTransition(async () => {
            const { messages: fetchedMessages, error } = await getFacebookConversationMessages(conversation.id, projectId);
            if (error) {
                console.error(error);
                setMessages([]);
            } else {
                setMessages(fetchedMessages || []);
            }
        });
        
        // Optimistically mark as read on client
        setConversations(prev => prev.map(c => c.id === conversation.id ? {...c, unread_count: 0} : c));

    }, [projectId, router]);
    
    const onMessageSent = async () => {
        if (selectedConversation && projectId) {
            const { messages: fetchedMessages } = await getFacebookConversationMessages(selectedConversation.id, projectId);
            setMessages(fetchedMessages || []);
        }
    }

    if (!projectId) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to use the Facebook inbox.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    if (isLoading) {
        return <Skeleton className="h-full w-full"/>
    }

    return (
        <div className="flex flex-1 overflow-hidden h-full">
            <div className={cn("w-full flex-col border-r md:w-1/3 lg:w-1/4", selectedConversation ? "hidden md:flex" : "flex")}>
                <FacebookConversationList
                    conversations={conversations}
                    selectedConversationId={selectedConversation?.id}
                    onSelectConversation={handleSelectConversation}
                    isLoading={isLoading}
                />
            </div>
             <div className={cn("w-full flex-col flex-1", selectedConversation ? "flex" : "hidden md:flex")}>
                 {selectedConversation && project ? (
                    <FacebookChatWindow
                        key={selectedConversation.id}
                        project={project}
                        conversation={selectedConversation}
                        messages={messages}
                        isLoading={loadingConversation}
                        onBack={() => setSelectedConversation(null)}
                        onMessageSent={onMessageSent}
                    />
                 ) : (
                    <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground gap-4 p-8 text-center">
                        <MessageSquare className="h-16 w-16" />
                        <h2 className="text-xl font-semibold">Select a conversation</h2>
                        <p>Choose a conversation from the list to start messaging.</p>
                    </div>
                 )}
             </div>
        </div>
    );
}
