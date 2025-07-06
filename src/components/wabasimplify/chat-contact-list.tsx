
'use client';

import type { WithId, Contact, Project } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { LoaderCircle, MessageSquarePlus, Search } from 'lucide-react';
import React from 'react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format } from 'date-fns';

interface ChatContactListProps {
    project: WithId<Project> | null;
    contacts: WithId<Contact>[];
    selectedContactId?: string;
    onSelectContact: (contact: WithId<Contact>) => void;
    onNewChat: () => void;
    isLoading: boolean;
    hasMoreContacts: boolean;
    loadMoreRef: React.Ref<HTMLDivElement>;
    selectedPhoneNumberId: string;
    onPhoneNumberChange: (phoneId: string) => void;
}

export function ChatContactList({ 
    project, 
    contacts, 
    selectedContactId, 
    onSelectContact, 
    onNewChat, 
    isLoading, 
    hasMoreContacts, 
    loadMoreRef, 
    selectedPhoneNumberId,
    onPhoneNumberChange
}: ChatContactListProps) {

    const ContactSkeleton = () => (
        <div className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    );
    
    return (
        <div className="h-full flex flex-col overflow-hidden bg-card">
            <div className="p-3 border-b flex-shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">Chats</h2>
                    <Button variant="ghost" size="icon" onClick={onNewChat} className="h-8 w-8">
                        <MessageSquarePlus className="h-5 w-5" />
                        <span className="sr-only">New Chat</span>
                    </Button>
                </div>
                 <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search contacts..." className="pl-8" />
                </div>
                 <Select value={selectedPhoneNumberId} onValueChange={onPhoneNumberChange} disabled={!project?.phoneNumbers || project.phoneNumbers.length === 0}>
                    <SelectTrigger id="phoneNumberId">
                        <SelectValue placeholder="Select a phone number..." />
                    </SelectTrigger>
                    <SelectContent>
                        {(project?.phoneNumbers || []).map((phone) => (
                            <SelectItem key={phone.id} value={phone.id}>
                                {phone.display_phone_number} ({phone.verified_name})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-2 space-y-1">
                        {[...Array(8)].map((_, i) => <ContactSkeleton key={i} />)}
                    </div>
                ) : contacts.length > 0 ? (
                    <>
                        {contacts.map(contact => (
                            <button
                                key={contact._id.toString()}
                                onClick={() => onSelectContact(contact)}
                                className={cn(
                                    "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent",
                                    selectedContactId === contact._id.toString() && "bg-accent"
                                )}
                            >
                                <Avatar>
                                    <AvatarFallback>{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 overflow-hidden">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold truncate">{contact.name}</p>
                                        {contact.lastMessageTimestamp && (
                                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                {format(new Date(contact.lastMessageTimestamp), 'p')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground truncate">{contact.lastMessage || 'No messages yet.'}</p>
                                        {contact.unreadCount && contact.unreadCount > 0 && (
                                            <Badge className="h-5 w-5 flex items-center justify-center p-0 rounded-full bg-primary text-primary-foreground">{contact.unreadCount}</Badge>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                        {hasMoreContacts && (
                            <div ref={loadMoreRef} className="flex justify-center items-center p-4">
                                <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No contacts found for this number.
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
