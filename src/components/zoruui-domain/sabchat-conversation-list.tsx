'use client';

import {
  ScrollArea,
  Avatar,
  AvatarFallback,
  Skeleton,
  Button,
  Input,
  Field,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Search, MessageSquare } from 'lucide-react';

import type { WithId, SabChatSession } from '@/lib/definitions';

import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface SabChatConversationListProps {
  conversations: WithId<SabChatSession>[];
  selectedConversationId?: string;
  onSelectConversation: (conversation: WithId<SabChatSession>) => void;
  isLoading: boolean;
}

export function SabChatConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  isLoading,
}: SabChatConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
  }, 300);

  const filteredConversations = conversations.filter(
    (convo) =>
      convo.visitorInfo?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      convo.history.some((msg) =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  const ConversationSkeleton = () => (
    <div className="flex items-center gap-3 p-3">
      <Skeleton circle width={40} />
      <div className="flex-1 space-y-2">
        <Skeleton height={16} width="75%" />
        <Skeleton height={12} width="50%" />
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--st-bg-secondary)]">
      <div className="flex-shrink-0 border-b border-[var(--st-border)] p-3">
        <Field>
          <Input
            type="search"
            placeholder="Search by email or message..."
            aria-label="Search conversations by email or message"
            iconLeft={Search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </Field>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {[...Array(8)].map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          <>
            {filteredConversations.map((convo) => {
              const lastMessage = convo.history[convo.history.length - 1];
              const isSelected = selectedConversationId === convo._id.toString();
              return (
                <Button
                  key={convo._id.toString()}
                  variant="ghost"
                  block
                  onClick={() => onSelectConversation(convo)}
                  className={cn(
                    'h-auto items-start justify-start gap-3 whitespace-normal rounded-none border-b border-[var(--st-border)] p-3 text-left [&_.u-btn__label]:block [&_.u-btn__label]:w-full [&_.u-btn__label]:overflow-visible',
                    isSelected && 'bg-[var(--st-bg-muted)]',
                  )}
                >
                  <span className="flex w-full items-start gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {convo.visitorInfo?.email?.charAt(0).toUpperCase() || 'V'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 overflow-hidden">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-[var(--st-text)]">
                          {convo.visitorInfo?.email || 'New Visitor'}
                        </span>
                        <span className="whitespace-nowrap text-xs text-[var(--st-text-secondary)]">
                          {formatDistanceToNow(new Date(convo.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </span>
                      <span className="block truncate text-sm text-[var(--st-text-secondary)]">
                        {lastMessage?.content || 'No messages yet.'}
                      </span>
                    </span>
                  </span>
                </Button>
              );
            })}
          </>
        ) : (
          <div className="p-8">
            <EmptyState
              icon={MessageSquare}
              title="No conversations found"
              description="New visitor chats will appear here as they arrive."
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
