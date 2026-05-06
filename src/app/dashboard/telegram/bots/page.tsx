'use client';

/**
 * /dashboard/telegram/bots — manage Telegram bots.
 *
 * Calls the `telegram-bots` Rust crate (mounted at /v1/telegram/bots)
 * via the thin TS server actions in `telegram.actions.ts`. The crate
 * handles BotFather token validation, webhook registration, and
 * persistence to the `telegram_bots` Mongo collection.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Bot, Plus, RefreshCw, RotateCw, Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  connectTelegramBot,
  disconnectTelegramBot,
  listTelegramBots,
  refreshTelegramWebhookInfo,
  rotateTelegramWebhookSecret,
  type TelegramBotListRow,
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
  useZoruToast,
} from '@/components/zoruui';

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function TelegramBotsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [loading, startLoading] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [busy, startBusy] = useTransition();

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      try {
        const list = await listTelegramBots(projectId);
        setBots(list);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load bots.');
      }
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onConnect = () => {
    if (!projectId) return;
    const trimmed = token.trim();
    if (!trimmed) return;
    startBusy(async () => {
      const res = await connectTelegramBot({ projectId, token: trimmed });
      if (!res.success) {
        toast({
          title: 'Could not connect bot',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Bot connected',
        description: res.message ?? 'Webhook registered.',
      });
      setOpen(false);
      setToken('');
      refresh();
    });
  };

  const onDisconnect = (botId: string, name: string) => {
    if (!confirm(`Disconnect @${name}? The webhook will be removed from Telegram.`)) return;
    startBusy(async () => {
      const res = await disconnectTelegramBot(botId);
      if (!res.success) {
        toast({
          title: 'Could not disconnect',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Bot disconnected' });
      refresh();
    });
  };

  const onRefreshWebhook = (botId: string) => {
    startBusy(async () => {
      const res = await refreshTelegramWebhookInfo(botId);
      if (!res.success) {
        toast({
          title: 'Could not refresh webhook',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Webhook info refreshed' });
      refresh();
    });
  };

  const onRotate = (botId: string) => {
    if (!confirm('Rotate the webhook secret? Telegram will be re-registered with a new secret.')) return;
    startBusy(async () => {
      const res = await rotateTelegramWebhookSecret(botId);
      if (!res.success) {
        toast({
          title: 'Could not rotate secret',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Webhook secret rotated' });
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Bot />}
          title="No project selected"
          description="Pick a project from the project switcher to manage its Telegram bots."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
              boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
            }}
          >
            <Bot className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight text-zoru-ink">Bots</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
              Connect Telegram bots to this workspace. Paste a token from{' '}
              <Link
                className="underline decoration-zoru-line underline-offset-2"
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
              >
                @BotFather
              </Link>{' '}
              to register; the BFF validates via Telegram and sets up the webhook.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ZoruButton variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Connect bot
          </ZoruButton>
        </div>
      </header>

      {error && (
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load bots</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      {loading && bots.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ZoruSkeleton className="h-32 w-full" />
          <ZoruSkeleton className="h-32 w-full" />
        </div>
      ) : bots.length === 0 ? (
        <ZoruEmptyState
          icon={<Bot />}
          title="No bots connected"
          description="Click &ldquo;Connect bot&rdquo; and paste a BotFather token."
          action={
            <ZoruButton onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Connect bot
            </ZoruButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {bots.map((bot) => (
            <ZoruCard key={bot._id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base text-zoru-ink">@{bot.username}</p>
                  <p className="text-xs text-zoru-ink-muted">{bot.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {bot.isActive ? (
                    <ZoruBadge variant="success">Active</ZoruBadge>
                  ) : (
                    <ZoruBadge variant="ghost">Disabled</ZoruBadge>
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-zoru-ink-muted">Webhook</dt>
                  <dd className="text-[11px] text-zoru-ink">
                    {bot.webhookUrl ? '✓ registered' : '— not set'}
                  </dd>
                </div>
                <div>
                  <dt className="text-zoru-ink-muted">Pending updates</dt>
                  <dd className="text-zoru-ink">
                    {bot.webhookInfo?.pendingUpdateCount ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-zoru-ink-muted">Bot ID</dt>
                  <dd className="font-mono text-[11px] text-zoru-ink">{bot.botId}</dd>
                </div>
                <div>
                  <dt className="text-zoru-ink-muted">Updated</dt>
                  <dd className="text-zoru-ink">{safeDate(bot.updatedAt)}</dd>
                </div>
                {bot.webhookInfo?.lastErrorMessage ? (
                  <div className="col-span-2">
                    <dt className="text-zoru-ink-muted">Last webhook error</dt>
                    <dd className="text-[11px] text-amber-700 dark:text-amber-400">
                      {bot.webhookInfo.lastErrorMessage}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <footer className="flex items-center justify-end gap-1 border-t border-zoru-line pt-3">
                <ZoruButton asChild variant="ghost" size="sm">
                  <Link href={`/dashboard/telegram/chat?botId=${bot._id}`}>Open chat</Link>
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onRefreshWebhook(bot._id)}
                  disabled={busy}
                  title="Refresh webhook info"
                >
                  <RefreshCw className="h-4 w-4" />
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onRotate(bot._id)}
                  disabled={busy}
                  title="Rotate webhook secret"
                >
                  <RotateCw className="h-4 w-4" />
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onDisconnect(bot._id, bot.username)}
                  disabled={busy}
                  title="Disconnect"
                >
                  <Trash2 className="h-4 w-4" />
                </ZoruButton>
              </footer>
            </ZoruCard>
          ))}
        </div>
      )}

      <ZoruDialog open={open} onOpenChange={setOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Connect a Telegram bot</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste the token BotFather gave you. The BFF calls{' '}
              <code>getMe</code> against Telegram and registers a webhook for this
              workspace.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-2">
            <ZoruLabel htmlFor="tg-token">Bot token</ZoruLabel>
            <ZoruInput
              id="tg-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:AAH-x…"
              autoFocus
            />
            <p className="text-[11px] text-zoru-ink-muted">
              Tokens look like <code>123456789:AAH-x…</code>. They&rsquo;re stored at
              rest in MongoDB and never leave the BFF.
            </p>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={onConnect} disabled={busy || !token.trim()}>
              {busy ? 'Connecting…' : 'Connect'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
