'use client';

/**
 * Broadcast Report — per-campaign detail, ZoruUI rebuild.
 *
 * Same data + handlers as before (getBroadcastById, getBroadcastAttempts,
 * getBroadcastAttemptsForExport, getBroadcastLogs). Visual layer fully
 * on Zoru primitives — neutral palette, no rainbow.
 */

import * as React from 'react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import Papa from 'papaparse';
import { formatDistanceToNow } from 'date-fns';

import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  CheckCheck,
  CircleDashed,
  CircleX,
  Download,
  Eye,
  Loader2,
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
import { useToast } from '@/hooks/use-toast';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruProgress,
  ZoruSkeleton,
  ZoruStatCard,
  cn,
} from '@/components/zoruui';

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
  variant: 'success' | 'info' | 'warning' | 'danger' | 'secondary';
  dot: string;
} {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed')
    return { label: 'Completed', variant: 'success', dot: 'bg-zoru-success' };
  if (s === 'processing' || s === 'pending_processing' || s === 'queued')
    return {
      label: (status ?? '').replace(/_/g, ' ') || 'Processing',
      variant: 'info',
      dot: 'bg-zoru-info',
    };
  if (s === 'partial failure')
    return {
      label: 'Partial failure',
      variant: 'warning',
      dot: 'bg-zoru-warning',
    };
  if (s === 'failed')
    return { label: 'Failed', variant: 'danger', dot: 'bg-zoru-danger' };
  if (s === 'cancelled')
    return {
      label: 'Cancelled',
      variant: 'secondary',
      dot: 'bg-zoru-ink-subtle',
    };
  return {
    label: status ?? 'Unknown',
    variant: 'secondary',
    dot: 'bg-zoru-ink-subtle',
  };
}

function attemptStatusChip(status: BroadcastAttempt['status']): {
  icon: React.ReactNode;
  label: string;
  variant: 'success' | 'info' | 'danger' | 'secondary';
} {
  switch (status) {
    case 'READ':
      return {
        icon: <Eye className="h-3 w-3" />,
        label: 'Read',
        variant: 'info',
      };
    case 'DELIVERED':
      return {
        icon: <CheckCheck className="h-3 w-3" />,
        label: 'Delivered',
        variant: 'success',
      };
    case 'SENT':
      return {
        icon: <Check className="h-3 w-3" />,
        label: 'Sent',
        variant: 'info',
      };
    case 'FAILED':
      return {
        icon: <CircleX className="h-3 w-3" />,
        label: 'Failed',
        variant: 'danger',
      };
    case 'PENDING':
    default:
      return {
        icon: <CircleDashed className="h-3 w-3" />,
        label: 'Pending',
        variant: 'secondary',
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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-56" />
      <div className="flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <div className="flex gap-2">
          <ZoruSkeleton className="h-9 w-28" />
          <ZoruSkeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-[100px]" />
        ))}
      </div>
      <ZoruSkeleton className="h-[420px]" />
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
    const live = ['QUEUED', 'PROCESSING', 'PENDING_PROCESSING'].includes(
      broadcast.status,
    );
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
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
        <ZoruEmptyState
          icon={<TriangleAlert />}
          title="Broadcast not found"
          action={
            <ZoruButton onClick={() => router.push('/wachat/broadcasts')}>
              Back to broadcasts
            </ZoruButton>
          }
        />
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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/broadcasts">
              Campaigns
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>
              {broadcast.templateName || 'Report'}
            </ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* Back link + header */}
      <div>
        <Link
          href="/wachat/broadcasts"
          className="inline-flex items-center gap-1.5 text-[11.5px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to broadcasts
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
                {broadcast.templateName || 'Broadcast report'}
              </h1>
              <ZoruBadge variant={tone.variant}>
                <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                {tone.label}
              </ZoruBadge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12.5px] text-zoru-ink-muted">
              {broadcast.fileName ? (
                <span>
                  File:{' '}
                  <span className="text-zoru-ink">{broadcast.fileName}</span>
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
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
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')}
              />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </ZoruButton>
            <ZoruButton
              size="sm"
              onClick={onExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {isExporting ? 'Exporting…' : 'Export CSV'}
            </ZoruButton>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <ZoruStatCard
          label="Total contacts"
          value={compact(total)}
          icon={<Users />}
        />
        <ZoruStatCard
          label="Sent"
          value={compact(sent)}
          period={`${pct(sent, total)}% of total`}
          icon={<Send />}
        />
        <ZoruStatCard
          label="Delivered"
          value={compact(delivered)}
          period={`${pct(delivered, sent)}% of sent`}
          icon={<CheckCheck />}
        />
        <ZoruStatCard
          label="Read"
          value={compact(read)}
          period={`${pct(read, delivered)}% of delivered`}
          icon={<Eye />}
        />
        <ZoruStatCard
          label="Failed"
          value={compact(failed)}
          period={`${pct(failed, total)}% of total`}
          icon={<TriangleAlert />}
        />
      </div>

      {/* Delivery funnel */}
      <ZoruCard className="p-6">
        <div className="text-sm text-zoru-ink">Delivery funnel</div>
        <div className="mt-4 flex flex-col gap-3">
          <FunnelBar label="Queued" count={total} total={total} />
          <FunnelBar label="Sent" count={sent} total={total} />
          <FunnelBar label="Delivered" count={delivered} total={total} />
          <FunnelBar label="Read" count={read} total={total} />
          {failed > 0 ? (
            <FunnelBar label="Failed" count={failed} total={total} negative />
          ) : null}
        </div>
      </ZoruCard>

      {/* Delivery results table */}
      <section>
        <div>
          <h2 className="text-[22px] tracking-tight text-zoru-ink leading-none">
            Delivery results
          </h2>
          <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
            Live status for each contact. Auto-refreshes every 10 seconds while
            the campaign is still processing.
          </p>
        </div>

        <ZoruCard className="mt-5 p-6">
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <ZoruButton
                  key={f.value}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFilterChange(f.value)}
                >
                  {f.label}
                </ZoruButton>
              );
            })}
          </div>

          {/* Table */}
          <div className="mt-5 overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line">
            {isRefreshing && enrichedAttempts.length === 0 ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
              </div>
            ) : enrichedAttempts.length === 0 ? (
              <ZoruEmptyState
                icon={<CircleDashed />}
                title={`No ${filter.toLowerCase()} results`}
                description="Nothing matched this filter for the current broadcast. Choose a different tab or refresh."
                className="border-0"
              />
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 z-10 border-b border-zoru-line bg-zoru-surface text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                    <tr>
                      <th className="px-4 py-3 text-left">Phone number</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">
                        Message ID / error details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                    {enrichedAttempts.map((attempt) => {
                      const chip = attemptStatusChip(attempt.status);
                      return (
                        <tr
                          key={attempt._id}
                          className="transition-colors hover:bg-zoru-surface"
                        >
                          <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink tabular-nums">
                            {attempt.phone}
                          </td>
                          <td className="px-4 py-3">
                            <ZoruBadge variant={chip.variant}>
                              {chip.icon}
                              {chip.label}
                            </ZoruBadge>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-zoru-ink-muted">
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
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-zoru-line pt-4">
              <span className="text-[11.5px] tabular-nums text-zoru-ink-muted">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isRefreshing}
                >
                  Previous
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage >= totalPages || isRefreshing}
                >
                  Next
                </ZoruButton>
              </div>
            </div>
          ) : null}
        </ZoruCard>
      </section>

      <div className="h-6" />
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────── */

function FunnelBar({
  label,
  count,
  total,
  negative,
}: {
  label: string;
  count: number;
  total: number;
  negative?: boolean;
}) {
  const width = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-zoru-ink">{label}</span>
        <span className="text-zoru-ink-muted tabular-nums">
          {count.toLocaleString()} · {width}%
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zoru-surface-2">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            negative ? 'bg-zoru-danger' : 'bg-zoru-ink',
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
