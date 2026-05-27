'use client';

import { fmtDate } from '@/lib/utils';
import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import Papa from 'papaparse';
import { formatDistanceToNow } from 'date-fns';
import { m, useReducedMotion } from 'motion/react';

import {
  Calendar as CalendarIcon,
  Check,
  CheckCheck,
  CircleDashed,
  CircleX,
  Download,
  Eye,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
  TriangleAlert,
  Users,
} from 'lucide-react';

import {
  getBroadcastById,
  getBroadcastAttempts,
  getBroadcastAttemptsForExport,
  getBroadcastLogs,
} from '@/app/actions/broadcast.actions';
import type { BroadcastAttempt, BroadcastLog } from '@/lib/definitions';

import { useZoruToast } from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  EmptyState,
  StatusPill,
  MetricTile,
  PhoneFrame,
  ChatBubble,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * Wachat broadcast detail report. Same actions; wachat-ui chrome.
 */

type Broadcast = {
  _id: any;
  templateName: string;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  deliveredCount?: number;
  readCount?: number;
  status:
    | 'QUEUED'
    | 'PROCESSING'
    | 'Completed'
    | 'Failed'
    | 'Partial Failure'
    | 'Cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  templateBody?: string;
};

type FilterStatus = 'ALL' | 'SENT' | 'FAILED' | 'PENDING' | 'DELIVERED' | 'READ';

const ATTEMPTS_PER_PAGE = 50;

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function tone(status: string | undefined): { label: string; tone: StatusTone } {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return { label: 'Completed', tone: 'sent' };
  if (s === 'processing' || s === 'pending_processing' || s === 'queued')
    return { label: (status ?? '').replace(/_/g, ' ') || 'Processing', tone: 'sending' };
  if (s === 'partial failure') return { label: 'Partial failure', tone: 'queued' };
  if (s === 'failed') return { label: 'Failed', tone: 'failed' };
  if (s === 'cancelled') return { label: 'Cancelled', tone: 'paused' };
  return { label: status ?? 'Unknown', tone: 'draft' };
}

function attemptTone(status: BroadcastAttempt['status']): { label: string; tone: StatusTone; icon: React.ReactNode } {
  switch (status) {
    case 'READ':
      return { label: 'Read', tone: 'sent', icon: <Eye className="h-3 w-3" strokeWidth={2.25} /> };
    case 'DELIVERED':
      return { label: 'Delivered', tone: 'sent', icon: <CheckCheck className="h-3 w-3" strokeWidth={2.25} /> };
    case 'SENT':
      return { label: 'Sent', tone: 'sending', icon: <Check className="h-3 w-3" strokeWidth={2.25} /> };
    case 'FAILED':
      return { label: 'Failed', tone: 'failed', icon: <CircleX className="h-3 w-3" strokeWidth={2.25} /> };
    case 'PENDING':
    default:
      return { label: 'Pending', tone: 'queued', icon: <CircleDashed className="h-3 w-3" strokeWidth={2.25} /> };
  }
}

const FILTERS: Array<{ value: FilterStatus; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'SENT', label: 'Sent' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'READ', label: 'Read' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PENDING', label: 'Pending' },
];

function ReportSkeleton() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-32 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[110px] rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
      <div className="mt-6 h-[420px] rounded-2xl border border-zinc-200 bg-white" />
    </WaPage>
  );
}

export default function BroadcastReportPage() {
  const reduce = useReducedMotion();
  const [broadcast, setBroadcast] = useState<WithId<Broadcast> | null>(null);
  const [attempts, setAttempts] = useState<BroadcastAttempt[]>([]);
  const [, setLogs] = useState<WithId<BroadcastLog>[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const params = useParams();
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const broadcastId = params.broadcastId as string;

  const fetchPageData = useCallback(
    async (id: string, page: number, filterValue: FilterStatus, showToast = false) => {
      if (!id || id.startsWith('%5B') || id.endsWith('%5D')) return;

      startRefreshTransition(async () => {
        try {
          const [broadcastData, attemptsData, logsData] = await Promise.all([
            getBroadcastById(id),
            getBroadcastAttempts(id, page, ATTEMPTS_PER_PAGE, filterValue),
            getBroadcastLogs(id),
          ]);

          if (broadcastData) {
            setBroadcast(broadcastData);
            setAttempts(attemptsData.attempts);
            setTotalPages(Math.max(1, Math.ceil(attemptsData.total / ATTEMPTS_PER_PAGE)));
            setLogs(logsData);
          } else {
            toast({ title: 'Error', description: 'Broadcast not found.', variant: 'destructive' });
            router.push('/wachat/broadcasts');
          }

          if (showToast) {
            toast({ title: 'Refreshed', description: 'Broadcast details and delivery report updated.' });
          }
        } catch (error) {
          console.error('Failed to fetch broadcast details:', error);
          toast({ title: 'Error', description: 'Failed to load broadcast details.', variant: 'destructive' });
        }
      });
    },
    [router, toast],
  );

  useEffect(() => {
    setIsPageLoading(true);
    if (broadcastId) {
      fetchPageData(broadcastId, currentPage, filter).finally(() => setIsPageLoading(false));
    }
  }, [currentPage, filter, fetchPageData, broadcastId]);

  useEffect(() => {
    if (!broadcast || isPageLoading) return;
    const live = ['QUEUED', 'PROCESSING', 'PENDING_PROCESSING'].includes(broadcast.status);
    if (!live) return;
    const interval = setInterval(() => {
      fetchPageData(broadcastId, currentPage, filter, false);
    }, 10000);
    return () => clearInterval(interval);
  }, [broadcast, isPageLoading, fetchPageData, currentPage, filter, broadcastId]);

  const onRefresh = () => {
    fetchPageData(broadcastId, currentPage, filter, true);
  };

  const handleFilterChange = (value: FilterStatus) => {
    setCurrentPage(1);
    setFilter(value);
  };

  const onExport = () => {
    startExportTransition(async () => {
      try {
        toast({ title: 'Preparing export', description: 'Fetching all attempt data, this may take a moment.' });
        const attemptsToExport = await getBroadcastAttemptsForExport(broadcastId, filter);

        if (attemptsToExport.length === 0) {
          toast({ title: 'Nothing to export', description: 'No contacts found for the current filter.', variant: 'destructive' });
          return;
        }

        const dataForCsv = attemptsToExport.map((attempt) => ({
          'Phone Number': attempt.phone,
          Status: attempt.status,
          'Message ID': attempt.messageId,
          'Details / Error': attempt.error,
          Timestamp: attempt.sentAt ? fmtDate(attempt.sentAt) : '',
        }));

        const csv = Papa.unparse(dataForCsv);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `broadcast_${broadcastId}_${filter}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({ title: 'Export started', description: `Download of ${attemptsToExport.length} records should begin shortly.` });
      } catch (error) {
        console.error('Failed to export data:', error);
        toast({ title: 'Export error', description: 'Could not export the data.', variant: 'destructive' });
      }
    });
  };

  if (isPageLoading) return <ReportSkeleton />;
  if (!broadcast) {
    return (
      <WaPage>
        <EmptyState
          icon={TriangleAlert}
          title="Broadcast not found"
          action={<WaButton onClick={() => router.push('/wachat/broadcasts')}>Back to broadcasts</WaButton>}
        />
      </WaPage>
    );
  }

  const t = tone(broadcast.status);
  const total = broadcast.contactCount ?? 0;
  const sent = broadcast.successCount ?? 0;
  const delivered = broadcast.deliveredCount ?? 0;
  const read = broadcast.readCount ?? 0;
  const failed = broadcast.errorCount ?? 0;

  const enrichedAttempts = attempts.map((attempt) => {
    let detail = '';
    if (['SENT', 'DELIVERED', 'READ'].includes(attempt.status)) {
      detail = attempt.messageId || 'Sent successfully';
    } else if (attempt.status === 'FAILED') {
      detail = attempt.error || 'Failed with unknown error';
    } else {
      detail = 'Waiting to be sent';
    }
    return { ...attempt, detail };
  });

  return (
    <WaPage>
      <PageHeader
        title={broadcast.templateName || 'Broadcast report'}
        description={broadcast.fileName ? `File: ${broadcast.fileName}` : 'Per-contact delivery report for this campaign.'}
        kicker="Wachat / campaigns"
        eyebrowIcon={Megaphone}
        backHref="/wachat/broadcasts"
        actions={
          <>
            <StatusPill tone={t.tone}>{t.label}</StatusPill>
            <WaButton variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} leftIcon={RefreshCw}>
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </WaButton>
            <WaButton size="sm" onClick={onExport} disabled={isExporting} leftIcon={isExporting ? Loader2 : Download}>
              {isExporting ? 'Exporting' : 'Export CSV'}
            </WaButton>
          </>
        }
      />

      <p className="mb-6 flex flex-wrap items-center gap-3 text-[12.5px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          Queued {formatDistanceToNow(new Date(broadcast.createdAt), { addSuffix: true })}
        </span>
        {broadcast.completedAt && (
          <span>/ Completed {formatDistanceToNow(new Date(broadcast.completedAt), { addSuffix: true })}</span>
        )}
      </p>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricTile label="Total contacts" value={compact(total)} icon={Users} delay={0} />
        <MetricTile label="Sent" value={compact(sent)} icon={Send} delay={0.05} delta={{ value: `${pct(sent, total)}% of total`, positive: true }} />
        <MetricTile label="Delivered" value={compact(delivered)} icon={CheckCheck} delay={0.1} delta={{ value: `${pct(delivered, sent)}% of sent`, positive: true }} />
        <MetricTile label="Read" value={compact(read)} icon={Eye} delay={0.15} delta={{ value: `${pct(read, delivered)}% of delivered`, positive: true }} />
        <MetricTile label="Failed" value={compact(failed)} icon={TriangleAlert} delay={0.2} delta={{ value: `${pct(failed, total)}% of total`, positive: failed === 0 }} />
      </div>

      {/* Phone preview + funnel */}
      <div className="mb-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="mx-auto lg:mx-0">
          <PhoneFrame title={broadcast.templateName || 'Broadcast'} subtitle="template preview">
            <ChatBubble
              who="us"
              kind="template"
              text={
                <span className="block whitespace-pre-line">
                  {broadcast.templateBody?.trim() || broadcast.templateName || 'Template preview'}
                </span>
              }
              time="9:41"
              delay={0.1}
            />
          </PhoneFrame>
        </div>
        <Section title="Delivery funnel" description="Where contacts dropped off across the lifecycle.">
          <div className="flex flex-col gap-3">
            <FunnelBar label="Queued" count={total} total={total} delay={0} reduce={!!reduce} />
            <FunnelBar label="Sent" count={sent} total={total} delay={0.05} reduce={!!reduce} />
            <FunnelBar label="Delivered" count={delivered} total={total} delay={0.1} reduce={!!reduce} />
            <FunnelBar label="Read" count={read} total={total} delay={0.15} reduce={!!reduce} />
            {failed > 0 && (
              <FunnelBar label="Failed" count={failed} total={total} negative delay={0.2} reduce={!!reduce} />
            )}
          </div>
        </Section>
      </div>

      {/* Delivery results */}
      <Section
        title="Delivery results"
        description="Live status for each contact. Auto-refreshes every 10 seconds while the campaign is processing."
        padded={false}
      >
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 px-5 py-3">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => handleFilterChange(f.value)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors active:scale-[0.97] ${
                  active
                    ? 'text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-900 hover:text-zinc-900'
                }`}
                style={active ? { background: 'var(--mt-accent)' } : undefined}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {isRefreshing && enrichedAttempts.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : enrichedAttempts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={CircleDashed}
              title={`No ${filter.toLowerCase()} results`}
              description="Nothing matched this filter for the current broadcast. Choose a different tab or refresh."
            />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <ul className="divide-y divide-zinc-100">
              {enrichedAttempts.map((attempt, i) => {
                const chip = attemptTone(attempt.status);
                return (
                  <m.li
                    key={attempt._id}
                    initial={reduce ? false : { opacity: 0, y: 3 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.25, delay: 0.01 + Math.min(i, 20) * 0.025, ease: EASE_OUT }}
                    className="grid grid-cols-[minmax(140px,1fr)_auto_minmax(120px,2fr)] items-center gap-4 px-5 py-2.5 transition-colors hover:bg-zinc-50"
                  >
                    <span className="truncate font-mono text-[12px] tabular-nums text-zinc-900">{attempt.phone}</span>
                    <StatusPill tone={chip.tone}>
                      <span className="inline-flex items-center gap-1">
                        {chip.icon}
                        {chip.label}
                      </span>
                    </StatusPill>
                    <span className="truncate font-mono text-[11px] text-zinc-500">{attempt.detail}</span>
                  </m.li>
                );
              })}
            </ul>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
            <span className="text-[11.5px] tabular-nums text-zinc-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <WaButton
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isRefreshing}
              >
                Previous
              </WaButton>
              <WaButton
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || isRefreshing}
              >
                Next
              </WaButton>
            </div>
          </div>
        )}
      </Section>
    </WaPage>
  );
}

function FunnelBar({
  label,
  count,
  total,
  negative,
  delay,
  reduce,
}: {
  label: string;
  count: number;
  total: number;
  negative?: boolean;
  delay: number;
  reduce: boolean;
}) {
  const width = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-medium text-zinc-900">{label}</span>
        <span className="tabular-nums text-zinc-500">
          {count.toLocaleString()} / {width}%
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <m.div
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.5, delay, ease: EASE_OUT }}
          className="h-full rounded-full"
          style={{ background: negative ? '#e11d48' : 'var(--mt-accent)' }}
        />
      </div>
    </div>
  );
}
