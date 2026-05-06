'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Bot, Plus, RefreshCw, Send } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  createTelegramBroadcast,
  listTelegramBots,
  listTelegramBroadcasts,
  sendTelegramBroadcastNow,
  type TelegramBotListRow,
  type TelegramBroadcastRow,
} from '@/app/actions/telegram.actions';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'ghost'> = {
  COMPLETED: 'success',
  SENT: 'success',
  SENDING: 'warning',
  QUEUED: 'warning',
  DRAFT: 'ghost',
  FAILED: 'danger',
};

export default function TelegramBroadcastsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [rows, setRows] = useState<TelegramBroadcastRow[]>([]);
  const [loading, startLoading] = useTransition();
  const [busy, startBusy] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [audienceKind, setAudienceKind] = useState<'all' | 'tag' | 'channel'>('all');
  const [audienceValue, setAudienceValue] = useState('');

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
      setRows(await listTelegramBroadcasts(botId));
    });
  }, [botId]);

  useEffect(() => {
    if (botId) refresh();
  }, [botId, refresh]);

  const onCreate = () => {
    if (!botId || !name.trim() || !text.trim()) return;
    startBusy(async () => {
      const audience: { kind: typeof audienceKind; tag?: string; channelChatId?: string } = {
        kind: audienceKind,
      };
      if (audienceKind === 'tag') audience.tag = audienceValue;
      if (audienceKind === 'channel') audience.channelChatId = audienceValue;
      const res = await createTelegramBroadcast({
        botId,
        name: name.trim(),
        audience: audience as any,
        message: { type: 'text', text: text.trim() } as any,
      });
      if (!res.success) {
        toast({
          title: 'Could not create',
          description: res.error ?? 'Unknown',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Broadcast created' });
      setDialogOpen(false);
      setName('');
      setText('');
      setAudienceValue('');
      refresh();
    });
  };

  const onSendNow = (id: string) => {
    if (!confirm('Send this broadcast now? This may dispatch many messages.')) return;
    startBusy(async () => {
      const res = await sendTelegramBroadcastNow(id);
      if (!res.success) {
        toast({
          title: 'Send failed',
          description: res.error ?? 'Unknown',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Broadcast dispatched', description: res.message });
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Send />}
          title="No project selected"
          description="Pick a project to manage broadcasts."
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
          description="Connect a bot before creating broadcasts."
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
            <Send className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Broadcasts</h1>
            <p className="mt-1 text-[13.5px] text-zoru-ink-muted">
              Compose and dispatch broadcasts via the{' '}
              <code>telegram-broadcasts</code> Rust crate.
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
          <ZoruButton variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New broadcast
          </ZoruButton>
        </div>
      </header>

      {loading && rows.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ZoruSkeleton className="h-28 w-full" />
          <ZoruSkeleton className="h-28 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <ZoruEmptyState
          icon={<Send />}
          title="No broadcasts yet"
          description="Create a broadcast to message your subscribers."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((b) => {
            const variant = STATUS_VARIANT[b.status] ?? 'ghost';
            return (
              <ZoruCard key={b._id} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base text-zoru-ink">{b.name}</p>
                    <p className="text-[11px] text-zoru-ink-muted">
                      Created {safeDate(b.createdAt)}
                    </p>
                  </div>
                  <ZoruBadge variant={variant}>{b.status}</ZoruBadge>
                </div>
                <p className="line-clamp-2 text-sm text-zoru-ink-muted">
                  {b.message?.text ?? '(no text)'}
                </p>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-zoru-ink-muted">Total</dt>
                    <dd>{b.stats?.total ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-zoru-ink-muted">Sent</dt>
                    <dd>{b.stats?.sent ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-zoru-ink-muted">Failed</dt>
                    <dd>{b.stats?.failed ?? 0}</dd>
                  </div>
                </dl>
                <footer className="flex justify-end border-t border-zoru-line pt-3">
                  {b.status === 'DRAFT' || b.status === 'QUEUED' ? (
                    <ZoruButton size="sm" onClick={() => onSendNow(b._id)} disabled={busy}>
                      <Send className="mr-2 h-4 w-4" />
                      Send now
                    </ZoruButton>
                  ) : null}
                </footer>
              </ZoruCard>
            );
          })}
        </div>
      )}

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New broadcast</ZoruDialogTitle>
            <ZoruDialogDescription>
              Text-only broadcast. Audience can target all opted-in private chats, a tag,
              or a single channel chat id.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <ZoruLabel htmlFor="b-name">Name</ZoruLabel>
              <ZoruInput
                id="b-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="December update"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="b-text">Message</ZoruLabel>
              <ZoruTextarea
                id="b-text"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What do you want to say?"
              />
            </div>
            <div>
              <ZoruLabel>Audience</ZoruLabel>
              <div className="mt-1 flex items-center gap-2">
                {(['all', 'tag', 'channel'] as const).map((k) => (
                  <ZoruButton
                    key={k}
                    type="button"
                    size="sm"
                    variant={audienceKind === k ? 'default' : 'outline'}
                    onClick={() => setAudienceKind(k)}
                  >
                    {k}
                  </ZoruButton>
                ))}
              </div>
              {audienceKind !== 'all' && (
                <ZoruInput
                  className="mt-2"
                  value={audienceValue}
                  onChange={(e) => setAudienceValue(e.target.value)}
                  placeholder={audienceKind === 'tag' ? 'tag-name' : 'channel chat id'}
                />
              )}
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={onCreate}
              disabled={busy || !name.trim() || !text.trim()}
            >
              {busy ? 'Creating…' : 'Create'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {!botId && (
        <ZoruAlert>
          <AlertCircle />
          <ZoruAlertTitle>Pick a bot</ZoruAlertTitle>
          <ZoruAlertDescription>Choose a bot above to load its broadcasts.</ZoruAlertDescription>
        </ZoruAlert>
      )}
    </div>
  );
}
