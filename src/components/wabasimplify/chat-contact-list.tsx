'use client';

import {
  ScrollArea,
  Button,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Skeleton,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import { cn } from '@/lib/utils';
import { LoaderCircle, MessageSquarePlus, Search, Users } from 'lucide-react';
import React,
  { useMemo,
  useState } from 'react';

import type { WithId, Contact, Project, User, Plan } from '@/lib/definitions';

import Link from 'next/link';

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
    const [chatFilter, setChatFilter] = useState<'all' | 'unread'>('all');

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
    }, 300);

    const filteredContacts = useMemo(() => {
        let result = contacts;

        // Apply unread filter
        if (chatFilter === 'unread') {
            result = result.filter(contact => (contact.unreadCount || 0) > 0);
        }

        // Apply search filter
        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            result = result.filter(contact =>
                contact.name.toLowerCase().includes(lowercasedQuery) ||
                contact.waId.includes(searchQuery)
            );
        }

        return result;
    }, [contacts, searchQuery, chatFilter]);

    const unreadCount = useMemo(() => contacts.filter(c => (c.unreadCount || 0) > 0).length, [contacts]);

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
            <ZoruSkeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
                <ZoruSkeleton className="h-4 w-3/4" />
                <ZoruSkeleton className="h-3 w-1/2" />
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col overflow-hidden bg-card">
            <div className="p-3 border-b flex-shrink-0 flex items-center justify-between">
                {sessionUser ? (
                    <div className="flex items-center gap-3">
                        <ZoruAvatar>
                            <ZoruAvatarImage src={`https://i.pravatar.cc/150?u=${sessionUser.email}`} data-ai-hint="person avatar" />
                            <ZoruAvatarFallback>{sessionUser.name.charAt(0)}</ZoruAvatarFallback>
                        </ZoruAvatar>
                        <p className="font-semibold">{sessionUser.name}</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <ZoruSkeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2"><ZoruSkeleton className="h-4 w-24" /><ZoruSkeleton className="h-3 w-16" /></div>
                    </div>
                )}
                <ZoruButton
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
                </ZoruButton>
            </div>

            <div className="p-3 border-b flex-shrink-0 space-y-3">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <ZoruInput
                        placeholder="Search or start new chat"
                        className="pl-8"
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
                <ZoruSelect value={selectedPhoneNumberId} onValueChange={onPhoneNumberChange} disabled={!project?.phoneNumbers || project.phoneNumbers.length === 0}>
                    <ZoruSelectTrigger id="phoneNumberId">
                        <ZoruSelectValue placeholder="Select a phone number..." />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {(project?.phoneNumbers || []).map((phone) => (
                            <ZoruSelectItem key={phone.id} value={phone.id}>
                                {phone.display_phone_number} ({phone.verified_name})
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>

            {/* All / Unread filter pills */}
            <div className="px-3 py-2 border-b flex-shrink-0 flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => setChatFilter('all')}
                    className={cn(
                        'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                        chatFilter === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                    )}
                >
                    All
                </button>
                <button
                    type="button"
                    onClick={() => setChatFilter('unread')}
                    className={cn(
                        'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                        chatFilter === 'unread'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                    )}
                >
                    Unread{unreadCount > 0 && ` (${unreadCount})`}
                </button>
            </div>

            <ZoruScrollArea className="flex-1">
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
                                    <ZoruAvatar>
                                        <ZoruAvatarFallback>{contact.name.charAt(0).toUpperCase()}</ZoruAvatarFallback>
                                    </ZoruAvatar>
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
                                                <ZoruBadge variant="default" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] flex-shrink-0 ml-1.5">
                                                    {unreadCount}
                                                </ZoruBadge>
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
                    <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground/50">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>No contacts found{searchQuery ? ' for your search' : ' for this number'}.</div>
                        {!searchQuery && (
                            <ZoruButton asChild variant="outline" size="sm" className="mt-2">
                                <Link href="/wachat/contacts">Import or add contacts</Link>
                            </ZoruButton>
                        )}
                    </div>
                )}
            </ZoruScrollArea>
        </div>
    );
}
