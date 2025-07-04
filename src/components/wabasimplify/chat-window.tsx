

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import type { Contact, AnyMessage, Project, Template } from '@/lib/definitions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { ChatMessageInput } from './chat-message-input';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ArrowLeft, Info, LoaderCircle, Check } from 'lucide-react';
import { ContactInfoPanel } from './contact-info-panel';
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
}

function MessageListSkeleton() {
    return (
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
}

export function ChatWindow({ project, contact, conversation, templates, isLoading, onBack, onContactUpdate }: ChatWindowProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
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
        <>
            <ContactInfoPanel 
                project={project}
                contact={contact}
                isOpen={isInfoPanelOpen}
                onOpenChange={setIsInfoPanelOpen}
                onContactUpdate={onContactUpdate}
            />
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between gap-3 p-3 border-b h-[50px] flex-shrink-0">
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
                     <div className="flex items-center gap-2">
                        {contact.status !== 'resolved' && (
                            <Button variant="outline" size="sm" onClick={handleMarkResolved} disabled={isUpdatingStatus}>
                                {isUpdatingStatus ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Mark as Resolved
                            </Button>
                        )}
                         <Button variant="ghost" size="icon" onClick={() => setIsInfoPanelOpen(true)}>
                            <Info className="h-5 w-5" />
                            <span className="sr-only">Contact Info</span>
                        </Button>
                    </div>
                </div>
                
                <ScrollArea className="flex-1 bg-background/50" viewportClassName="scroll-container">
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
                
                <div className="flex items-center p-2 border-t bg-background h-[60px] flex-shrink-0">
                    <ChatMessageInput contact={contact} templates={templates} />
                </div>
            </div>
        </>
    );
}
