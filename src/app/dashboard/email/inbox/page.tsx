
'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { getEmailConversations, updateEmailConversationStatus } from '@/app/actions/email.actions';
import type { WithId, EmailConversation } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Inbox } from 'lucide-react';
import { EmailConversationList } from '@/components/wabasimplify/email-conversation-list';
import { EmailThread } from '@/components/wabasimplify/email-thread';
import { useToast } from '@/hooks/use-toast';

function InboxSkeleton() {
    return (
        <div className="flex h-full">
            <div className="w-1/3 border-r p-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
            <div className="flex-1 p-4 flex flex-col gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-full w-full" />
            </div>
        </div>
    )
}

export default function EmailInboxPage() {
    const [conversations, setConversations] = useState<WithId<EmailConversation>[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<WithId<EmailConversation> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const data = await getEmailConversations();
            setConversations(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateStatus = async (conversationId: string, status: 'unread' | 'read' | 'archived' | 'follow_up') => {
        const result = await updateEmailConversationStatus(conversationId, status);
        if (result.success) {
            toast({ title: 'Success', description: 'Conversation status updated.' });
            fetchData(); // Re-fetch to update the list
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    if (isLoading && conversations.length === 0) {
        return <InboxSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8 h-full">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Inbox /> Email Inbox</h1>
                <p className="text-muted-foreground">Manage incoming email replies and conversations.</p>
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 h-[calc(100%-100px)]">
                <div className="col-span-1 xl:col-span-1 h-full">
                    <EmailConversationList 
                        conversations={conversations} 
                        onSelectConversation={setSelectedConversation}
                        selectedConversationId={selectedConversation?._id.toString()}
                    />
                </div>
                <div className="col-span-1 md:col-span-2 xl:col-span-3 h-full">
                    {selectedConversation ? (
                        <EmailThread 
                            key={selectedConversation._id.toString()}
                            conversation={selectedConversation} 
                            onStatusChange={handleUpdateStatus} 
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg text-muted-foreground">
                            <p>Select a conversation to view</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

