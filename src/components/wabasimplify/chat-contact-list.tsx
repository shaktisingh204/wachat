
'use client';

import type { WithId } from 'mongodb';
import type { Contact } from '@/app/actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChatContactListProps {
    contacts: WithId<Contact>[];
    selectedContactId?: string;
    onSelectContact: (contact: WithId<Contact>) => void;
    isLoading: boolean;
}

export function ChatContactList({ contacts, selectedContactId, onSelectContact, isLoading }: ChatContactListProps) {

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
        <div className="h-full flex flex-col">
            <div className="p-4 border-b">
                <h2 className="text-lg font-semibold tracking-tight">Contacts</h2>
            </div>
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-2 space-y-1">
                        {[...Array(8)].map((_, i) => <ContactSkeleton key={i} />)}
                    </div>
                ) : contacts.length > 0 ? (
                    contacts.map(contact => (
                        <button
                            key={contact._id.toString()}
                            onClick={() => onSelectContact(contact)}
                            className={cn(
                                "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted",
                                selectedContactId === contact._id.toString() && "bg-muted"
                            )}
                        >
                            <Avatar>
                                <AvatarFallback>{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden">
                                <p className="font-semibold truncate">{contact.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{contact.lastMessage}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 self-start">
                                <p className="text-xs text-muted-foreground whitespace-nowrap">
                                    {new Date(contact.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                {contact.unreadCount > 0 && (
                                    <Badge variant="default" className="h-5 w-5 flex items-center justify-center p-0">{contact.unreadCount}</Badge>
                                )}
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No contacts found for this number.
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
