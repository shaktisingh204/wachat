'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Bot, Radio } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  listTelegramBots,
  listTelegramChannels,
  type TelegramBotListRow,
  type TelegramChannelRow,
} from '@/app/actions/telegram.actions';

import {
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
} from '@/components/zoruui';

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function TelegramChannelsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [channels, setChannels] = useState<TelegramChannelRow[]>([]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) setBotId(list[0]._id);
    })();
  }, [projectId, botId]);

  useEffect(() => {
    if (!botId) return;
    (async () => setChannels(await listTelegramChannels(botId)))();
  }, [botId]);

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState icon={<Radio />} title="No project selected" description="Pick a project." />
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
            <Radio className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Channels</h1>
            <p className="mt-1 text-[13.5px] text-zoru-ink-muted">
              Channels linked to this bot. Backed by <code>telegram-channels</code>.
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

      {channels.length === 0 ? (
        <ZoruEmptyState
          icon={<Radio />}
          title="No channels linked"
          description="Add this bot as an admin in a Telegram channel and it will show up here once it receives a channel_post event."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {channels.map((c) => (
            <ZoruCard key={c._id} className="flex flex-col gap-2 p-5">
              <p className="text-base text-zoru-ink">{c.title ?? c.username ?? c.chatId}</p>
              <p className="text-[11px] text-zoru-ink-muted">
                {c.username ? `@${c.username} · ` : ''}
                {c.chatId}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zoru-ink-muted">Members</span>
                  <div className="text-zoru-ink">{c.memberCount}</div>
                </div>
                <div>
                  <span className="text-zoru-ink-muted">Linked</span>
                  <div className="text-zoru-ink">{safeDate(c.createdAt)}</div>
                </div>
              </div>
            </ZoruCard>
          ))}
        </div>
      )}
    </div>
  );
}
