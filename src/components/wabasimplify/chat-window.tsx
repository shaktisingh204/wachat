
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
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle } from 'lucide-react';

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

const Countdown = ({ targetTime, onExpire }: { targetTime: number, onExpire: () => void }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetTime - now;

            if (distance < 0) {
                clearInterval(timer);
                setTimeLeft("Session Expired");
                onExpire();
                return;
            }

            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        }, 1000);

        return () => clearInterval(timer);
    }, [targetTime, onExpire]);

    return <span className="font-mono text-xs">{timeLeft}</span>;
};

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
    const viewportRef = useRef<HTMLDivElement>(null);
    const { sessionUser } = useProject();
    const [replyToMessage, setReplyToMessage] = useState<AnyMessage | null>(null);
    const [isWindowExpired, setIsWindowExpired] = useState(false);
    
    const lastUserMessage = useMemo(() => 
        conversation
            .filter(m => m.direction === 'in')
            .sort((a, b) => new Date(b.messageTimestamp).getTime() - new Date(a.messageTimestamp).getTime())
            [0]
    , [conversation]);

    const sessionExpiryTime = useMemo(() => {
        if (!lastUserMessage) return null;
        return new Date(lastUserMessage.messageTimestamp).getTime() + 24 * 60 * 60 * 1000;
    }, [lastUserMessage]);
    
    useEffect(() => {
        if (sessionExpiryTime) {
            setIsWindowExpired(Date.now() > sessionExpiryTime);
        } else {
            // If there are no user messages, the window is effectively closed for free-form replies.
            setIsWindowExpired(true);
        }
    }, [sessionExpiryTime, conversation]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport) {
            const isScrolledToBottom = viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 100; // 100px threshold
            if (isScrolledToBottom) {
                setTimeout(() => {
                    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
                }, 100);
            }
        }
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
                 <div className="flex items-center gap-2">
                    {sessionExpiryTime && !isWindowExpired && (
                        <div className="hidden sm:block text-xs bg-muted text-muted-foreground p-2 rounded-md">
                            Session closes in: <Countdown targetTime={sessionExpiryTime} onExpire={() => setIsWindowExpired(true)} />
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" disabled><Phone className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" disabled><Video className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={onInfoToggle}>
                            <Info className="h-5 w-5" />
                            <span className="sr-only">Contact Info</span>
                        </Button>
                    </div>
                </div>
            </div>
            
            <ScrollArea viewportRef={viewportRef} className="flex-1 bg-chat-texture" viewportClassName="scroll-container">
                 {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                         <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {processedConversation.map((msg) => (
                            <ChatMessage key={msg._id.toString()} message={msg} conversation={conversation} onReply={handleReply}/>
                        ))}
                    </div>
                )}
            </ScrollArea>
            
            <div className="p-3 border-t bg-background flex-shrink-0 space-y-2">
                 {isWindowExpired && (
                     <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>24-Hour Window Closed</AlertTitle>
                        <AlertDescription>
                            You can no longer send free-form messages. Send a new template message to start a conversation.
                        </AlertDescription>
                    </Alert>
                )}
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
                    disabled={isWindowExpired}
                />
            </div>
        </div>
    );
}
