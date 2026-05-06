'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Bot, Eye, Plus, Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { listTelegramBots, type TelegramBotListRow } from '@/app/actions/telegram.actions';
import {
  cancelTelegramStoryAction,
  listTelegramStoriesAction,
  scheduleTelegramStoryAction,
} from '@/app/actions/telegram-extra.actions';
import type { PostRow } from '@/lib/rust-client/telegram-stories';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function TelegramStoriesPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [busy, startBusy] = useTransition();

  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [text, setText] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const list = await listTelegramBots(projectId);
      setBots(list);
      if (!botId && list.length > 0) setBotId(list[0]._id);
    })();
  }, [projectId, botId]);

  const refresh = async () => {
    if (!botId) return;
    setPosts(await listTelegramStoriesAction(botId));
  };
  useEffect(() => {
    if (botId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const onSchedule = () => {
    if (!botId || !channelId.trim() || !text.trim() || !scheduledAt) return;
    const iso = new Date(scheduledAt).toISOString();
    startBusy(async () => {
      const res = await scheduleTelegramStoryAction({
        botId,
        channelId: channelId.trim(),
        message: { type: 'text', text: text.trim() },
        scheduledAt: iso,
      });
      if (!res.success) {
        toast({ title: 'Schedule failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Story scheduled' });
      setOpen(false);
      setText('');
      setScheduledAt('');
      refresh();
    });
  };

  const onCancel = (postId: string) => {
    if (!botId) return;
    if (!confirm('Cancel this scheduled story?')) return;
    startBusy(async () => {
      const res = await cancelTelegramStoryAction(postId, botId);
      if (!res.success) {
        toast({ title: 'Cancel failed', description: res.error, variant: 'destructive' });
        return;
      }
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState icon={<Eye />} title="No project selected" description="Pick a project." />
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
          action={<ZoruButton asChild><Link href="/dashboard/telegram/bots">Manage bots</Link></ZoruButton>}
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
            <Eye className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Stories</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-zoru-ink-muted">
              Schedule channel posts as bot-side stories. Backed by{' '}
              <code>telegram-stories</code>.
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
          <ZoruButton size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule
          </ZoruButton>
        </div>
      </header>

      {posts.length === 0 ? (
        <ZoruEmptyState
          icon={<Eye />}
          title="No scheduled stories"
          description="Schedule a story to a channel chat."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {posts.map((p) => (
            <ZoruCard key={p._id} className="flex flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="line-clamp-2 text-sm text-zoru-ink">
                    {p.message?.text ?? '(no text)'}
                  </p>
                  <p className="text-[11px] text-zoru-ink-muted">
                    Channel {p.channelId} · scheduled {safeDate(p.scheduledAt)}
                  </p>
                </div>
                <ZoruBadge variant="ghost">{p.status}</ZoruBadge>
              </div>
              {p.status === 'QUEUED' && (
                <div className="flex justify-end">
                  <ZoruButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancel(p._id)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </ZoruButton>
                </div>
              )}
            </ZoruCard>
          ))}
        </div>
      )}

      <ZoruDialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Schedule a story</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <ZoruLabel htmlFor="s-channel">Channel id (Mongo _id of the linked channel)</ZoruLabel>
              <ZoruInput
                id="s-channel"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
              />
            </div>
            <div>
              <ZoruLabel htmlFor="s-text">Text</ZoruLabel>
              <ZoruTextarea
                id="s-text"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div>
              <ZoruLabel htmlFor="s-when">Scheduled at</ZoruLabel>
              <ZoruInput
                id="s-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={onSchedule}
              disabled={busy || !channelId.trim() || !text.trim() || !scheduledAt}
            >
              {busy ? 'Scheduling…' : 'Schedule'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
