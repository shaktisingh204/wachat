
'use client';

import type { WithId, EmailConversation } from '@/lib/definitions';
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
import { EmailComposeDialog } from './email-compose-dialog';

interface EmailConversationListProps {
    conversations: WithId<EmailConversation>[];
    selectedConversationId?: string;
    onSelectConversation: (conversation: WithId<EmailConversation>) => void;
    isLoading: boolean;
}

export function EmailConversationList({ 
    conversations, 
    selectedConversationId, 
    onSelectConversation, 
    isLoading
}: EmailConversationListProps) {
    const [isComposeOpen, setIsComposeOpen] = useState(false);

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
            <EmailComposeDialog isOpen={isComposeOpen} onOpenChange={setIsComposeOpen} />
            <div className="h-full flex flex-col overflow-hidden bg-card border rounded-lg">
                <div className="p-3 border-b flex-shrink-0 flex items-center justify-between">
                    <h2 className="font-semibold">Inbox</h2>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsComposeOpen(true)}>
                        <Edit className="h-5 w-5" />
                        <span className="sr-only">Compose</span>
                    </Button>
                </div>

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
                                        <AvatarFallback>{convo.fromName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold truncate">{convo.fromName}</p>
                                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDistanceToNow(new Date(convo.lastMessageAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                        <p className="font-medium text-sm truncate">{convo.subject}</p>
                                        <p className="text-sm text-muted-foreground truncate">{convo.snippet}</p>
                                    </div>
                                </button>
                            ))}
                        </>
                    ) : (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            Your inbox is empty.
                        </div>
                    )}
                </ScrollArea>
            </div>
        </>
    );
}
