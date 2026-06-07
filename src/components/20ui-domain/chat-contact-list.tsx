'use client';

import {
    ScrollArea,
    Button,
    IconButton,
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    Skeleton,
    Spinner,
    Input,
    EmptyState,
    SegmentedControl,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';
import { MessageSquarePlus, Search, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';

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

    const filterItems = useMemo(
        () => [
            { value: 'all' as const, label: 'All' },
            { value: 'unread' as const, label: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread' },
        ],
        [unreadCount],
    );

    const phoneNumbers = project?.phoneNumbers || [];

    const ContactSkeleton = () => (
        <div className="flex items-center gap-3 p-3">
            <Skeleton circle width={40} />
            <div className="flex-1 space-y-2">
                <Skeleton height={16} width="75%" />
                <Skeleton height={12} width="50%" />
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[var(--st-bg-secondary)]">
            <div className="p-3 border-b border-[var(--st-border)] flex-shrink-0 flex items-center justify-between">
                {sessionUser ? (
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={`https://i.pravatar.cc/150?u=${sessionUser.email}`} alt={sessionUser.name} data-ai-hint="person avatar" />
                            <AvatarFallback>{sessionUser.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold text-[var(--st-text)]">{sessionUser.name}</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <Skeleton circle width={40} />
                        <div className="space-y-2"><Skeleton height={16} width={96} /><Skeleton height={12} width={64} /></div>
                    </div>
                )}
                <IconButton
                    label="New chat"
                    icon={MessageSquarePlus}
                    variant="ghost"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onNewChat();
                    }}
                />
            </div>

            <div className="p-3 border-b border-[var(--st-border)] flex-shrink-0 space-y-3">
                <Input
                    type="search"
                    placeholder="Search or start new chat"
                    iconLeft={Search}
                    aria-label="Search contacts"
                    onChange={(e) => handleSearch(e.target.value)}
                />
                <Select
                    value={selectedPhoneNumberId}
                    onValueChange={onPhoneNumberChange}
                    disabled={phoneNumbers.length === 0}
                >
                    <SelectTrigger id="phoneNumberId" aria-label="Phone number">
                        <SelectValue placeholder="Select a phone number..." />
                    </SelectTrigger>
                    <SelectContent>
                        {phoneNumbers.map((phone) => (
                            <SelectItem key={phone.id} value={phone.id}>
                                {phone.display_phone_number} ({phone.verified_name})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* All / Unread filter pills */}
            <div className="px-3 py-2 border-b border-[var(--st-border)] flex-shrink-0">
                <SegmentedControl
                    items={filterItems}
                    value={chatFilter}
                    onChange={setChatFilter}
                    size="sm"
                    aria-label="Filter chats"
                />
            </div>

            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-2 space-y-1">
                        {[...Array(8)].map((_, i) => <ContactSkeleton key={i} />)}
                    </div>
                ) : filteredContacts.length > 0 ? (
                    <>
                        {filteredContacts.map(contact => {
                            const rowUnread = contact.unreadCount || 0;
                            const lastMsgTime = contact.lastMessageTimestamp;
                            const lastMsgContent = contact.lastMessage || 'No messages yet.';
                            const isSelected = selectedContactId === contact._id.toString();

                            return (
                                <Button
                                    key={contact._id.toString()}
                                    variant="ghost"
                                    onClick={() => onSelectContact(contact)}
                                    aria-pressed={isSelected}
                                    className={cn(
                                        'mx-2 mb-1 w-[calc(100%-16px)] !h-auto !items-start !justify-start !p-3 !rounded-xl text-left transition-all duration-200 hover:bg-[var(--st-bg-muted)]/50',
                                        isSelected && 'bg-[var(--st-bg-muted)] shadow-sm'
                                    )}
                                >
                                    <span className="flex w-full items-start gap-3">
                                        <Avatar>
                                            <AvatarFallback>{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <span className="flex-1 min-w-0 pt-0.5">
                                            <span className="flex justify-between items-start">
                                                <span className={cn(
                                                    'font-medium truncate pr-2',
                                                    rowUnread > 0 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]/80'
                                                )}>
                                                    {contact.name || contact.waId}
                                                </span>
                                                {lastMsgTime && (
                                                    <span className="text-[10px] text-[var(--st-text-secondary)] whitespace-nowrap flex-shrink-0 mt-0.5">
                                                        {format(new Date(lastMsgTime), 'HH:mm')}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="flex justify-between items-center mt-0.5">
                                                <span className="text-xs text-[var(--st-text-secondary)] truncate block max-w-[180px]">
                                                    {lastMsgContent}
                                                </span>
                                                {rowUnread > 0 && (
                                                    <Badge tone="accent" kind="solid" className="ml-1.5 flex-shrink-0">
                                                        {rowUnread}
                                                    </Badge>
                                                )}
                                            </span>
                                        </span>
                                    </span>
                                </Button>
                            );
                        })}
                        <div ref={loadMoreRef} className="flex justify-center items-center p-4">
                            {hasMoreContacts && <Spinner size="sm" label="Loading more contacts" />}
                        </div>
                    </>
                ) : (
                    <div className="p-8">
                        <EmptyState
                            icon={Users}
                            title={`No contacts found${searchQuery ? ' for your search' : ' for this number'}.`}
                            action={
                                !searchQuery ? (
                                    <Link href="/wachat/contacts">
                                        <Button variant="outline" size="sm">Import or add contacts</Button>
                                    </Link>
                                ) : undefined
                            }
                        />
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
