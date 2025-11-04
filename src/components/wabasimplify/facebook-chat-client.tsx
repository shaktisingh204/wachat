
'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getFacebookChatInitialData, getFacebookConversationMessages, markFacebookConversationAsRead, getProjects } from '@/app/actions/facebook.actions';
import { getSession } from '@/app/actions/index.ts';
import type { WithId, Project, FacebookConversation, FacebookMessage, User, Plan } from '@/lib/definitions';
import { FacebookConversationList } from './facebook-conversation-list';
import { FacebookChatWindow } from './facebook-chat-window';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, MessageSquare, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PermissionErrorDialog } from './permission-error-dialog';
import { Card } from '../ui/card';

export function FacebookChatClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const conversationIdFromUrl = searchParams.get('conversationId');

    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [sessionUser, setSessionUser] = useState<(Omit<User, 'password'> & { _id: string, plan?: WithId<Plan> | null }) | null>(null);
    const [conversations, setConversations] = useState<FacebookConversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<FacebookConversation | null>(null);
    const [messages, setMessages] = useState<FacebookMessage[]>([]);
    
    const [isLoading, startLoadingTransition] = useTransition();
    const [loadingConversation, startConversationLoadTransition] = useTransition();
    const [permissionError, setPermissionError] = useState<string | null>(null);
    
    const [projectId, setProjectId] = useState<string|null>(null);

    const fetchInitialData = useCallback((pid: string) => {
        startLoadingTransition(async () => {
             const [initialData, sessionData] = await Promise.all([
                getFacebookChatInitialData(pid),
                getSession()
            ]);
            const { project: projectData, conversations: convosData, error } = initialData;

            if (error) {
                if (error.includes('permission') || error.includes('(#200)')) {
                    setPermissionError(error);
                } else {
                    console.error(error);
                }
                setProject(projectData); // Still set project data if available
                return;
            }
            setProject(projectData);
            setConversations(convosData);
            setSessionUser(sessionData?.user || null);

            if (conversationIdFromUrl) {
                const convo = convosData.find(c => c.id === conversationIdFromUrl);
                if (convo) {
                    handleSelectConversation(convo, pid);
                }
            } else {
                 setSelectedConversation(null);
                 setMessages([]);
            }
        });
    }, [conversationIdFromUrl]);

    // This effect ensures we always have the latest projectId from localStorage
    // after any navigation event or page refresh.
     useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, [searchParams]);

    // This effect fetches data ONLY when the projectId changes.
    useEffect(() => {
        if (projectId) {
            fetchInitialData(projectId);
        } else {
            // If no project is selected, clear out the data.
            setProject(null);
            setConversations([]);
            setMessages([]);
            setSelectedConversation(null);
        }
    }, [projectId, fetchInitialData]);

    const handleSelectConversation = useCallback(async (conversation: FacebookConversation, pid?: string) => {
        const currentProjectId = pid || projectId;
        if (!currentProjectId) return;

        setSelectedConversation(conversation);
        router.push(`/dashboard/facebook/messages?conversationId=${conversation.id}`, { scroll: false });

        // Mark as read on server if needed
        if (conversation.unread_count > 0) {
            markFacebookConversationAsRead(conversation.id, currentProjectId);
        }

        startConversationLoadTransition(async () => {
            const { messages: fetchedMessages, error } = await getFacebookConversationMessages(conversation.id, currentProjectId);
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
    
    const onSuccessfulReconnect = () => {
        setPermissionError(null);
        if (projectId) {
            fetchInitialData(projectId);
        }
    }

    if (isLoading && !project) {
        return <Skeleton className="h-full w-full rounded-xl"/>
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
    
    return (
        <>
            <PermissionErrorDialog 
                isOpen={!!permissionError}
                onOpenChange={() => setPermissionError(null)}
                error={permissionError}
                project={project}
                onSuccess={onSuccessfulReconnect}
            />
            <Card className="h-full w-full flex flex-col overflow-hidden bg-muted/30 dark:bg-background">
                <div className="flex flex-1 overflow-hidden">
                    <div className={cn("w-full flex-col border-r bg-background md:w-[320px] flex-shrink-0", selectedConversation ? "hidden md:flex" : "flex")}>
                        <FacebookConversationList
                            sessionUser={sessionUser}
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
                            <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground gap-4 p-8 text-center bg-chat-texture">
                                <MessageSquare className="h-16 w-16" />
                                <h2 className="text-xl font-semibold">Select a conversation</h2>
                                <p>Choose a conversation from the list to start messaging.</p>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </>
    );
}
