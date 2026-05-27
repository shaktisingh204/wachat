'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { m, AnimatePresence } from 'motion/react';
import {
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  Webhook,
} from 'lucide-react';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  useZoruToast,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  EmptyState,
  WaButton,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import { fmtDate } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { getWebhookLogs, replayWebhookLog } from '@/app/actions/wachat-features.actions';

type WebhookLog = {
  _id: string;
  receivedAt?: string;
  event?: string;
  type?: string;
  status?: string;
  payload?: unknown;
  body?: unknown;
};

function deriveTone(status?: string): { tone: StatusTone; label: string } {
  const s = (status ?? '').toLowerCase();
  if (s === 'success' || s === 'sent' || s === 'received') return { tone: 'sent', label: 'sent' };
  if (s === 'failed' || s === 'error') return { tone: 'failed', label: 'failed' };
  if (s === 'pending' || s === 'queued') return { tone: 'queued', label: 'queued' };
  if (s === 'sending') return { tone: 'sending', label: 'sending' };
  return { tone: 'draft', label: status || 'unknown' };
}

export default function WebhookLogsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [previewLog, setPreviewLog] = useState<WebhookLog | null>(null);
  const [retryLog, setRetryLog] = useState<WebhookLog | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isRetrying, startRetrying] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const lower = searchQuery.toLowerCase();
    return logs.filter((l) => {
      if ((l.event || l.type || '').toLowerCase().includes(lower)) return true;
      if (l.payload && JSON.stringify(l.payload).toLowerCase().includes(lower)) return true;
      if (l.body && JSON.stringify(l.body).toLowerCase().includes(lower)) return true;
      return false;
    });
  }, [logs, searchQuery]);

  const fetchLogs = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getWebhookLogs(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setLogs((res.logs as WebhookLog[]) || []);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchLogs(projectId);
  }, [projectId, fetchLogs]);

  const previewPayload = previewLog?.payload ?? previewLog?.body ?? {};

  return (
    <WaPage>
      <PageHeader
        title="Webhook logs"
        description="Every event that hit your endpoint, with payload and retry controls."
        kicker="Wachat · webhooks"
        backHref="/wachat"
        eyebrowIcon={Webhook}
        actions={
          <WaButton
            size="sm"
            variant="outline"
            leftIcon={isLoading ? Loader2 : RefreshCw}
            onClick={() => projectId && fetchLogs(projectId)}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing' : 'Refresh'}
          </WaButton>
        }
      />

      <Section
        title="Recent deliveries"
        description="Sorted newest first. Click a row to inspect the full payload."
        action={
          <div className="relative">
            <Input
              placeholder="Search events and payloads"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 rounded-full text-[12px]"
            />
          </div>
        }
      >
        {isLoading && logs.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl border border-zinc-200 bg-white" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhook logs found"
            description="Once Meta starts sending events to your endpoint, they will appear here."
          />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No deliveries match"
            description="Try a different search query or clear it to see all events."
          />
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {filteredLogs.map((row, i) => {
                const t = deriveTone(row.status);
                return (
                  <m.li
                    key={row._id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015, ease: EASE_OUT }}
                    className="flex items-center gap-3 px-1 py-3"
                  >
                    <span className="hidden w-44 font-mono text-[12px] tabular-nums text-zinc-500 sm:block">
                      {row.receivedAt ? fmtDate(row.receivedAt) : '--'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900">
                      {row.event || row.type || 'webhook'}
                    </span>
                    <StatusPill tone={t.tone}>{t.label}</StatusPill>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewLog(row)}
                        className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 active:scale-[0.97]"
                      >
                        <Eye className="h-3 w-3" strokeWidth={2.25} />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setRetryLog(row)}
                        className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 active:scale-[0.97]"
                      >
                        <RotateCcw className="h-3 w-3" strokeWidth={2.25} />
                        Retry
                      </button>
                    </div>
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Section>

      {/* View payload sheet */}
      <Sheet open={!!previewLog} onOpenChange={(o) => !o && setPreviewLog(null)}>
        <ZoruSheetContent className="flex w-full flex-col sm:max-w-xl">
          <ZoruSheetHeader>
            <ZoruSheetTitle>{previewLog?.event || previewLog?.type || 'Webhook event'}</ZoruSheetTitle>
            <ZoruSheetDescription>
              {previewLog?.receivedAt ? fmtDate(previewLog.receivedAt) : 'Full payload'}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          <div className="mt-4 flex-1 overflow-auto">
            <pre className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-[12px] leading-relaxed text-zinc-700">
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
          </div>
        </ZoruSheetContent>
      </Sheet>

      {/* Retry dialog */}
      <Dialog open={!!retryLog} onOpenChange={(o) => !o && setRetryLog(null)}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Retry delivery?</ZoruDialogTitle>
            <ZoruDialogDescription>
              We will re-send {retryLog?.event || 'this event'} to your endpoint. Existing logs are kept untouched.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setRetryLog(null)}>Cancel</WaButton>
            <WaButton
              disabled={isRetrying}
              leftIcon={isRetrying ? Loader2 : RotateCcw}
              onClick={() => {
                if (!projectId || !retryLog) return;
                startRetrying(async () => {
                  const payload = retryLog.payload ?? retryLog.body;
                  const res = await replayWebhookLog(projectId, payload);
                  if (res.error) {
                    toast({ title: 'Error', description: res.error, variant: 'destructive' });
                  } else {
                    toast({ title: 'Retry queued', description: res.message || 'The event will be re-delivered shortly.' });
                    setRetryLog(null);
                  }
                });
              }}
            >
              Retry
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
