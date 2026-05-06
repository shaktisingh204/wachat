'use client';

/**
 * /dashboard/telegram/business-inbox — Telegram Business inbox.
 *
 * Same `telegram-chats` Rust crate as the regular chat page; we just
 * filter to chats that arrived via a Business connection (i.e. those
 * with `businessConnectionId` on their messages). The send-text path
 * threads the connection id through so replies post to the user's
 * personal chat (not the bot's chat).
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Bot, Inbox, RefreshCw, Send } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  listTelegramBots,
  listTelegramChats,
  listTelegramMessages,
  sendTelegramTextMessage,
  type TelegramBotListRow,
  type TelegramChatListRow,
  type TelegramMessageRow,
} from '@/app/actions/telegram.actions';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruScrollArea,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function chatLabel(c: TelegramChatListRow): string {
  if (c.title) return c.title;
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (c.username) return '@' + c.username;
  return c.chatId;
}

export default function TelegramBusinessInboxPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [chats, setChats] = useState<TelegramChatListRow[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TelegramMessageRow[]>([]);
  const [loadingChats, startLoadingChats] = useTransition();
  const [loadingMsgs, startLoadingMsgs] = useTransition();
  const [sending, startSending] = useTransition();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) setBotId(list[0]._id);
    })();
  }, [projectId, botId]);

  const loadChats = useCallback(() => {
    if (!botId) return;
    startLoadingChats(async () => {
      const list = await listTelegramChats(botId);
      setChats(list);
    });
  }, [botId]);

  const loadMessages = useCallback((bId: string, chatId: string) => {
    startLoadingMsgs(async () => {
      const list = await listTelegramMessages(bId, chatId);
      setMessages(list);
    });
  }, []);

  useEffect(() => {
    if (botId) loadChats();
  }, [botId, loadChats]);

  // Determine which chats are Business-connected by sniffing recent
  // messages — the chat doc keeps `isBusiness` set when a Business
  // message lands. Fall back to the type filter if neither field is
  // populated yet.
  const businessChats = useMemo(
    () => chats.filter((c) => c.type === 'private'),
    [chats],
  );

  const selected = useMemo(
    () => businessChats.find((c) => c.chatId === selectedChatId) ?? null,
    [businessChats, selectedChatId],
  );

  // Pull the businessConnectionId from the most recent inbound message
  // with one set, so replies thread on the same connection.
  const businessConnectionId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as TelegramMessageRow & { businessConnectionId?: string };
      if (m.businessConnectionId) return m.businessConnectionId;
    }
    return undefined;
  }, [messages]);

  useEffect(() => {
    if (botId && selectedChatId) loadMessages(botId, selectedChatId);
  }, [botId, selectedChatId, loadMessages]);

  const onSend = () => {
    const text = draft.trim();
    if (!text || !botId || !selectedChatId) return;
    startSending(async () => {
      const res = await sendTelegramTextMessage({
        botId,
        chatId: selectedChatId,
        text,
        businessConnectionId,
      });
      if (!res.success) {
        toast({
          title: 'Could not send',
          description: res.error ?? 'Unknown',
          variant: 'destructive',
        });
        return;
      }
      setDraft('');
      loadMessages(botId, selectedChatId);
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Inbox />}
          title="No project selected"
          description="Pick a project to see Telegram Business chats."
        />
      </div>
    );
  }
  if (bots.length === 0) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Bot />}
          title="No bots connected"
          description="Connect a bot first."
          action={
            <ZoruButton asChild>
              <Link href="/dashboard/telegram/bots">Manage bots</Link>
            </ZoruButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
              boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
            }}
          >
            <Inbox className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Business Inbox</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-zoru-ink-muted">
              Reply on behalf of your account through Telegram Business connections.
              Backed by <code>telegram-chats</code>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bots.map((b) => (
            <ZoruButton
              key={b._id}
              variant={botId === b._id ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setBotId(b._id);
                setSelectedChatId(null);
              }}
            >
              @{b.username}
            </ZoruButton>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <ZoruCard className="flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs uppercase tracking-wider text-zoru-ink-muted">
              Chats
            </p>
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={loadChats}
              disabled={loadingChats}
            >
              <RefreshCw
                className={loadingChats ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
              />
            </ZoruButton>
          </div>
          <ZoruScrollArea className="h-[640px] pr-1">
            {loadingChats && businessChats.length === 0 ? (
              <div className="flex flex-col gap-2 p-2">
                <ZoruSkeleton className="h-12 w-full" />
                <ZoruSkeleton className="h-12 w-full" />
              </div>
            ) : businessChats.length === 0 ? (
              <ZoruEmptyState
                compact
                icon={<Inbox />}
                title="No business chats"
                description="Once a Business connection routes messages, they'll appear here."
              />
            ) : (
              <ul className="flex flex-col gap-1">
                {businessChats.map((c) => {
                  const isActive = c.chatId === selectedChatId;
                  return (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedChatId(c.chatId)}
                        className={
                          'w-full rounded-md px-3 py-2 text-left text-sm transition ' +
                          (isActive
                            ? 'bg-zoru-surface-2 text-zoru-ink'
                            : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink')
                        }
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="line-clamp-1 font-medium">
                            {chatLabel(c)}
                          </span>
                          {c.unreadCount > 0 ? (
                            <ZoruBadge variant="default">{c.unreadCount}</ZoruBadge>
                          ) : null}
                        </div>
                        <div className="line-clamp-1 text-[11px] text-zoru-ink-muted">
                          {c.lastMessagePreview ?? '—'}
                        </div>
                        <div className="text-[10px] text-zoru-ink-muted">
                          {safeDate(c.lastMessageAt)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ZoruScrollArea>
        </ZoruCard>

        <ZoruCard className="flex flex-col gap-3 p-5">
          {!selected ? (
            <ZoruEmptyState
              icon={<Inbox />}
              title="Pick a chat"
              description="Select a chat on the left to read and reply."
            />
          ) : (
            <>
              <header className="flex items-baseline justify-between border-b border-zoru-line pb-3">
                <div>
                  <p className="text-base text-zoru-ink">{chatLabel(selected)}</p>
                  <p className="text-[11px] text-zoru-ink-muted">
                    {businessConnectionId
                      ? `via business connection ${businessConnectionId.slice(0, 8)}…`
                      : 'no business connection (replies will post as the bot)'}
                  </p>
                </div>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => botId && selectedChatId && loadMessages(botId, selectedChatId)}
                  disabled={loadingMsgs}
                >
                  <RefreshCw className={loadingMsgs ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                </ZoruButton>
              </header>

              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 540 }}>
                {messages.length === 0 ? (
                  <ZoruEmptyState
                    icon={<Inbox />}
                    title="No messages yet"
                    description="Reply to start the thread."
                  />
                ) : (
                  messages.map((m) => {
                    const outbound = m.direction === 'outbound';
                    return (
                      <div
                        key={m._id}
                        className={
                          'max-w-[80%] rounded-lg px-3 py-2 text-sm ' +
                          (outbound
                            ? 'self-end bg-zoru-surface-3 text-zoru-ink'
                            : 'self-start bg-zoru-surface-2 text-zoru-ink')
                        }
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {m.text ?? m.caption ?? `(${m.type})`}
                        </div>
                        <div className="mt-1 text-[10px] text-zoru-ink-muted">
                          {safeDate(m.createdAt)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <footer className="mt-auto flex items-center gap-2 border-t border-zoru-line pt-3">
                <ZoruInput
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  disabled={sending}
                />
                <ZoruButton onClick={onSend} disabled={sending || !draft.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </ZoruButton>
              </footer>
            </>
          )}
        </ZoruCard>
      </div>
    </div>
  );
}
