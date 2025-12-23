'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { WithId } from 'mongodb';
import type { Contact, AnyMessage, Project, Template } from '@/lib/definitions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { ChatMessageInput } from './chat-message-input';
import { Button } from '../ui/button';
import { ArrowLeft, Info, LoaderCircle, Phone, Video, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/context/project-context';

interface ChatWindowProps {
    project: WithId<Project>;
    contact: WithId<Contact>;
    conversation: AnyMessage[];
    templates: WithId<Template>[];
    isLoading: boolean;
    onBack: () => void;
    onContactUpdate: (updatedContact: WithId<Contact>) => void;
    onInfoToggle: () => void;
    isInfoPanelOpen: boolean;
}

export function ChatWindow({ 
    project, 
    contact, 
    conversation, 
    templates, 
    isLoading, 
    onBack, 
    onContactUpdate,
    onInfoToggle,
    isInfoPanelOpen
}: ChatWindowProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { sessionUser } = useProject();
    const [replyToMessage, setReplyToMessage] = useState<AnyMessage | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [conversation]);

    const processedConversation = useMemo(() => {
        const reactionsMap = new Map<string, AnyMessage['reaction']>();
        const messagesWithoutReactions: AnyMessage[] = [];

        for (const message of conversation) {
            if (message.type === 'reaction' && message.content.reaction?.message_id) {
                reactionsMap.set(message.content.reaction.message_id, message.content.reaction);
            } else {
                messagesWithoutReactions.push(message);
            }
        }
        
        return messagesWithoutReactions.map(message => {
            const reaction = reactionsMap.get(message.wamid);
            return reaction ? { ...message, reaction } : message;
        });
    }, [conversation]);
    
    const handleReply = (messageId: string) => {
        const messageToReply = conversation.find(m => m.wamid === messageId);
        if (messageToReply) {
            setReplyToMessage(messageToReply);
        }
    };

    return (
        <div className="flex flex-col h-full bg-transparent">
            <div className="flex items-center justify-between gap-3 p-3 border-b bg-background h-[73px] flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Avatar>
                        <AvatarFallback>{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">online</p>
                    </div>
                </div>
                 <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" disabled><Phone className="h-5 w-5" /></Button>
                    <Button variant="ghost" size="icon" disabled><Video className="h-5 w-5" /></Button>
                    <Button variant="ghost" size="icon" onClick={onInfoToggle}>
                        <Info className="h-5 w-5" />
                        <span className="sr-only">Contact Info</span>
                    </Button>
                </div>
            </div>
            
            <ScrollArea className="flex-1 bg-chat-texture" viewportClassName="scroll-container">
                 {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                         <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {processedConversation.map((msg) => (
                            <ChatMessage key={msg._id.toString()} message={msg} conversation={conversation} onReply={handleReply}/>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </ScrollArea>
            
            <div className="p-3 border-t bg-background flex-shrink-0">
                 {replyToMessage && (
                    <div className="p-2 mb-2 bg-muted rounded-md text-sm relative">
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setReplyToMessage(null)}>
                            <X className="h-4 w-4"/>
                        </Button>
                        <p className="font-semibold text-primary">
                            Replying to {replyToMessage.direction === 'out' ? 'You' : replyToMessage.content.profile?.name || 'User'}
                        </p>
                        <p className="text-muted-foreground truncate">
                            {replyToMessage.content.text?.body || 'Media or interactive message'}
                        </p>
                    </div>
                )}
                <ChatMessageInput 
                    project={project} 
                    contact={contact} 
                    templates={templates} 
                    replyToMessageId={replyToMessage?.wamid}
                />
            </div>
        </div>
    );
}