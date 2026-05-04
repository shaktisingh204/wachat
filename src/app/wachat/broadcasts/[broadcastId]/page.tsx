'use client';

/**
 * Broadcast Report — per-campaign detail page, rebuilt on Clay.
 *
 * Shows live delivery status for a single broadcast: a 5-tile KPI
 * strip, a delivery funnel, filter tabs, paginated attempt rows,
 * and CSV export. Auto-polls every 5 seconds while the broadcast
 * is still QUEUED or PROCESSING.
 */

import * as React from 'react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import Papa from 'papaparse';
import { formatDistanceToNow, format } from 'date-fns';

import {
  LuArrowLeft,
  LuRefreshCw,
  LuCheck,
  LuCheckCheck,
  LuCircleX,
  LuEye,
  LuUsers,
  LuSend,
  LuTriangleAlert,
  LuDownload,
  LuLoader,
  LuCircleDashed,
  LuCalendar,
} from 'react-icons/lu';

import {
  getBroadcastById,
  getBroadcastAttempts,
  getBroadcastAttemptsForExport,
  getBroadcastLogs,
} from '@/app/actions/broadcast.actions';
import type { BroadcastAttempt, BroadcastLog } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';

import { cn } from '@/lib/utils';
import {
  ClayBreadcrumbs,
  ClayButton,
  ClayCard,
} from '@/components/clay';

/* ── types ──────────────────────────────────────────────────────── */

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
};

type FilterStatus =
  | 'ALL'
  | 'SENT'
  | 'FAILED'
  | 'PENDING'
  | 'DELIVERED'
  | 'READ';

const ATTEMPTS_PER_PAGE = 50;

/* ── helpers ────────────────────────────────────────────────────── */

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

function statusTone(status: string | undefined): {
  label: string;
  chip: string;
  dot: string;
} {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed')
    return {
      label: 'Completed',
      chip: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
      dot: 'bg-emerald-500',
    };
  if (s === 'processing' || s === 'pending_processing' || s === 'queued')
    return {
      label: (status ?? '').replace(/_/g, ' ') || 'Processing',
      chip: 'bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]',
      dot: 'bg-sky-500',
    };
  if (s === 'partial failure')
    return {
      label: 'Partial failure',
      chip: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
      dot: 'bg-amber-500',
    };
  if (s === 'failed')
    return {
      label: 'Failed',
      chip: 'bg-rose-50 text-destructive border-destructive/40',
      dot: 'bg-destructive',
    };
  if (s === 'cancelled')
    return {
      label: 'Cancelled',
      chip: 'bg-muted text-muted-foreground border-border',
      dot: 'bg-muted-foreground/70',
    };
  return {
    label: status ?? 'Unknown',
    chip: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/70',
  };
}

function attemptStatusChip(status: BroadcastAttempt['status']) {
  switch (status) {
    case 'READ':
      return {
        icon: <LuEye className="h-3 w-3" strokeWidth={2} />,
        label: 'Read',
        className: 'bg-[#E0E7FF] text-[#3730A3] border-[#A5B4FC]',
      };
    case 'DELIVERED':
      return {
        icon: <LuCheckCheck className="h-3 w-3" strokeWidth={2} />,
        label: 'Delivered',
        className: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
      };
    case 'SENT':
      return {
        icon: <LuCheck className="h-3 w-3" strokeWidth={2} />,
        label: 'Sent',
        className: 'bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]',
      };
    case 'FAILED':
      return {
        icon: <LuCircleX className="h-3 w-3" strokeWidth={2} />,
        label: 'Failed',
        className: 'bg-rose-50 text-destructive border-destructive/40',
      };
    case 'PENDING':
    default:
      return {
        icon: <LuCircleDashed className="h-3 w-3" strokeWidth={2} />,
        label: 'Pending',
        className: 'bg-muted text-muted-foreground border-border',
      };
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

/* ── skeleton ───────────────────────────────────────────────────── */

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-6 clay-enter">
      <div className="h-3 w-56 animate-pulse rounded-full bg-muted" />
      <div className="flex items-center justify-between">
        <div className="h-9 w-72 animate-pulse rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-full bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[100px] animate-pulse rounded-[14px] bg-muted"
          />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function BroadcastReportPage() {
  const [broadcast, setBroadcast] = useState<WithId<Broadcast> | null>(null);
  const [attempts, setAttempts] = useState<BroadcastAttempt[]>([]);
  const [, setLogs] = useState<WithId<BroadcastLog>[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const broadcastId = params.broadcastId as string;

  const fetchPageData = useCallback(
    async (
      id: string,
      page: number,
      filterValue: FilterStatus,
      showToast = false,
    ) => {
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
            setTotalPages(
              Math.max(1, Math.ceil(attemptsData.total / ATTEMPTS_PER_PAGE)),
            );
            setLogs(logsData);
          } else {
            toast({
              title: 'Error',
              description: 'Broadcast not found.',
              variant: 'destructive',
            });
            router.push('/wachat/broadcasts');
          }

          if (showToast) {
            toast({
              title: 'Refreshed',
              description: 'Broadcast details and delivery report updated.',
            });
          }
        } catch (error) {
          console.error('Failed to fetch broadcast details:', error);
          toast({
            title: 'Error',
            description: 'Failed to load broadcast details.',
            variant: 'destructive',
          });
        }
      });
    },
    [router, toast],
  );

  useEffect(() => {
    setIsPageLoading(true);
    if (broadcastId) {
      fetchPageData(broadcastId, currentPage, filter).finally(() =>
        setIsPageLoading(false),
      );
    }
  }, [currentPage, filter, fetchPageData, broadcastId]);

  useEffect(() => {
    if (!broadcast || isPageLoading) return;
    const live = ['QUEUED', 'PROCESSING', 'PENDING_PROCESSING'].includes(broadcast.status);
    if (!live) return;
    const interval = setInterval(() => {
      fetchPageData(broadcastId, currentPage, filter, false);
    }, 10000); // Poll every 10s to reduce server load
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
        toast({
          title: 'Preparing export',
          description: 'Fetching all attempt data, this may take a moment…',
        });
        const attemptsToExport = await getBroadcastAttemptsForExport(
          broadcastId,
          filter,
        );

        if (attemptsToExport.length === 0) {
          toast({
            title: 'Nothing to export',
            description: 'No contacts found for the current filter.',
            variant: 'destructive',
          });
          return;
        }

        const dataForCsv = attemptsToExport.map((attempt) => ({
          'Phone Number': attempt.phone,
          Status: attempt.status,
          'Message ID': attempt.messageId,
          'Details / Error': attempt.error,
          Timestamp: attempt.sentAt
            ? new Date(attempt.sentAt).toLocaleString()
            : '',
        }));

        const csv = Papa.unparse(dataForCsv);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute(
          'download',
          `broadcast_${broadcastId}_${filter}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: 'Export started',
          description: `Download of ${attemptsToExport.length} records should begin shortly.`,
        });
      } catch (error) {
        console.error('Failed to export data:', error);
        toast({
          title: 'Export error',
          description: 'Could not export the data.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isPageLoading) return <ReportSkeleton />;
  if (!broadcast) {
    return (
      <div className="flex flex-col gap-6 clay-enter">
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <LuTriangleAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-foreground">
            Broadcast not found
          </div>
          <ClayButton
            variant="rose"
            size="md"
            onClick={() => router.push('/wachat/broadcasts')}
            className="mt-5"
          >
            Back to broadcasts
          </ClayButton>
        </ClayCard>
      </div>
    );
  }

  const tone = statusTone(broadcast.status);
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
      detail = 'Waiting to be sent…';
    }
    return { ...attempt, detail };
  });

  return (
    <div className="flex flex-col gap-6 clay-enter">
      {/* Breadcrumb */}
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/dashboard' },
          { label: 'Campaigns', href: '/wachat/broadcasts' },
          { label: broadcast.templateName || 'Report' },
        ]}
      />

      {/* Back link + header */}
      <div>
        <Link
          href="/wachat/broadcasts"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <LuArrowLeft className="h-3 w-3" strokeWidth={2} />
          Back to broadcasts
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
                {broadcast.templateName || 'Broadcast report'}
              </h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  tone.chip,
                )}
              >
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', tone.dot)}
                />
                {tone.label}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
              {broadcast.fileName ? (
                <span>
                  File:{' '}
                  <span className="font-medium text-foreground">
                    {broadcast.fileName}
                  </span>
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <LuCalendar className="h-3 w-3" strokeWidth={2} />
                Queued{' '}
                {formatDistanceToNow(new Date(broadcast.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {broadcast.completedAt ? (
                <span>
                  · Completed{' '}
                  {formatDistanceToNow(new Date(broadcast.completedAt), {
                    addSuffix: true,
                  })}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ClayButton
              variant="pill"
              size="md"
              leading={
                <LuRefreshCw
                  className={cn(
                    'h-3.5 w-3.5',
                    isRefreshing && 'animate-spin',
                  )}
                  strokeWidth={2}
                />
              }
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </ClayButton>
            <ClayButton
              variant="obsidian"
              size="md"
              leading={
                isExporting ? (
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuDownload className="h-3.5 w-3.5" strokeWidth={2} />
                )
              }
              onClick={onExport}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting…' : 'Export CSV'}
            </ClayButton>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label="Total contacts"
          value={compact(total)}
          icon={<LuUsers className="h-4 w-4" strokeWidth={2} />}
          tint="neutral"
        />
        <Kpi
          label="Sent"
          value={compact(sent)}
          hint={`${pct(sent, total)}%`}
          icon={<LuSend className="h-4 w-4" strokeWidth={2} />}
          tint="blue"
        />
        <Kpi
          label="Delivered"
          value={compact(delivered)}
          hint={`${pct(delivered, sent)}% of sent`}
          icon={<LuCheckCheck className="h-4 w-4" strokeWidth={2} />}
          tint="green"
        />
        <Kpi
          label="Read"
          value={compact(read)}
          hint={`${pct(read, delivered)}% of delivered`}
          icon={<LuEye className="h-4 w-4" strokeWidth={2} />}
          tint="indigo"
        />
        <Kpi
          label="Failed"
          value={compact(failed)}
          hint={`${pct(failed, total)}% of total`}
          icon={<LuTriangleAlert className="h-4 w-4" strokeWidth={2} />}
          tint="rose"
        />
      </div>

      {/* Delivery funnel */}
      <ClayCard padded={false} className="p-6">
        <div className="text-[14px] font-semibold text-foreground">
          Delivery funnel
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <FunnelBar
            label="Queued"
            count={total}
            total={total}
            color="bg-foreground/70"
          />
          <FunnelBar
            label="Sent"
            count={sent}
            total={total}
            color="bg-sky-500"
          />
          <FunnelBar
            label="Delivered"
            count={delivered}
            total={total}
            color="bg-emerald-500"
          />
          <FunnelBar
            label="Read"
            count={read}
            total={total}
            color="bg-amber-500"
          />
          {failed > 0 ? (
            <FunnelBar
              label="Failed"
              count={failed}
              total={total}
              color="bg-destructive"
            />
          ) : null}
        </div>
      </ClayCard>

      {/* Delivery results table */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground leading-none">
              Delivery results
            </h2>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              Live status for each contact. Auto-refreshes every 5 seconds
              while the campaign is still processing.
            </p>
          </div>
        </div>

        <ClayCard padded={false} className="mt-5 p-6">
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleFilterChange(f.value)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-[background,border-color,color]',
                    active
                      ? 'bg-foreground border-foreground text-white shadow-sm'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-border',
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="mt-5 overflow-hidden rounded-[12px] border border-border">
            {isRefreshing && enrichedAttempts.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <LuLoader
                  className="h-5 w-5 animate-spin text-muted-foreground"
                  strokeWidth={1.75}
                />
              </div>
            ) : enrichedAttempts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <LuCircleDashed className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div className="mt-2 text-[13px] font-semibold text-foreground">
                  No {filter.toLowerCase()} results
                </div>
                <div className="max-w-[360px] text-[11.5px] text-muted-foreground">
                  Nothing matched this filter for the current broadcast.
                  Choose a different tab or refresh.
                </div>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 z-10 bg-secondary border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Phone number</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">
                        Message ID / error details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {enrichedAttempts.map((attempt) => {
                      const chip = attemptStatusChip(attempt.status);
                      return (
                        <tr
                          key={attempt._id}
                          className="transition-colors hover:bg-secondary"
                        >
                          <td className="px-4 py-3 font-mono text-[12px] text-foreground tabular-nums">
                            {attempt.phone}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold',
                                chip.className,
                              )}
                            >
                              {chip.icon}
                              {chip.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                            {attempt.detail}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <ClayButton
                  variant="pill"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isRefreshing}
                >
                  Previous
                </ClayButton>
                <ClayButton
                  variant="pill"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage >= totalPages || isRefreshing}
                >
                  Next
                </ClayButton>
              </div>
            </div>
          ) : null}
        </ClayCard>
      </div>

      <div className="h-6" />
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────── */

type KpiTint = 'neutral' | 'blue' | 'green' | 'indigo' | 'rose' | 'amber';

const kpiTints: Record<KpiTint, string> = {
  neutral: 'bg-muted text-muted-foreground',
  blue: 'bg-[#DBEAFE] text-[#1E40AF]',
  green: 'bg-[#DCFCE7] text-[#166534]',
  indigo: 'bg-[#E0E7FF] text-[#3730A3]',
  amber: 'bg-[#FEF3C7] text-[#92400E]',
  rose: 'bg-accent text-accent-foreground',
};

function Kpi({
  label,
  value,
  hint,
  icon,
  tint,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tint: KpiTint;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-border hover:shadow-sm">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-[10px]',
            kpiTints[tint],
          )}
        >
          <span className="flex h-4 w-4 items-center justify-center">
            {icon}
          </span>
        </span>
      </div>
      <div className="mt-3.5 text-[11.5px] font-medium text-muted-foreground leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.01em] text-foreground leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-muted-foreground leading-tight truncate">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function FunnelBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const width = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {count.toLocaleString()} · {width}%
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            color,
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
