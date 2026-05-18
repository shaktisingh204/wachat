'use client';

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruButton,
  ZoruSeparator,
  ZoruTooltip,
  ZoruTooltipContent,
  ZoruTooltipTrigger,
  ZoruTooltipProvider,
  ZoruTextarea,
  ZoruSelect,
} from '@/components/zoruui';
import {
  Mail,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical,
  Trash2,
  Archive,
  Paperclip } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { mockConversations } from './email-data';
import { format } from 'date-fns';

import React from 'react';

export function EmailDisplay({ initialAccountId }: { initialAccountId?: string }) {
    const searchParams = useSearchParams();
    const selectedId = searchParams.get('id');
    const accountId = searchParams.get('accountId') || initialAccountId;

    const [conversation, setConversation] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (selectedId && accountId) {
            const fetchThread = async () => {
                setIsLoading(true);
                try {
                    const { getEmailThreadDetails } = await import('@/app/actions/email.actions');
                    const data = await getEmailThreadDetails(accountId, selectedId);
                    setConversation(data);
                } catch (e) {
                    console.error("Failed to fetch thread", e);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchThread();
        } else {
            setConversation(null);
        }
    }, [selectedId, accountId]);

    if (!selectedId) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-muted-foreground bg-background/50">
                <div className="p-6 bg-background rounded-full mb-4 shadow-sm border">
                    <Mail className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p>ZoruSelect an email to view details</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col h-full bg-background p-8 space-y-6">
                <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
                <div className="space-y-2">
                    <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-64 bg-muted rounded animate-pulse" />
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
                <p>Email not found.</p>
            </div>
        );
    }

    // Construct simplified view model from messages
    // We assume the conversation object from backend has 'messages' array
    const subject = "Conversation" // ToDo: Get subject from first message or thread meta
    const messages = conversation.messages || [];
    const firstMessage = messages[0];

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <ZoruTooltipProvider>
                        <ZoruTooltip>
                            <ZoruTooltipTrigger asChild>
                                <ZoruButton variant="ghost" size="icon">
                                    <Archive className="h-4 w-4" />
                                    <span className="sr-only">Archive</span>
                                </ZoruButton>
                            </ZoruTooltipTrigger>
                            <ZoruTooltipContent>Archive</ZoruTooltipContent>
                        </ZoruTooltip>
                        <ZoruTooltip>
                            <ZoruTooltipTrigger asChild>
                                <ZoruButton variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Move to trash</span>
                                </ZoruButton>
                            </ZoruTooltipTrigger>
                            <ZoruTooltipContent>Move to trash</ZoruTooltipContent>
                        </ZoruTooltip>
                    </ZoruTooltipProvider>
                    <ZoruSeparator orientation="vertical" className="mx-1 h-6" />
                </div>
                <div className="flex items-center gap-2">
                    <ZoruButton variant="ghost" size="icon">
                        <Reply className="h-4 w-4" />
                        <span className="sr-only">Reply</span>
                    </ZoruButton>
                    <ZoruButton variant="ghost" size="icon">
                        <ReplyAll className="h-4 w-4" />
                        <span className="sr-only">Reply all</span>
                    </ZoruButton>
                    <ZoruButton variant="ghost" size="icon">
                        <Forward className="h-4 w-4" />
                        <span className="sr-only">Forward</span>
                    </ZoruButton>
                    <ZoruSeparator orientation="vertical" className="mx-1 h-6" />
                    <ZoruButton variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">More</span>
                    </ZoruButton>
                </div>
            </div>

            {/* Content Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="flex items-start justify-between">
                    {/* Subject is tricky in Gmail threads, usually same as first msg */}
                    <h1 className="text-xl md:text-2xl font-bold mb-4">{conversation.id} (Subject Placeholder)</h1>
                </div>

                <div className="space-y-6">
                    {messages.map((message: any) => (
                        <div key={message.id} className="flex flex-col gap-4 border p-4 rounded-xl shadow-sm bg-card">
                            <div className="flex items-start gap-4">
                                <ZoruAvatar className="h-10 w-10">
                                    <ZoruAvatarFallback>{message.from ? message.from.charAt(0) : '?'}</ZoruAvatarFallback>
                                </ZoruAvatar>
                                <div className="grid gap-1">
                                    <div className="font-semibold">{message.from}</div>
                                    <div className="ml-auto text-xs text-muted-foreground">
                                        {format(new Date(message.date), 'PPpp')}
                                    </div>
                                </div>
                            </div>
                            <ZoruSeparator />
                            <div className="text-sm prose prose-neutral dark:prose-invert max-w-none overflow-hidden">
                                {message.body && (
                                    <div dangerouslySetInnerHTML={{ __html: message.body }}></div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Reply Area (Optimistic) */}
                <div className="mt-6 flex gap-4">
                    <ZoruAvatar className="h-10 w-10">
                        <ZoruAvatarFallback>ME</ZoruAvatarFallback>
                    </ZoruAvatar>
                    <div className="flex-1 space-y-2">
                        <ZoruTextarea
                            placeholder={`Reply...`}
                            className="min-h-[100px]"
                        />
                        <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                                <ZoruButton variant="ghost" size="icon"><Paperclip className="h-4 w-4" /></ZoruButton>
                            </div>
                            <ZoruButton size="sm">
                                <Reply className="mr-2 h-4 w-4" /> Send Reply
                            </ZoruButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
