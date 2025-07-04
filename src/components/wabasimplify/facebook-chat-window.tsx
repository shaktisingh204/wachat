
'use client';

import type { WithId, Project, FacebookConversation, FacebookMessage } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ArrowLeft } from 'lucide-react';
import { FacebookChatMessage } from './facebook-chat-message';
import { FacebookMessageInput } from './facebook-message-input';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useEffect, useRef } from 'react';


interface FacebookChatWindowProps {
    project: WithId<Project>;
    conversation: FacebookConversation;
    messages: FacebookMessage[];
    isLoading: boolean;
    onBack: () => void;
    onMessageSent: () => void;
}

export function FacebookChatWindow({ project, conversation, messages, isLoading, onBack, onMessageSent }: FacebookChatWindowProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const participant = conversation.participants.data.find(p => p.id !== project.facebookPageId);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between gap-3 p-3 border-b h-[73px] flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Avatar>
                        <AvatarImage src={`https://graph.facebook.com/${participant?.id}/picture`} alt={participant?.name || 'U'} />
                        <AvatarFallback>{participant?.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{participant?.name}</p>
                        <p className="text-sm text-muted-foreground">Messenger</p>
                    </div>
                </div>
            </div>
            
            <ScrollArea className="flex-1 bg-muted/30" viewportClassName="scroll-container">
                    <div className="p-4 space-y-4">
                        {isLoading ? (
                            <Skeleton className="h-48 w-full"/>
                        ) : (
                            messages.map((msg) => (
                                <FacebookChatMessage key={msg.id} message={msg} pageId={project.facebookPageId!} />
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>
            </ScrollArea>
            
            <div className="flex items-center p-2 border-t bg-background h-[60px] flex-shrink-0">
                {participant && project.facebookPageId && (
                    <FacebookMessageInput
                        projectId={project._id.toString()}
                        recipientId={participant.id}
                        onMessageSent={onMessageSent}
                        disabled={!conversation.can_reply}
                    />
                )}
            </div>
        </div>
    );
}
