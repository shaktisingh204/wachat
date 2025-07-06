
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import type { Contact, AnyMessage, Project, Template } from '@/lib/definitions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { ChatMessageInput } from './chat-message-input';
import { Button } from '../ui/button';
import { ArrowLeft, Info, LoaderCircle, Check, Phone, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleUpdateContactStatus } from '@/app/actions';

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
    const { toast } = useToast();
    const [isUpdatingStatus, startStatusUpdateTransition] = useTransition();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [conversation]);
    
    const handleMarkResolved = () => {
        startStatusUpdateTransition(async () => {
            const result = await handleUpdateContactStatus(contact._id.toString(), 'resolved', contact.assignedAgentId || '');
            if (result.success) {
                toast({ title: 'Success', description: 'Conversation marked as resolved.' });
                onContactUpdate({ ...contact, status: 'resolved' });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
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
                        {conversation.map((msg) => (
                            <ChatMessage key={msg._id.toString()} message={msg} />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </ScrollArea>
            
            <div className="flex items-center p-3 border-t bg-background flex-shrink-0">
                <ChatMessageInput contact={contact} templates={templates} />
            </div>
        </div>
    );
}
