
'use client';

import type { FacebookConversation, User, Plan } from '@/lib/definitions';
import { ZoruScrollArea, ZoruButton } from '@/components/zoruui';
import { ZoruAvatar, ZoruAvatarFallback, ZoruAvatarImage } from '@/components/zoruui';
import { ZoruBadge } from '@/components/zoruui';
import { ZoruSkeleton } from '@/components/zoruui';
import { cn } from '@/lib/utils';
import { ZoruButton } from '../ui/button';
import { format } from 'date-fns';
import { Search, MessageSquarePlus } from 'lucide-react';
import { ZoruInput } from '../ui/input';
import type { WithId } from 'mongodb';

interface FacebookConversationListProps {
    sessionUser: (Omit<User, 'password'> & { _id: string, plan?: WithId<Plan> | null }) | null;
    conversations: FacebookConversation[];
    selectedConversationId?: string;
    onSelectConversation: (conversation: FacebookConversation) => void;
    onNewChat: () => void;
    isLoading: boolean;
}

export function FacebookConversationList({ sessionUser, conversations, selectedConversationId, onSelectConversation, onNewChat, isLoading }: FacebookConversationListProps) {

    const ConversationSkeleton = () => (
        <div className="flex items-center gap-3 p-3">
            <ZoruSkeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
                <ZoruSkeleton className="h-4 w-3/4" />
                <ZoruSkeleton className="h-3 w-1/2" />
            </div>
        </div>
    );

    const getParticipant = (convo: FacebookConversation) => {
        // A simple way to get the user, not the page
        return convo.participants.data.find(p => !p.name.includes("Page"));
    }

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
                <ZoruButton variant="ghost" size="icon" className="h-8 w-8" onClick={onNewChat}>
                    <MessageSquarePlus className="h-5 w-5" />
                    <span className="sr-only">New Chat</span>
                </ZoruButton>
            </div>

            <div className="p-3 border-b flex-shrink-0 space-y-3">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <ZoruInput placeholder="Search conversations..." className="pl-8" />
                </div>
            </div>
            <ZoruScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-2 space-y-1">
                        {[...Array(8)].map((_, i) => <ConversationSkeleton key={i} />)}
                    </div>
                ) : conversations.length > 0 ? (
                    <>
                        {conversations.map(convo => {
                            const participant = getParticipant(convo);
                            return (
                                <button
                                    key={convo.id}
                                    onClick={() => onSelectConversation(convo)}
                                    className={cn(
                                        "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent border-b",
                                        selectedConversationId === convo.id && "bg-accent"
                                    )}
                                >
                                    <ZoruAvatar>
                                        <ZoruAvatarImage src={`https://graph.facebook.com/${participant?.id}/picture`} alt={participant?.name || 'U'} data-ai-hint="person avatar" />
                                        <ZoruAvatarFallback>{participant?.name.charAt(0).toUpperCase() || 'U'}</ZoruAvatarFallback>
                                    </ZoruAvatar>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold truncate">{participant?.name || 'Unknown User'}</p>
                                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                {format(new Date(convo.updated_time), 'p')}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-muted-foreground truncate">{convo.snippet}</p>
                                            {convo.unread_count > 0 && (
                                                <ZoruBadge className="h-5 w-5 flex items-center justify-center p-0 rounded-full bg-primary text-primary-foreground">{convo.unread_count}</ZoruBadge>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </>
                ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No conversations found.
                    </div>
                )}
            </ZoruScrollArea>
        </div>
    );
}
