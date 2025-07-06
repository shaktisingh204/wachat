
'use client';

import type { WithId, Project, FacebookConversation, FacebookMessage } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ArrowLeft, Info, LoaderCircle, Phone, Video } from 'lucide-react';
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
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    return (
        <div className="flex flex-col h-full bg-transparent">
            <div className="flex items-center justify-between gap-3 p-3 border-b bg-background h-[73px] flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Avatar>
                        <AvatarImage src={`https://graph.facebook.com/${participant?.id}/picture`} alt={participant?.name || 'U'} data-ai-hint="person avatar"/>
                        <AvatarFallback>{participant?.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{participant?.name}</p>
                        <p className="text-sm text-muted-foreground">online</p>
                    </div>
                </div>
                 <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" disabled><Phone className="h-5 w-5" /></Button>
                    <Button variant="ghost" size="icon" disabled><Video className="h-5 w-5" /></Button>
                    <Button variant="ghost" size="icon"><Info className="h-5 w-5" /></Button>
                </div>
            </div>
            
            <ScrollArea className="flex-1 bg-chat-texture" viewportClassName="scroll-container">
                <div className="p-4 space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <FacebookChatMessage key={msg.id} message={msg} pageId={project.facebookPageId!} />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>
            
            <div className="flex items-center p-3 border-t bg-background flex-shrink-0">
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
