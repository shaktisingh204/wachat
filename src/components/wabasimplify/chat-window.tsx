

'use client';

import { useEffect, useRef, useState } from 'react';
import type { WithId } from 'mongodb';
import type { Contact, AnyMessage, Project } from '@/app/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { ChatMessageInput } from './chat-message-input';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ArrowLeft, Info } from 'lucide-react';
import { ContactInfoPanel } from './contact-info-panel';

interface ChatWindowProps {
    project: WithId<Project>;
    contact: WithId<Contact>;
    conversation: AnyMessage[];
    isLoading: boolean;
    onBack: () => void;
    onContactUpdate: (updatedContact: WithId<Contact>) => void;
}

export function ChatWindow({ project, contact, conversation, isLoading, onBack, onContactUpdate }: ChatWindowProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        <>
            <ContactInfoPanel 
                project={project}
                contact={contact}
                isOpen={isInfoPanelOpen}
                onOpenChange={setIsInfoPanelOpen}
                onContactUpdate={onContactUpdate}
            />
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between gap-3 px-3 border-b h-[50px] flex-shrink-0">
                    <div className="flex items-center gap-3">
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
                     <Button variant="ghost" size="icon" onClick={() => setIsInfoPanelOpen(true)}>
                        <Info className="h-5 w-5" />
                        <span className="sr-only">Contact Info</span>
                    </Button>
                </div>
                
                <ScrollArea className="flex-1 bg-background/50">
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
                
                <div className="flex items-center p-2 border-t bg-background h-[50px] flex-shrink-0">
                    <ChatMessageInput contact={contact} />
                </div>
            </div>
        </>
    );
}
