'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bot, RefreshCw, RotateCw, ServerCog } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  listTelegramBots,
  refreshTelegramWebhookInfo,
  rotateTelegramWebhookSecret,
  type TelegramBotListRow,
} from '@/app/actions/telegram.actions';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  useZoruToast,
} from '@/components/zoruui';

export default function TelegramApiCredentialsPage(): React.JSX.Element {
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
    if (!confirm('Rotate the webhook secret? Telegram will be re-registered with a new secret.'))
      return;
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
        <ZoruEmptyState
          icon={<ServerCog />}
          title="No project selected"
          description="Pick a project to view its bot credentials."
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
            <ServerCog className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[22px] leading-tight text-zoru-ink">API Credentials</h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-zoru-ink-muted">
              Bot tokens, webhook URLs, and webhook-secret rotation. Tokens are stored on
              the BFF and never leave it — this page only shows status, never raw tokens.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {bots.map((b) => (
          <ZoruCard key={b._id} className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base text-zoru-ink">@{b.username}</p>
                <p className="text-xs text-zoru-ink-muted">{b.name}</p>
              </div>
              {b.isActive ? (
                <ZoruBadge variant="success">Active</ZoruBadge>
              ) : (
                <ZoruBadge variant="ghost">Disabled</ZoruBadge>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-zoru-ink-muted">Bot ID</dt>
                <dd className="font-mono text-zoru-ink">{b.botId}</dd>
              </div>
              <div>
                <dt className="text-zoru-ink-muted">Token</dt>
                <dd className="font-mono text-zoru-ink">stored · server-side</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-zoru-ink-muted">Webhook URL</dt>
                <dd className="break-all font-mono text-[11px] text-zoru-ink">
                  {b.webhookUrl ?? '— not registered —'}
                </dd>
              </div>
              <div>
                <dt className="text-zoru-ink-muted">Pending updates</dt>
                <dd className="text-zoru-ink">{b.webhookInfo?.pendingUpdateCount ?? 0}</dd>
              </div>
              <div>
                <dt className="text-zoru-ink-muted">Last error</dt>
                <dd className="text-zoru-ink">
                  {b.webhookInfo?.lastErrorMessage ? (
                    <span className="text-amber-700 dark:text-amber-400">
                      {b.webhookInfo.lastErrorMessage}
                    </span>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
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
                Rotate secret
              </ZoruButton>
            </footer>
          </ZoruCard>
        ))}
      </div>
    </div>
  );
}
