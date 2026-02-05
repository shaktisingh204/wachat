
'use client';

import type { WithId, Contact, Project, User, Plan } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { LoaderCircle, MessageSquarePlus, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format } from 'date-fns';
import { useDebouncedCallback } from 'use-debounce';

interface ChatContactListProps {
    sessionUser: (Omit<User, 'password'> & { _id: string, plan?: WithId<Plan> | null }) | null;
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
    sessionUser,
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
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
    }, 300);

    const filteredContacts = useMemo(() => {
        if (!searchQuery) return contacts;
        const lowercasedQuery = searchQuery.toLowerCase();
        return contacts.filter(contact =>
            contact.name.toLowerCase().includes(lowercasedQuery) ||
            contact.waId.includes(searchQuery)
        );
    }, [contacts, searchQuery]);

    const getStatusVariant = (status?: string) => {
        if (!status) return 'secondary';
        const s = status.toLowerCase();
        if (s === 'open') return 'destructive';
        if (s === 'new') return 'default';
        if (s === 'resolved') return 'outline';
        return 'secondary';
    }


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
            <div className="p-3 border-b flex-shrink-0 flex items-center justify-between">
                {sessionUser ? (
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={`https://i.pravatar.cc/150?u=${sessionUser.email}`} data-ai-hint="person avatar" />
                            <AvatarFallback>{sessionUser.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold">{sessionUser.name}</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div>
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("New Chat button clicked in Contact List");
                        onNewChat();
                    }}
                    className="h-8 w-8"
                >
                    <MessageSquarePlus className="h-5 w-5" />
                    <span className="sr-only">New Chat</span>
                </Button>
            </div>

            <div className="p-3 border-b flex-shrink-0 space-y-3">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search or start new chat"
                        className="pl-8"
                        onChange={(e) => handleSearch(e.target.value)}
                    />
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
                ) : filteredContacts.length > 0 ? (
                    <>
                        {filteredContacts.map(contact => {
                            const unreadCount = contact.unreadCount || 0;
                            const lastMsgTime = contact.lastMessageTimestamp;
                            const lastMsgContent = contact.lastMessage || 'No messages yet.';

                            return (
                                <button
                                    key={contact._id.toString()}
                                    onClick={() => onSelectContact(contact)}
                                    className={cn(
                                        "flex w-full items-start gap-3 p-3 text-left transition-all duration-200 rounded-xl mx-2 mb-1 w-[calc(100%-16px)] hover:bg-accent/50",
                                        selectedContactId === contact._id.toString() && "bg-accent shadow-sm"
                                    )}
                                >
                                    <Avatar>
                                        <AvatarFallback>{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="flex justify-between items-start">
                                            <span className={cn(
                                                "font-medium truncate pr-2",
                                                unreadCount > 0 ? "text-foreground" : "text-foreground/80"
                                            )}>
                                                {contact.name || contact.waId}
                                            </span>
                                            {lastMsgTime && (
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                                                    {format(new Date(lastMsgTime), 'HH:mm')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center mt-0.5">
                                            <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
                                                {lastMsgContent}
                                            </span>
                                            {unreadCount > 0 && (
                                                <Badge variant="default" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] flex-shrink-0 ml-1.5">
                                                    {unreadCount}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                        <div ref={loadMoreRef} className="flex justify-center items-center p-4">
                            {hasMoreContacts && <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />}
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No contacts found{searchQuery ? ' for your search' : ' for this number'}.
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
