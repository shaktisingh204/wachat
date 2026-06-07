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
  Field,
  Input,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Search, MessageSquarePlus, MessagesSquare } from 'lucide-react';

import type { FacebookConversation, User, Plan } from '@/lib/definitions';

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
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    );

    const getParticipant = (convo: FacebookConversation) => {
        // A simple way to get the user, not the page
        return convo.participants.data.find(p => !p.name.includes("Page"));
    }

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
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div>
                    </div>
                )}
                <IconButton
                    label="New chat"
                    icon={MessageSquarePlus}
                    variant="ghost"
                    onClick={onNewChat}
                />
            </div>

            <div className="p-3 border-b border-[var(--st-border)] flex-shrink-0 space-y-3">
                <Field label="Search conversations">
                    <Input
                        type="search"
                        placeholder="Search conversations..."
                        iconLeft={Search}
                    />
                </Field>
            </div>
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-2 space-y-1">
                        {[...Array(8)].map((_, i) => <ConversationSkeleton key={i} />)}
                    </div>
                ) : conversations.length > 0 ? (
                    <ul className="flex flex-col">
                        {conversations.map(convo => {
                            const participant = getParticipant(convo);
                            const isSelected = selectedConversationId === convo.id;
                            return (
                                <li key={convo.id}>
                                    <Button
                                        variant="ghost"
                                        block
                                        onClick={() => onSelectConversation(convo)}
                                        aria-current={isSelected || undefined}
                                        className={cn(
                                            "h-auto items-center gap-3 p-3 text-left whitespace-normal border-b border-[var(--st-border)] rounded-none justify-start font-normal hover:bg-[var(--st-bg-muted)] [&_.u-btn__label]:flex [&_.u-btn__label]:w-full [&_.u-btn__label]:items-center [&_.u-btn__label]:gap-3 [&_.u-btn__label]:overflow-visible",
                                            isSelected && "bg-[var(--st-bg-muted)]"
                                        )}
                                    >
                                        <Avatar>
                                            <AvatarImage src={`https://graph.facebook.com/${participant?.id}/picture`} alt={participant?.name || 'Unknown User'} data-ai-hint="person avatar" />
                                            <AvatarFallback>{participant?.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                        </Avatar>
                                        <span className="flex-1 overflow-hidden block">
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="font-semibold truncate text-[var(--st-text)]">{participant?.name || 'Unknown User'}</span>
                                                <span className="text-xs text-[var(--st-text-secondary)] whitespace-nowrap font-normal">
                                                    {format(new Date(convo.updated_time), 'p')}
                                                </span>
                                            </span>
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="text-sm text-[var(--st-text-secondary)] truncate font-normal">{convo.snippet}</span>
                                                {convo.unread_count > 0 && (
                                                    <Badge tone="accent" className="h-5 min-w-5 flex items-center justify-center p-0 rounded-full">{convo.unread_count}</Badge>
                                                )}
                                            </span>
                                        </span>
                                    </Button>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <div className="p-8">
                        <EmptyState
                            icon={MessagesSquare}
                            title="No conversations found"
                            description="Messages from your connected Facebook page will appear here."
                            size="sm"
                        />
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
