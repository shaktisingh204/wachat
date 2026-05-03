'use client';

import Link from 'next/link';
import { UserCircle2 } from 'lucide-react';

import { ClayCard, ClayBadge } from '@/components/clay';
import { cn } from '@/lib/utils';
import type { WsConversationSummary } from '@/lib/worksuite/chat-types';

export interface ConversationsPaneProps {
  conversations: WsConversationSummary[];
  activePeerId: string | null;
}

function formatTime(value?: string | Date): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncate(text: string, n = 60): string {
  if (!text) return '';
  return text.length > n ? text.slice(0, n - 1) + '…' : text;
}

export function ConversationsPane({ conversations, activePeerId }: ConversationsPaneProps) {
  return (
    <ClayCard padded={false} className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[12.5px] font-medium text-muted-foreground">Conversations</p>
      </div>
      {conversations.length === 0 ? (
        <div className="flex h-40 items-center justify-center px-4 text-center text-[12.5px] text-muted-foreground">
          No conversations yet.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {conversations.map((c) => {
            const active = c.peer_user_id === activePeerId;
            return (
              <li key={c.peer_user_id}>
                <Link
                  href={`/dashboard/crm/messages/${c.peer_user_id}`}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 transition',
                    active ? 'bg-accent' : 'hover:bg-secondary',
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {c.peer_user_id}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatTime(c.last_message_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {truncate(c.last_message || '(attachment)')}
                    </p>
                  </div>
                  {c.unread_count > 0 ? (
                    <ClayBadge tone="rose" className="self-center">
                      {c.unread_count}
                    </ClayBadge>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ClayCard>
  );
}
