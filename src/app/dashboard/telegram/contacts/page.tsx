'use client';

/**
 * /dashboard/telegram/contacts — directory of Telegram users this bot
 * has chatted with. Each row is a `telegram_chats` doc, treated as a
 * lightweight contact record. Backed by `telegram-chats`.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Bot, RefreshCw, Search, Users } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  listTelegramBots,
  listTelegramChats,
  type TelegramBotListRow,
  type TelegramChatListRow,
} from '@/app/actions/telegram.actions';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
} from '@/components/zoruui';

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function contactLabel(c: TelegramChatListRow): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (c.title) return c.title;
  if (c.username) return '@' + c.username;
  return c.chatId;
}

export default function TelegramContactsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [chats, setChats] = useState<TelegramChatListRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) setBotId(list[0]._id);
    })();
  }, [projectId, botId]);

  const refresh = useCallback(() => {
    if (!botId) return;
    startLoading(async () => {
      const list = await listTelegramChats(botId, query || undefined, 200);
      setChats(list);
    });
  }, [botId, query]);

  useEffect(() => {
    if (botId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refresh();
  };

  const stats = useMemo(() => {
    const total = chats.length;
    const optedOut = chats.filter((c) => c.isOptedOut).length;
    const tagged = chats.filter((c: any) => Array.isArray(c.tags) && c.tags.length > 0).length;
    return { total, optedOut, tagged };
  }, [chats]);

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState icon={<Users />} title="No project selected" description="Pick a project." />
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
            <Users className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Contacts</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-zoru-ink-muted">
              Everyone this bot has chatted with. Backed by{' '}
              <code>telegram-chats</code>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bots.map((b) => (
            <ZoruButton
              key={b._id}
              variant={botId === b._id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBotId(b._id)}
            >
              @{b.username}
            </ZoruButton>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <ZoruCard className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">Total</p>
          <p className="mt-1 text-2xl text-zoru-ink">{stats.total}</p>
        </ZoruCard>
        <ZoruCard className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">Tagged</p>
          <p className="mt-1 text-2xl text-zoru-ink">{stats.tagged}</p>
        </ZoruCard>
        <ZoruCard className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">Opted out</p>
          <p className="mt-1 text-2xl text-zoru-ink">{stats.optedOut}</p>
        </ZoruCard>
      </div>

      <ZoruCard className="flex flex-col gap-3 p-3">
        <form onSubmit={onSubmit} className="flex items-center gap-2 px-1">
          <Search className="h-4 w-4 text-zoru-ink-muted" />
          <ZoruInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username or chat id…"
          />
          <ZoruButton type="submit" variant="ghost" size="sm" disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </ZoruButton>
        </form>

        {chats.length === 0 ? (
          <ZoruEmptyState
            icon={<Users />}
            title="No contacts"
            description="Once users message this bot, they'll appear here."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-zoru-line">
            {chats.map((c) => {
              const tags = ((c as any).tags ?? []) as string[];
              return (
                <li
                  key={c._id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <Link
                    href={`/dashboard/telegram/chat?botId=${botId}&chatId=${encodeURIComponent(c.chatId)}`}
                    className="flex-1 hover:text-zoru-ink"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-zoru-ink">{contactLabel(c)}</span>
                      {c.username ? (
                        <span className="text-[11px] text-zoru-ink-muted">
                          @{c.username}
                        </span>
                      ) : null}
                      {c.isOptedOut ? (
                        <ZoruBadge variant="warning">opted out</ZoruBadge>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-zoru-ink-muted">
                      {c.lastMessagePreview ?? '—'} · {safeDate(c.lastMessageAt)}
                    </div>
                    {tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tags.map((t) => (
                          <ZoruBadge key={t} variant="ghost">
                            {t}
                          </ZoruBadge>
                        ))}
                      </div>
                    )}
                  </Link>
                  <ZoruBadge variant="ghost">{c.type}</ZoruBadge>
                </li>
              );
            })}
          </ul>
        )}
      </ZoruCard>
    </div>
  );
}
