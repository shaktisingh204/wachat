'use client';

import { Input, ScrollArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import { Inbox, MessageSquare, Search } from 'lucide-react';

/**
 * Inbox left pane — search + filter + chat list.
 *
 * Rendered as the 300px column of the 3-pane inbox on desktop, and as
 * the full-screen view on mobile when no chat is selected. Filtering and
 * search live entirely in this component; the parent only needs to know
 * which chat got selected.
 */

import * as React from 'react';

import { ChatListRow } from '@/app/sabwa/_components/chat-list-row';
import { EmptyState } from '@/app/sabwa/_components/empty-state';
import { cn } from '@/lib/utils';
import { useResolveJid } from '@/lib/sabwa/format-jid';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import type { SabwaChat } from '@/lib/sabwa/types';

export type ChatFilter = 'all' | 'unread' | 'personal' | 'groups' | 'broadcasts';

export interface LeftPaneProps {
  chats: SabwaChat[];
  loading: boolean;
  activeJid: string | null;
  onSelectChat: (jid: string) => void;
  className?: string;
}

function applyFilter(
  chats: SabwaChat[],
  filter: ChatFilter,
  query: string,
): SabwaChat[] {
  const q = query.trim().toLowerCase();
  return chats.filter((c) => {
    if (filter === 'unread' && c.unreadCount <= 0) return false;
    if (filter === 'personal' && c.type !== 'individual') return false;
    if (filter === 'groups' && c.type !== 'group') return false;
    if (filter === 'broadcasts' && c.type !== 'broadcast') return false;
    if (q) {
      const haystack = `${c.name ?? ''} ${c.jid} ${c.lastMessage?.body ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function LeftPane({
  chats,
  loading,
  activeJid,
  onSelectChat,
  className,
}: LeftPaneProps) {
  const { current } = useSabwaSession();
  const resolve = useResolveJid(current?.id);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<ChatFilter>('all');

  const filtered = React.useMemo(
    () => applyFilter(chats, filter, query),
    [chats, filter, query],
  );

  // Pinned-first ordering, then most recent.
  const ordered = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessage?.ts ? new Date(a.lastMessage.ts).getTime() : 0;
      const bt = b.lastMessage?.ts ? new Date(b.lastMessage.ts).getTime() : 0;
      return bt - at;
    });
  }, [filtered]);

  return (
    <aside
      className={cn('flex h-full w-full flex-col bg-[var(--st-bg)]', className)}
      aria-label="Chats"
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--st-border)] p-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="h-9 pl-7"
            aria-label="Search chats"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as ChatFilter)}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All chats</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="groups">Groups</SelectItem>
            <SelectItem value="broadcasts">Broadcasts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md p-2"
                aria-hidden
              >
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--st-bg-secondary)]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--st-bg-secondary)]" />
                  <div className="h-2 w-4/5 animate-pulse rounded bg-[var(--st-bg-secondary)]" />
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="p-3">
            <EmptyState
              icon={<Inbox />}
              title="No chats yet"
              description="Your WhatsApp history will sync here within a minute of pairing. If it doesn't, try refreshing."
            />
          </div>
        ) : ordered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No chats"
            description={
              query || filter !== 'all'
                ? 'Try clearing the filter or search term.'
                : 'Connect a SabWa session to start syncing chats.'
            }
          />
        ) : (
          <ul className="py-1">
            {ordered.map((chat) => (
              <li key={chat.jid}>
                <ChatListRow
                  chat={chat}
                  selected={chat.jid === activeJid}
                  onClick={() => onSelectChat(chat.jid)}
                  resolve={resolve}
                />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}

export default LeftPane;
