'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  Spinner,
  StatCard,
} from '@/components/sabcrm/20ui';
import {
  useState,
  useEffect,
  useTransition,
  useCallback } from 'react';
import { useParams,
  useRouter } from 'next/navigation';
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
  RefreshCw,
  Send,
  TriangleAlert,
  Users,
  } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import {
  getBroadcastById,
  getBroadcastAttempts,
  getBroadcastAttemptsForExport,
  getBroadcastLogs,
  } from '@/app/actions/broadcast.actions';
import type { BroadcastAttempt,
  BroadcastLog } from '@/lib/definitions';

/**
 * Broadcast Report — per-campaign detail, 20ui rebuild.
 *
 * Same data + handlers as before (getBroadcastById, getBroadcastAttempts,
 * getBroadcastAttemptsForExport, getBroadcastLogs). Visual layer fully
 * on 20ui primitives — neutral palette, no rainbow.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
} {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return { label: 'Completed', tone: 'success' };
  if (s === 'processing' || s === 'pending_processing' || s === 'queued')
    return {
      label: (status ?? '').replace(/_/g, ' ') || 'Processing',
      tone: 'info',
    };
  if (s === 'partial failure')
    return { label: 'Partial failure', tone: 'warning' };
  if (s === 'failed') return { label: 'Failed', tone: 'danger' };
  if (s === 'cancelled') return { label: 'Cancelled', tone: 'neutral' };
  return { label: status ?? 'Unknown', tone: 'neutral' };
}

function attemptStatusChip(status: BroadcastAttempt['status']): {
  icon: React.ReactNode;
  label: string;
  tone: 'success' | 'info' | 'danger' | 'neutral';
} {
  switch (status) {
    case 'READ':
      return {
        icon: <Eye className="h-3 w-3" aria-hidden="true" />,
        label: 'Read',
        tone: 'info',
      };
    case 'DELIVERED':
      return {
        icon: <CheckCheck className="h-3 w-3" aria-hidden="true" />,
        label: 'Delivered',
        tone: 'success',
      };
    case 'SENT':
      return {
        icon: <Check className="h-3 w-3" aria-hidden="true" />,
        label: 'Sent',
        tone: 'info',
      };
    case 'FAILED':
      return {
        icon: <CircleX className="h-3 w-3" aria-hidden="true" />,
        label: 'Failed',
        tone: 'danger',
      };
    case 'PENDING':
    default:
      return {
        icon: <CircleDashed className="h-3 w-3" aria-hidden="true" />,
        label: 'Pending',
        tone: 'neutral',
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

const CRUMBS = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Campaigns', href: '/wachat/broadcasts' },
  { label: 'Report' },
];

/* ── skeleton ───────────────────────────────────────────────────── */

function ReportSkeleton() {
  return (
    <WachatPage breadcrumb={CRUMBS} title="Broadcast report" width="wide">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px]" />
          ))}
        </div>
        <Skeleton className="h-[140px]" />
        <Skeleton className="h-[420px]" />
      </div>
    </WachatPage>
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
              tone: 'danger',
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
            tone: 'danger',
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
            tone: 'danger',
          });
          return;
        }

        const dataForCsv = attemptsToExport.map((attempt) => ({
          'Phone Number': attempt.phone,
          Status: attempt.status,
          'Message ID': attempt.messageId,
          'Details / Error': attempt.error,
          Timestamp: attempt.sentAt
            ? fmtDate(attempt.sentAt)
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
          tone: 'danger',
        });
      }
    });
  };

  if (isPageLoading) return <ReportSkeleton />;
  if (!broadcast) {
    return (
      <WachatPage breadcrumb={CRUMBS} title="Broadcast report" width="wide">
        <EmptyState
          icon={TriangleAlert}
          tone="danger"
          title="Broadcast not found"
          action={
            <Button
              variant="primary"
              onClick={() => router.push('/wachat/broadcasts')}
            >
              Back to broadcasts
            </Button>
          }
        />
      </WachatPage>
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

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        iconLeft={RefreshCw}
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </Button>
      <Button
        variant="primary"
        size="sm"
        iconLeft={Download}
        loading={isExporting}
        onClick={onExport}
        disabled={isExporting}
      >
        {isExporting ? 'Exporting…' : 'Export CSV'}
      </Button>
    </div>
  );

  return (
    <WachatPage
      breadcrumb={CRUMBS}
      title={broadcast.templateName || 'Broadcast report'}
      actions={headerActions}
      width="wide"
    >
      <div className="flex flex-col gap-6">
        {/* Back link + status/meta strip */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/wachat/broadcasts"
            className="inline-flex items-center gap-1.5 text-[11.5px] transition-colors"
            style={{ color: 'var(--st-text-secondary)' }}
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Back to broadcasts
          </Link>
          <Badge tone={tone.tone} dot>
            {tone.label}
          </Badge>
        </div>

        <div
          className="flex flex-wrap items-center gap-3 text-[12.5px]"
          style={{ color: 'var(--st-text-secondary)' }}
        >
          {broadcast.fileName ? (
            <span>
              File:{' '}
              <span style={{ color: 'var(--st-text)' }}>
                {broadcast.fileName}
              </span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" aria-hidden="true" />
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

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total contacts" value={compact(total)} icon={Users} />
          <StatCard
            label="Sent"
            value={compact(sent)}
            delta={{ value: `${pct(sent, total)}% of total`, tone: 'neutral' }}
            icon={Send}
          />
          <StatCard
            label="Delivered"
            value={compact(delivered)}
            delta={{ value: `${pct(delivered, sent)}% of sent`, tone: 'neutral' }}
            icon={CheckCheck}
          />
          <StatCard
            label="Read"
            value={compact(read)}
            delta={{
              value: `${pct(read, delivered)}% of delivered`,
              tone: 'neutral',
            }}
            icon={Eye}
          />
          <StatCard
            label="Failed"
            value={compact(failed)}
            delta={{ value: `${pct(failed, total)}% of total`, tone: 'neutral' }}
            icon={TriangleAlert}
          />
        </div>

        {/* Delivery funnel */}
        <Card className="p-6">
          <div className="text-sm" style={{ color: 'var(--st-text)' }}>
            Delivery funnel
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <FunnelBar label="Queued" count={total} total={total} />
            <FunnelBar label="Sent" count={sent} total={total} />
            <FunnelBar label="Delivered" count={delivered} total={total} />
            <FunnelBar label="Read" count={read} total={total} />
            {failed > 0 ? (
              <FunnelBar label="Failed" count={failed} total={total} negative />
            ) : null}
          </div>
        </Card>

        {/* Delivery results table */}
        <section>
          <div>
            <h2
              className="text-[22px] tracking-tight leading-none"
              style={{ color: 'var(--st-text)' }}
            >
              Delivery results
            </h2>
            <p
              className="mt-1.5 text-[12.5px]"
              style={{ color: 'var(--st-text-secondary)' }}
            >
              Live status for each contact. Auto-refreshes every 10 seconds while
              the campaign is still processing.
            </p>
          </div>

          <Card className="mt-5 p-6">
            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const active = filter === f.value;
                return (
                  <Button
                    key={f.value}
                    variant={active ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleFilterChange(f.value)}
                  >
                    {f.label}
                  </Button>
                );
              })}
            </div>

            {/* Table */}
            <div
              className="mt-5 overflow-hidden"
              style={{
                borderRadius: 'var(--st-radius)',
                border: '1px solid var(--st-border)',
              }}
            >
              {isRefreshing && enrichedAttempts.length === 0 ? (
                <div className="flex h-40 items-center justify-center">
                  <Spinner size="md" />
                </div>
              ) : enrichedAttempts.length === 0 ? (
                <EmptyState
                  icon={CircleDashed}
                  title={`No ${filter.toLowerCase()} results`}
                  description="Nothing matched this filter for the current broadcast. Choose a different tab or refresh."
                />
              ) : (
                <div className="max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-[13px]">
                    <thead
                      className="sticky top-0 z-10 text-[11px] uppercase tracking-wide"
                      style={{
                        background: 'var(--st-bg-secondary)',
                        color: 'var(--st-text-secondary)',
                        borderBottom: '1px solid var(--st-border)',
                      }}
                    >
                      <tr>
                        <th className="px-4 py-3 text-left">Phone number</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">
                          Message ID / error details
                        </th>
                      </tr>
                    </thead>
                    <tbody style={{ background: 'var(--st-bg)' }}>
                      {enrichedAttempts.map((attempt) => {
                        const chip = attemptStatusChip(attempt.status);
                        return (
                          <tr
                            key={attempt._id}
                            style={{ borderTop: '1px solid var(--st-border)' }}
                          >
                            <td
                              className="px-4 py-3 font-mono text-[12px] tabular-nums"
                              style={{ color: 'var(--st-text)' }}
                            >
                              {attempt.phone}
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={chip.tone}>
                                {chip.icon}
                                {chip.label}
                              </Badge>
                            </td>
                            <td
                              className="px-4 py-3 font-mono text-[11px]"
                              style={{ color: 'var(--st-text-secondary)' }}
                            >
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
              <div
                className="mt-5 flex items-center justify-between gap-3 pt-4"
                style={{ borderTop: '1px solid var(--st-border)' }}
              >
                <span
                  className="text-[11.5px] tabular-nums"
                  style={{ color: 'var(--st-text-secondary)' }}
                >
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || isRefreshing}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages || isRefreshing}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </section>
      </div>
    </WachatPage>
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
        <span style={{ color: 'var(--st-text)' }}>{label}</span>
        <span
          className="tabular-nums"
          style={{ color: 'var(--st-text-secondary)' }}
        >
          {count.toLocaleString()} · {width}%
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--st-bg-secondary)' }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${width}%`,
            background: negative ? 'var(--st-danger)' : 'var(--st-text)',
          }}
        />
      </div>
    </div>
  );
}
