'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { m, AnimatePresence } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
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
  MetricTile,
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'queued'>('all');

  const kpis = useMemo(() => {
    const total = logs.length;
    const success = logs.filter((l) => ['success', 'sent', 'received'].includes((l.status || '').toLowerCase())).length;
    const failed = logs.filter((l) => ['failed', 'error'].includes((l.status || '').toLowerCase())).length;
    const queued = logs.filter((l) => ['pending', 'queued', 'sending'].includes((l.status || '').toLowerCase())).length;
    const eventTypes = new Set(logs.map((l) => l.event || l.type).filter(Boolean)).size;
    const successRate = total === 0 ? 0 : Math.round((success / total) * 100);
    return { total, success, failed, queued, eventTypes, successRate };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const lower = searchQuery.trim().toLowerCase();
    return logs.filter((l) => {
      if (statusFilter !== 'all') {
        const s = (l.status || '').toLowerCase();
        if (statusFilter === 'success' && !['success', 'sent', 'received'].includes(s)) return false;
        if (statusFilter === 'failed' && !['failed', 'error'].includes(s)) return false;
        if (statusFilter === 'queued' && !['pending', 'queued', 'sending'].includes(s)) return false;
      }
      if (!lower) return true;
      if ((l.event || l.type || '').toLowerCase().includes(lower)) return true;
      if (l.payload && JSON.stringify(l.payload).toLowerCase().includes(lower)) return true;
      if (l.body && JSON.stringify(l.body).toLowerCase().includes(lower)) return true;
      return false;
    });
  }, [logs, searchQuery, statusFilter]);

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

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Events total" value={kpis.total} icon={Activity} delay={0.02} />
        <MetricTile label="Success" value={kpis.success} icon={CheckCircle2} delay={0.04} />
        <MetricTile label="Failed" value={kpis.failed} icon={TriangleAlert} delay={0.06} />
        <MetricTile label="Queued" value={kpis.queued} icon={Clock} delay={0.08} />
        <MetricTile label="Event types" value={kpis.eventTypes} icon={Filter} delay={0.1} />
        <MetricTile label="Success rate" value={<span className="text-[15px]">{kpis.successRate}%</span>} icon={Activity} delay={0.12} />
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Filter</span>
        {([
          { id: 'all', label: 'All' },
          { id: 'success', label: '2xx success' },
          { id: 'failed', label: '4xx and 5xx' },
          { id: 'queued', label: 'Queued' },
        ] as const).map((opt) => {
          const active = statusFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-semibold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${
                active
                  ? 'border-transparent text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900'
              }`}
              style={active ? { background: 'var(--mt-accent)' } : undefined}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

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
                    className="flex h-10 items-center gap-3 px-1"
                  >
                    <span className="hidden w-40 font-mono text-[11px] tabular-nums text-zinc-500 sm:block">
                      {row.receivedAt ? fmtDate(row.receivedAt) : '--'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-zinc-900">
                      {row.event || row.type || 'webhook'}
                    </span>
                    <span className="hidden font-mono text-[11px] tabular-nums text-zinc-400 md:block">
                      attempt 1
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
