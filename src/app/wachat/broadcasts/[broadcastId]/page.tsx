'use client';

import { fmtDate } from '@/lib/utils';
import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import Papa from 'papaparse';
import { formatDistanceToNow } from 'date-fns';
import { m, useReducedMotion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Calendar as CalendarIcon,
  Check,
  CheckCheck,
  CircleDashed,
  CircleX,
  Clock,
  Coins,
  Download,
  Eye,
  Loader2,
  MailWarning,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Send,
  TriangleAlert,
  Users,
  Zap,
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

type Broadcast = {
  _id: any;
  templateName: string;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  deliveredCount?: number;
  readCount?: number;
  respondedCount?: number;
  optOutCount?: number;
  estimatedCost?: number;
  cost?: number;
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[100px] rounded-2xl border border-zinc-200 bg-white" />
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
  const [logs, setLogs] = useState<WithId<BroadcastLog>[]>([]);
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

  // Per-hour delivery timeline derived from attempts that are loaded
  const hourly = useMemo(() => {
    if (!attempts.length) return [] as { label: string; sent: number; failed: number }[];
    const buckets = new Map<string, { sent: number; failed: number }>();
    for (const a of attempts) {
      const ts = (a as any).sentAt ? new Date((a as any).sentAt) : null;
      if (!ts || isNaN(ts.getTime())) continue;
      const k = `${ts.getUTCFullYear()}-${ts.getUTCMonth() + 1}-${ts.getUTCDate()} ${ts.getUTCHours()}`;
      const cur = buckets.get(k) || { sent: 0, failed: 0 };
      if (a.status === 'FAILED') cur.failed++;
      else if (a.status === 'SENT' || a.status === 'DELIVERED' || a.status === 'READ') cur.sent++;
      buckets.set(k, cur);
    }
    return Array.from(buckets, ([key, v]) => {
      const [, , , h] = key.split(/[-\s]/);
      return { label: `${String(h).padStart(2, '0')}:00`, sent: v.sent, failed: v.failed };
    });
  }, [attempts]);

  // Failure breakdown by error string (closest proxy for WhatsApp error code)
  const failureBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attempts) {
      if (a.status !== 'FAILED') continue;
      const code = a.error ? String(a.error).slice(0, 80) : 'Unknown';
      m.set(code, (m.get(code) || 0) + 1);
    }
    return Array.from(m, ([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
  }, [attempts]);

  // Median delivery latency in seconds, from loaded attempts that have sentAt and deliveredAt
  const medianLatencyS = useMemo(() => {
    const ls: number[] = [];
    for (const a of attempts as any[]) {
      if (a?.sentAt && a?.deliveredAt) {
        const d = new Date(a.deliveredAt).getTime() - new Date(a.sentAt).getTime();
        if (d > 0 && d < 1000 * 60 * 60) ls.push(d / 1000);
      }
    }
    if (!ls.length) return null;
    ls.sort((x, y) => x - y);
    return ls[Math.floor(ls.length / 2)];
  }, [attempts]);

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
  const responded = broadcast.respondedCount ?? 0;
  const optOuts = broadcast.optOutCount ?? 0;
  const cost = broadcast.estimatedCost ?? broadcast.cost ?? 0;

  const enrichedAttempts = attempts.map((attempt) => {
    let detail = '';
    if (['SENT', 'DELIVERED', 'READ'].includes(attempt.status)) {
      detail = attempt.messageId || 'Sent successfully';
    } else if (attempt.status === 'FAILED') {
      detail = attempt.error || 'Failed with unknown error';
    } else {
      detail = 'Waiting to be sent';
    }
    let latency: number | null = null;
    const aa = attempt as any;
    if (aa?.sentAt && aa?.deliveredAt) {
      const d = new Date(aa.deliveredAt).getTime() - new Date(aa.sentAt).getTime();
      if (d > 0 && d < 1000 * 60 * 60) latency = d / 1000;
    }
    const lastEvent = aa?.readAt || aa?.deliveredAt || aa?.sentAt || null;
    return { ...attempt, detail, latency, lastEvent };
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
            {failed > 0 && (
              <WaButton
                variant="outline"
                size="sm"
                leftIcon={RotateCcw}
                onClick={() => handleFilterChange('FAILED')}
              >
                Re-target failed ({compact(failed)})
              </WaButton>
            )}
            <WaButton variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} leftIcon={RefreshCw}>
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </WaButton>
            <WaButton size="sm" onClick={onExport} disabled={isExporting} leftIcon={isExporting ? Loader2 : Download}>
              {isExporting ? 'Exporting' : 'Export CSV'}
            </WaButton>
          </>
        }
      />

      <p className="mb-4 flex flex-wrap items-center gap-3 text-[12px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          Queued {formatDistanceToNow(new Date(broadcast.createdAt), { addSuffix: true })}
        </span>
        {broadcast.startedAt && (
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Started {formatDistanceToNow(new Date(broadcast.startedAt), { addSuffix: true })}
          </span>
        )}
        {broadcast.completedAt && (
          <span className="inline-flex items-center gap-1">
            <CheckCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Completed {formatDistanceToNow(new Date(broadcast.completedAt), { addSuffix: true })}
          </span>
        )}
        {logs.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <MailWarning className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            {logs.length} log entries
          </span>
        )}
      </p>

      {/* 8-tile KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <MetricTile label="Contacts" value={compact(total)} icon={Users} delay={0} />
        <MetricTile label="Sent" value={compact(sent)} icon={Send} delay={0.04} delta={{ value: `${pct(sent, total)}%`, positive: true }} />
        <MetricTile label="Delivered" value={compact(delivered)} icon={CheckCheck} delay={0.08} delta={{ value: `${pct(delivered, sent)}%`, positive: true }} />
        <MetricTile label="Read" value={compact(read)} icon={Eye} delay={0.12} delta={{ value: `${pct(read, delivered)}%`, positive: true }} />
        <MetricTile label="Responded" value={compact(responded)} icon={Zap} delay={0.16} delta={{ value: `${pct(responded, delivered)}%`, positive: true }} />
        <MetricTile label="Failed" value={compact(failed)} icon={TriangleAlert} delay={0.2} delta={{ value: `${pct(failed, total)}%`, positive: failed === 0 }} />
        <MetricTile label="Opt-outs" value={compact(optOuts)} icon={CircleX} delay={0.24} />
        <MetricTile
          label="Median latency"
          value={medianLatencyS != null ? `${medianLatencyS.toFixed(1)}s` : '-'}
          icon={Clock}
          delay={0.28}
        />
      </div>

      {/* Cost tile separate row for emphasis when available */}
      {cost > 0 && (
        <div className="mb-4">
          <Section title="Cost" description="Estimated cost for this broadcast.">
            <div className="flex items-baseline gap-2">
              <Coins className="h-4 w-4 text-zinc-400" strokeWidth={2.25} />
              <span className="text-[20px] font-semibold tabular-nums text-zinc-900">
                {Number(cost).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
              <span className="text-[12px] text-zinc-500">across {compact(sent)} sent messages</span>
            </div>
          </Section>
        </div>
      )}

      {/* Phone preview + funnel */}
      <div className="mb-4 grid gap-3 lg:grid-cols-[320px_1fr]">
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
            {responded > 0 && (
              <FunnelBar label="Responded" count={responded} total={total} delay={0.18} reduce={!!reduce} />
            )}
            {failed > 0 && (
              <FunnelBar label="Failed" count={failed} total={total} negative delay={0.2} reduce={!!reduce} />
            )}
          </div>
        </Section>
      </div>

      {/* Hourly timeline + failure breakdown */}
      <div className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Per-hour delivery" description="Loaded attempts grouped by send hour.">
          {hourly.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-zinc-500">No timestamps available yet.</p>
          ) : (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourly} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#71717a' }} stroke="#e4e4e7" />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} stroke="#e4e4e7" />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e4e4e7' }}
                    cursor={{ stroke: '#a1a1aa', strokeDasharray: '3 3' }}
                  />
                  <Line type="monotone" dataKey="sent" stroke="#25D366" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="failed" stroke="#e11d48" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title="Failure breakdown" description="Top error reasons from loaded attempts.">
          {failureBreakdown.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-zinc-500">No failures recorded.</p>
          ) : (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={failureBreakdown.slice(0, 6)} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="code" tick={{ fontSize: 9, fill: '#71717a' }} stroke="#e4e4e7" />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} stroke="#e4e4e7" />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e4e4e7' }}
                    cursor={{ fill: 'rgba(225,29,72,0.04)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {failureBreakdown.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill="#e11d48" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
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

        {/* Column header (~36px row) */}
        <div className="hidden border-b border-zinc-100 bg-zinc-50/60 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 sm:grid sm:grid-cols-[minmax(140px,1.2fr)_100px_minmax(160px,2fr)_90px_120px]">
          <span>Phone</span>
          <span>Status</span>
          <span>Detail / message id</span>
          <span className="text-right">Latency</span>
          <span className="text-right">Last event</span>
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
                    className="grid h-[36px] grid-cols-[minmax(140px,1.2fr)_100px_minmax(160px,2fr)_90px_120px] items-center gap-4 px-5 text-[12px] transition-colors hover:bg-zinc-50"
                  >
                    <span className="truncate font-mono tabular-nums text-zinc-900">{attempt.phone}</span>
                    <StatusPill tone={chip.tone}>
                      <span className="inline-flex items-center gap-1">
                        {chip.icon}
                        {chip.label}
                      </span>
                    </StatusPill>
                    <span className="truncate font-mono text-[11px] text-zinc-500">{attempt.detail}</span>
                    <span className="text-right tabular-nums text-zinc-700">
                      {attempt.latency != null ? `${attempt.latency.toFixed(1)}s` : '-'}
                    </span>
                    <span className="text-right tabular-nums text-zinc-500">
                      {attempt.lastEvent ? formatDistanceToNow(new Date(attempt.lastEvent), { addSuffix: true }) : '-'}
                    </span>
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
