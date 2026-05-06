'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Bot, RefreshCw, RotateCw, Webhook } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
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
  ZoruEmptyState,
  useZoruToast,
} from '@/components/zoruui';

function safeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function TelegramWebhooksPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useZoruToast();

  const [bots, setBots] = useState<TelegramBotListRow[]>([]);
  const [busy, startBusy] = useTransition();

  const refresh = async () => {
    if (!projectId) return;
    setBots(await listTelegramBots(projectId));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const onRefreshWebhook = (botId: string) => {
    startBusy(async () => {
      const res = await refreshTelegramWebhookInfo(botId);
      if (!res.success) {
        toast({
          title: 'Refresh failed',
          description: res.error ?? 'Unknown',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Webhook info refreshed' });
      await refresh();
    });
  };

  const onRotate = (botId: string) => {
    if (!confirm('Rotate the webhook secret? Telegram will be re-registered.')) return;
    startBusy(async () => {
      const res = await rotateTelegramWebhookSecret(botId);
      if (!res.success) {
        toast({
          title: 'Rotate failed',
          description: res.error ?? 'Unknown',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Webhook secret rotated' });
      await refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState icon={<Webhook />} title="No project selected" description="Pick a project." />
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

  const hasErrors = bots.some((b) => Boolean(b.webhookInfo?.lastErrorMessage));

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
            <Webhook className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">Webhooks</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-zoru-ink-muted">
              Telegram delivers updates by HTTPS POST to{' '}
              <code>/api/telegram/webhook/&#123;bot_id&#125;</code>. The BFF validates the
              <code> X-Telegram-Bot-Api-Secret-Token</code> header against the secret rotated below.
            </p>
          </div>
        </div>
      </header>

      {hasErrors && (
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>One or more webhooks reported errors</ZoruAlertTitle>
          <ZoruAlertDescription>
            Refresh below to fetch the latest <code>getWebhookInfo</code> response from
            Telegram.
          </ZoruAlertDescription>
        </ZoruAlert>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {bots.map((b) => {
          const ok = Boolean(b.webhookUrl) && !b.webhookInfo?.lastErrorMessage;
          return (
            <ZoruCard key={b._id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base text-zoru-ink">@{b.username}</p>
                  <p className="text-xs text-zoru-ink-muted">{b.name}</p>
                </div>
                {ok ? (
                  <ZoruBadge variant="success">healthy</ZoruBadge>
                ) : !b.webhookUrl ? (
                  <ZoruBadge variant="ghost">not registered</ZoruBadge>
                ) : (
                  <ZoruBadge variant="warning">errors</ZoruBadge>
                )}
              </div>
              <dl className="flex flex-col gap-2 text-xs">
                <div>
                  <dt className="text-zoru-ink-muted">URL</dt>
                  <dd className="break-all font-mono text-[11px] text-zoru-ink">
                    {b.webhookUrl ?? '—'}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-zoru-ink-muted">Pending updates</dt>
                    <dd className="text-zoru-ink">{b.webhookInfo?.pendingUpdateCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-zoru-ink-muted">Registered</dt>
                    <dd className="text-zoru-ink">{safeDate(b.webhookRegisteredAt)}</dd>
                  </div>
                </div>
                {b.webhookInfo?.lastErrorMessage && (
                  <div>
                    <dt className="text-zoru-ink-muted">Last error</dt>
                    <dd className="text-[11px] text-amber-700 dark:text-amber-400">
                      {b.webhookInfo.lastErrorMessage}
                    </dd>
                  </div>
                )}
              </dl>
              <footer className="flex items-center justify-end gap-2 border-t border-zoru-line pt-3">
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onRefreshWebhook(b._id)}
                  disabled={busy}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => onRotate(b._id)}
                  disabled={busy}
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  Rotate
                </ZoruButton>
              </footer>
            </ZoruCard>
          );
        })}
      </div>
    </div>
  );
}
