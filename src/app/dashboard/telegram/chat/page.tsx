'use client';

/**
 * /dashboard/telegram/chat — Live Telegram chat inbox.
 *
 * Three-pane layout: bot picker (top), chat list (left), thread (right).
 * All data goes through the `telegram-chats` Rust crate (mounted at
 * /v1/telegram/chats) via the TS server actions in
 * `telegram.actions.ts`. No direct Mongo access on the TS side.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  Bot,
  MessageCircle,
  RefreshCw,
  Send,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  listTelegramBots,
  listTelegramChats,
  listTelegramMessages,
  markTelegramChatRead,
  sendTelegramTextMessage,
  type TelegramBotListRow,
  type TelegramChatListRow,
  type TelegramMessageRow,
} from '@/app/actions/telegram.actions';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
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

export default function TelegramChatPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  const [chats, setChats] = useState<TelegramChatListRow[]>([]);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [chatQuery, setChatQuery] = useState('');
  const [loadingChats, startLoadingChats] = useTransition();

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TelegramMessageRow[]>([]);
  const [loadingMessages, startLoadingMessages] = useTransition();

  const [draft, setDraft] = useState('');
  const [sending, startSending] = useTransition();

  // Load bots when project changes
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!selectedBotId && list.length > 0) {
        setSelectedBotId(list[0]._id);
      }
    })();
  }, [projectId, selectedBotId]);

  const loadChats = useCallback(
    (botId: string, q?: string) => {
      startLoadingChats(async () => {
        const list = await listTelegramChats(botId, q);
        setChats(list);
        setChatsError(null);
        if (!selectedChatId && list.length > 0) {
          setSelectedChatId(list[0].chatId);
        }
      });
    },
    [selectedChatId],
  );

  const loadMessages = useCallback((botId: string, chatId: string) => {
    startLoadingMessages(async () => {
      const list = await listTelegramMessages(botId, chatId);
      setMessages(list);
    });
  }, []);

  useEffect(() => {
    if (selectedBotId) loadChats(selectedBotId, chatQuery || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBotId]);

  useEffect(() => {
    if (selectedBotId && selectedChatId) {
      loadMessages(selectedBotId, selectedChatId);
      // Best-effort mark read; we don't surface a failure here.
      markTelegramChatRead(selectedBotId, selectedChatId).catch(() => {});
    }
  }, [selectedBotId, selectedChatId, loadMessages]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBotId) loadChats(selectedBotId, chatQuery || undefined);
  };

  const onSend = () => {
    if (!selectedBotId || !selectedChatId) return;
    const text = draft.trim();
    if (!text) return;
    startSending(async () => {
      const res = await sendTelegramTextMessage({
        botId: selectedBotId,
        chatId: selectedChatId,
        text,
      });
      if (!res.success) {
        toast({
          title: 'Could not send',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      setDraft('');
      loadMessages(selectedBotId, selectedChatId);
      // Refresh chat list so the preview & sort order update.
      loadChats(selectedBotId, chatQuery || undefined);
    });
  };

  const selectedChat = useMemo(
    () => chats.find((c) => c.chatId === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<MessageCircle />}
          title="No project selected"
          description="Pick a project from the project switcher to see Telegram chats."
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
          description="Connect a Telegram bot before chatting."
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
            <MessageCircle className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight text-zoru-ink">Chat</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
              Live Telegram inbox for the connected bots. Reads and writes go
              through the <code>telegram-chats</code> Rust BFF.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {bots.map((b) => (
            <ZoruButton
              key={b._id}
              variant={selectedBotId === b._id ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedBotId(b._id);
                setSelectedChatId(null);
              }}
            >
              @{b.username}
            </ZoruButton>
          ))}
        </div>
      </header>

      {chatsError && (
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load chats</ZoruAlertTitle>
          <ZoruAlertDescription>{chatsError}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <ZoruCard className="flex flex-col gap-2 p-3">
          <form onSubmit={onSearch} className="flex items-center gap-2 px-1">
            <ZoruInput
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              placeholder="Search chats…"
            />
            <ZoruButton type="submit" variant="ghost" size="sm" disabled={loadingChats}>
              <RefreshCw
                className={loadingChats ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
              />
            </ZoruButton>
          </form>
          <ZoruScrollArea className="h-[640px] pr-1">
            {loadingChats && chats.length === 0 ? (
              <div className="flex flex-col gap-2 p-2">
                <ZoruSkeleton className="h-12 w-full" />
                <ZoruSkeleton className="h-12 w-full" />
                <ZoruSkeleton className="h-12 w-full" />
              </div>
            ) : chats.length === 0 ? (
              <ZoruEmptyState
                compact
                icon={<MessageCircle />}
                title="No chats yet"
                description="Once users message this bot they'll appear here."
              />
            ) : (
              <ul className="flex flex-col gap-1">
                {chats.map((c) => {
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
          {!selectedChat ? (
            <ZoruEmptyState
              icon={<MessageCircle />}
              title="Pick a chat"
              description="Select a chat on the left to read and reply."
            />
          ) : (
            <>
              <header className="flex items-baseline justify-between gap-3 border-b border-zoru-line pb-3">
                <div>
                  <p className="text-base text-zoru-ink">{chatLabel(selectedChat)}</p>
                  <p className="text-[11px] text-zoru-ink-muted">
                    {selectedChat.type} · {safeDate(selectedChat.lastMessageAt)}
                  </p>
                </div>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    selectedBotId && selectedChatId &&
                    loadMessages(selectedBotId, selectedChatId)
                  }
                  disabled={loadingMessages}
                >
                  <RefreshCw
                    className={
                      loadingMessages ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'
                    }
                  />
                  Refresh
                </ZoruButton>
              </header>

              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 540 }}>
                {loadingMessages && messages.length === 0 ? (
                  <>
                    <ZoruSkeleton className="h-10 w-2/3" />
                    <ZoruSkeleton className="h-10 w-1/2 self-end" />
                    <ZoruSkeleton className="h-10 w-3/4" />
                  </>
                ) : messages.length === 0 ? (
                  <ZoruEmptyState
                    icon={<MessageCircle />}
                    title="No messages yet"
                    description="Send the first one below."
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
                          {m.status === 'failed' && m.errorMessage
                            ? ` · ${m.errorMessage}`
                            : ''}
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
