'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bot } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { listTelegramBots, type TelegramBotListRow } from '@/app/actions/telegram.actions';
import {
  getBotAnalyticsAction,
  getTelegramOverviewAction,
} from '@/app/actions/telegram-extra.actions';
import type { OverviewResp, BotAnalyticsResp } from '@/lib/rust-client/telegram-analytics';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
} from '@/components/zoruui';

export default function TelegramAnalyticsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [overview, setOverview] = useState<OverviewResp | null>(null);
  const [bot, setBot] = useState<BotAnalyticsResp | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) setBotId(list[0]._id);
      setOverview(await getTelegramOverviewAction(projectId));
    })();
  }, [projectId, botId]);

  useEffect(() => {
    if (!botId) return;
    (async () => setBot(await getBotAnalyticsAction(botId, days)))();
  }, [botId, days]);

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState icon={<BarChart />} title="No project selected" description="Pick a project." />
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

  const peak = Math.max(
    1,
    ...(bot?.timeseries.flatMap((p) => [p.inbound, p.outbound]) ?? []),
  );

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
            <BarChart className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Analytics</h1>
            <p className="mt-1 text-[13.5px] text-zoru-ink-muted">
              Workspace overview + per-bot timeseries. Backed by{' '}
              <code>telegram-analytics</code>.
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
          <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">Bots</p>
          <p className="mt-1 text-2xl text-zoru-ink">{overview?.bots ?? 0}</p>
        </ZoruCard>
        <ZoruCard className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
            Active chats (24h)
          </p>
          <p className="mt-1 text-2xl text-zoru-ink">{overview?.activeChats ?? 0}</p>
        </ZoruCard>
        <ZoruCard className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
            Broadcasts
          </p>
          <p className="mt-1 text-2xl text-zoru-ink">{overview?.broadcasts ?? 0}</p>
        </ZoruCard>
      </div>

      <ZoruCard className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zoru-ink">Per-bot timeseries</p>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <ZoruButton
                key={d}
                size="sm"
                variant={days === d ? 'default' : 'outline'}
                onClick={() => setDays(d)}
              >
                {d}d
              </ZoruButton>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <ZoruBadge variant="ghost">Total {bot?.totals.messages ?? 0}</ZoruBadge>
          <ZoruBadge variant="ghost">Inbound {bot?.totals.inbound ?? 0}</ZoruBadge>
          <ZoruBadge variant="ghost">Outbound {bot?.totals.outbound ?? 0}</ZoruBadge>
          <ZoruBadge variant="ghost">Chats {bot?.totals.chats ?? 0}</ZoruBadge>
        </div>
        {bot?.timeseries.length === 0 ? (
          <p className="text-sm text-zoru-ink-muted">No data in this window.</p>
        ) : (
          <div
            className="grid w-full items-end gap-1"
            style={{
              gridTemplateColumns: `repeat(${bot?.timeseries.length ?? 0}, minmax(0, 1fr))`,
              height: 160,
            }}
          >
            {bot?.timeseries.map((p) => {
              const inH = (p.inbound / peak) * 100;
              const outH = (p.outbound / peak) * 100;
              return (
                <div
                  key={p.date}
                  className="flex h-full flex-col items-stretch justify-end gap-0.5"
                  title={`${p.date} · in ${p.inbound} / out ${p.outbound}`}
                >
                  <div
                    className="rounded-t-sm bg-zoru-surface-3"
                    style={{ height: `${outH}%` }}
                  />
                  <div
                    className="rounded-t-sm"
                    style={{
                      height: `${inH}%`,
                      background: 'linear-gradient(180deg, #37BBFE, #007DBB)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-3 text-[11px] text-zoru-ink-muted">
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ background: 'linear-gradient(180deg, #37BBFE, #007DBB)' }}
            />
            Inbound
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-zoru-surface-3" />
            Outbound
          </span>
        </div>
      </ZoruCard>

      <ZoruCard className="flex flex-col gap-2 p-5">
        <p className="text-sm text-zoru-ink">Top chats</p>
        {!bot || bot.topChats.length === 0 ? (
          <p className="text-sm text-zoru-ink-muted">Nothing to show yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zoru-line">
            {bot.topChats.map((c) => (
              <li
                key={c.chatId}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="line-clamp-1 text-zoru-ink">{c.title}</span>
                <span className="text-zoru-ink-muted">{c.messages} msgs</span>
              </li>
            ))}
          </ul>
        )}
      </ZoruCard>
    </div>
  );
}
