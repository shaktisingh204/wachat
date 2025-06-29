

'use client';

import { useEffect, useRef } from 'react';
import type { WithId } from 'mongodb';
import type { Contact, AnyMessage } from '@/app/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { ChatMessageInput } from './chat-message-input';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ArrowLeft } from 'lucide-react';

interface ChatWindowProps {
    contact: WithId<Contact>;
    conversation: AnyMessage[];
    isLoading: boolean;
    onBack: () => void;
}

export function ChatWindow({ contact, conversation, isLoading, onBack }: ChatWindowProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView();
    }, [conversation]);

    const MessageListSkeleton = () => (
         <div className="p-4 space-y-4">
            <div className="flex items-end gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-12 w-48 rounded-lg" />
            </div>
            <div className="flex items-end gap-2 justify-end">
                <Skeleton className="h-16 w-64 rounded-lg" />
            </div>
            <div className="flex items-end gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-24 w-56 rounded-lg" />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 p-3 border-b">
                 <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar>
                    <AvatarFallback>{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.waId}</p>
                </div>
            </div>
            
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {isLoading ? (
                        <MessageListSkeleton />
                    ) : (
                        <>
                            {conversation.map((msg) => (
                                <ChatMessage key={msg._id.toString()} message={msg} />
                            ))}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>
            </ScrollArea>
            
            <div className="p-4 border-t bg-background/80">
                <ChatMessageInput contact={contact} />
            </div>
        </div>
    );
}
