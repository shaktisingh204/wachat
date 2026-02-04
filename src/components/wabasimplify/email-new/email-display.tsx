'use client';

import React from 'react';
import { Mail, Reply, ReplyAll, Forward, MoreVertical, Trash2, Archive, Paperclip } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { mockConversations } from './email-data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';

export function EmailDisplay() {
    const searchParams = useSearchParams();
    const selectedId = searchParams.get('id');
    const conversation = mockConversations.find(c => c._id.toString() === selectedId);

    if (!selectedId || !conversation) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-muted-foreground bg-background/50">
                <div className="p-6 bg-background rounded-full mb-4 shadow-sm border">
                    <Mail className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p>Select an email to view details</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={!conversation}>
                                    <Archive className="h-4 w-4" />
                                    <span className="sr-only">Archive</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Archive</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={!conversation}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Move to trash</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move to trash</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" disabled={!conversation}>
                        <Reply className="h-4 w-4" />
                        <span className="sr-only">Reply</span>
                    </Button>
                    <Button variant="ghost" size="icon" disabled={!conversation}>
                        <ReplyAll className="h-4 w-4" />
                        <span className="sr-only">Reply all</span>
                    </Button>
                    <Button variant="ghost" size="icon" disabled={!conversation}>
                        <Forward className="h-4 w-4" />
                        <span className="sr-only">Forward</span>
                    </Button>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">More</span>
                    </Button>
                </div>
            </div>

            {/* Content Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="flex items-start justify-between">
                    <h1 className="text-xl md:text-2xl font-bold mb-4">{conversation.subject}</h1>
                    {conversation.labels?.map(l => (
                        <span key={l} className="text-xs font-mono bg-muted px-2 py-1 rounded-full uppercase">{l}</span>
                    ))}
                </div>

                <div className="space-y-6">
                    {conversation.messages.map((message) => (
                        <div key={message.id} className="flex flex-col gap-4 border p-4 rounded-xl shadow-sm bg-card">
                            <div className="flex items-start gap-4">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage alt={message.from.name} />
                                    <AvatarFallback>{message.from.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="grid gap-1">
                                    <div className="font-semibold">{message.from.name}</div>
                                    <div className="text-xs text-muted-foreground">{message.from.email}</div>
                                    <div className="text-xs text-muted-foreground">
                                        To: {message.to.map(t => t.name).join(', ')}
                                    </div>
                                </div>
                                <div className="ml-auto text-xs text-muted-foreground">
                                    {format(new Date(message.date), 'PPpp')}
                                </div>
                            </div>
                            <Separator />
                            <div className="text-sm prose prose-neutral dark:prose-invert max-w-none">
                                <div dangerouslySetInnerHTML={{ __html: message.bodyHtml }}></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Reply Area (Optimistic) */}
                <div className="mt-6 flex gap-4">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback>ME</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                        <Textarea
                            placeholder={`Reply to ${conversation.participants[0].name}...`}
                            className="min-h-[100px]"
                        />
                        <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon"><Paperclip className="h-4 w-4" /></Button>
                            </div>
                            <Button size="sm">
                                <Reply className="mr-2 h-4 w-4" /> Send Reply
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
