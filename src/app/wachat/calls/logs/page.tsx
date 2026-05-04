'use client';

/**
 * Wachat Calls — Logs tab (ZoruUI).
 *
 * KPI tiles, filters, sortable table, CSV export, refresh.
 * Per-call detail sheet for transcript / recording metadata.
 *
 * Data: crm_call_logs collection via getCallLogs().
 */

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock,
  Loader2,
  Phone,
  PhoneMissed,
  RefreshCw,
  Search,
  X,
  Download,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

import { getCallLogs } from '@/app/actions/calling.actions';
import { useProject } from '@/context/project-context';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSkeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';

type CallLog = {
  _id: string;
  from?: string;
  to?: string;
  direction?: string;
  status?: string;
  duration?: number;
  callId?: string;
  createdAt: string | Date;
};

function isInbound(direction?: string) {
  return (
    (direction || '').includes('USER_INITIATED') ||
    (direction || '').toLowerCase() === 'inbound'
  );
}

function DirectionPill({ direction }: { direction?: string }) {
  const inbound = isInbound(direction);
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink"
      aria-label={inbound ? 'Inbound' : 'Outbound'}
    >
      {inbound ? (
        <ArrowDownLeft className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpRight className="h-3.5 w-3.5" />
      )}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  type Variant = 'success' | 'warning' | 'danger' | 'ghost';
  const map: Record<
    string,
    { variant: Variant; Icon: React.ComponentType<{ className?: string }>; label: string }
  > = {
    completed: { variant: 'success', Icon: Check, label: 'Completed' },
    answered: { variant: 'success', Icon: Check, label: 'Answered' },
    'no-answer': { variant: 'warning', Icon: PhoneMissed, label: 'No Answer' },
    missed: { variant: 'warning', Icon: PhoneMissed, label: 'Missed' },
    failed: { variant: 'danger', Icon: X, label: 'Failed' },
    canceled: { variant: 'danger', Icon: X, label: 'Cancelled' },
    cancelled: { variant: 'danger', Icon: X, label: 'Cancelled' },
  };
  const entry =
    map[s] ?? { variant: 'ghost' as Variant, Icon: Clock, label: status || 'Unknown' };
  const { variant, Icon, label } = entry;
  return (
    <ZoruBadge variant={variant} className="capitalize">
      <Icon className="h-3 w-3" />
      {label}
    </ZoruBadge>
  );
}

function formatDuration(seconds: number | null | undefined) {
  const v = typeof seconds === 'number' ? Math.max(0, seconds) : 0;
  const m = Math.floor(v / 60);
  const s = v % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function downloadCsv(rows: CallLog[]) {
  if (rows.length === 0) return;
  const header = 'from,to,direction,status,duration_seconds,call_id,created_at\n';
  const body = rows
    .map((r) =>
      [
        r.from ?? '',
        r.to ?? '',
        r.direction ?? '',
        r.status ?? '',
        r.duration ?? 0,
        r.callId ?? '',
        typeof r.createdAt === 'string'
          ? r.createdAt
          : new Date(r.createdAt).toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `call-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CallLogsPage() {
  const { activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [isLoading, startTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [status, setStatus] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [detailLog, setDetailLog] = useState<CallLog | null>(null);

  const fetchData = useCallback(
    (silent = false) => {
      if (!activeProjectId) return;
      startTransition(async () => {
        try {
          const data = await getCallLogs(activeProjectId);
          setLogs((data as unknown as CallLog[]) || []);
          if (!silent)
            toast({
              title: 'Refreshed',
              description: `${data?.length ?? 0} calls loaded.`,
            });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Failed to load call logs.';
          toast({ title: 'Error', description: message, variant: 'destructive' });
        }
      });
    },
    [activeProjectId, toast],
  );

  useEffect(() => {
    if (activeProjectId) fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  /* ── filters ─────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate
      ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000
      : null;
    return logs.filter((l) => {
      if (direction !== 'all') {
        const inbound = isInbound(l.direction);
        if (direction === 'inbound' && !inbound) return false;
        if (direction === 'outbound' && inbound) return false;
      }
      if (status !== 'all' && (l.status || '').toLowerCase() !== status)
        return false;
      if (q) {
        const hay = `${l.from || ''} ${l.to || ''} ${l.callId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (from || to) {
        const ts = l.createdAt ? new Date(l.createdAt).getTime() : 0;
        if (from && ts < from) return false;
        if (to && ts > to) return false;
      }
      return true;
    });
  }, [logs, search, direction, status, fromDate, toDate]);

  /* ── KPIs derived from ALL logs (not filtered) ─────────── */
  const kpis = useMemo(() => {
    const total = logs.length;
    const inbound = logs.filter((l) => isInbound(l.direction)).length;
    const outbound = total - inbound;
    const answered = logs.filter((l) =>
      ['completed', 'answered'].includes((l.status || '').toLowerCase()),
    ).length;
    const missed = logs.filter((l) =>
      ['no-answer', 'missed'].includes((l.status || '').toLowerCase()),
    ).length;
    const failed = logs.filter((l) =>
      ['failed', 'canceled', 'cancelled'].includes((l.status || '').toLowerCase()),
    ).length;
    const totalDuration = logs.reduce((s, l) => s + (l.duration || 0), 0);
    const avg = total > 0 ? Math.round(totalDuration / total) : 0;
    return { total, inbound, outbound, answered, missed, failed, avg };
  }, [logs]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.status && set.add(l.status.toLowerCase()));
    return ['all', ...Array.from(set)];
  }, [logs]);

  if (!activeProjectId) {
    return (
      <ZoruEmptyState
        icon={<Phone />}
        title="No project selected"
        description="Select a project from the home screen to view its call logs."
      />
    );
  }

  const filtersActive =
    search || direction !== 'all' || status !== 'all' || fromDate || toDate;

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total calls" value={kpis.total.toLocaleString()} />
        <Kpi label="Inbound" value={kpis.inbound.toLocaleString()} />
        <Kpi label="Outbound" value={kpis.outbound.toLocaleString()} />
        <Kpi label="Answered" value={kpis.answered.toLocaleString()} />
        <Kpi
          label="Missed / failed"
          value={(kpis.missed + kpis.failed).toLocaleString()}
        />
        <Kpi label="Avg duration" value={formatDuration(kpis.avg)} />
      </div>

      {/* Filter bar */}
      <ZoruCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <ZoruInput
              type="text"
              placeholder="Search by phone or Call SID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingSlot={<Search />}
            />
          </div>
          <ZoruSelect
            value={direction}
            onValueChange={(v) => setDirection(v as typeof direction)}
          >
            <ZoruSelectTrigger className="h-9 w-[160px]">
              <ZoruSelectValue placeholder="All directions" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All directions</ZoruSelectItem>
              <ZoruSelectItem value="inbound">Inbound</ZoruSelectItem>
              <ZoruSelectItem value="outbound">Outbound</ZoruSelectItem>
            </ZoruSelectContent>
          </ZoruSelect>
          <ZoruSelect value={status} onValueChange={setStatus}>
            <ZoruSelectTrigger className="h-9 w-[160px] capitalize">
              <ZoruSelectValue placeholder="All statuses" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {statusOptions.map((s) => (
                <ZoruSelectItem key={s} value={s} className="capitalize">
                  {s === 'all' ? 'All statuses' : s}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
          <ZoruInput
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            className="w-[150px]"
          />
          <ZoruInput
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
            className="w-[150px]"
          />
          {filtersActive ? (
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setDirection('all');
                setStatus('all');
                setFromDate('');
                setToDate('');
              }}
            >
              Clear
            </ZoruButton>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(filtered)}
              disabled={filtered.length === 0}
            >
              <Download /> Export CSV
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => fetchData(false)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Refresh
            </ZoruButton>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-zoru-line pt-3 text-[11.5px] text-zoru-ink-muted">
          <span>{filtered.length}</span>
          <span>of</span>
          <span>{logs.length} calls</span>
        </div>
      </ZoruCard>

      {/* Table */}
      <ZoruCard className="overflow-hidden p-0">
        {isLoading && logs.length === 0 ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ZoruSkeleton key={i} className="h-10" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <ZoruEmptyState
            icon={<Phone />}
            className="border-0"
            title={
              logs.length === 0 ? 'No calls yet' : 'No calls match your filters'
            }
            description={
              logs.length === 0
                ? 'Call logs will appear here once your WhatsApp Business Calling is enabled and active.'
                : 'Try adjusting your search or clearing the filters.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-zoru-line bg-zoru-surface text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                <tr>
                  <th className="w-10 px-4 py-3 text-left" />
                  <th className="px-4 py-3 text-left">From</th>
                  <th className="px-4 py-3 text-left">To</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Call SID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zoru-line">
                {filtered.map((log) => (
                  <tr
                    key={log._id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-zoru-surface',
                    )}
                    onClick={() => setDetailLog(log)}
                  >
                    <td className="px-4 py-3">
                      <DirectionPill direction={log.direction} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink">
                      {log.from || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink">
                      {log.to || '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zoru-ink">
                      {formatDuration(log.duration)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-zoru-ink-muted">
                      {log.createdAt
                        ? formatDistanceToNow(new Date(log.createdAt), {
                            addSuffix: true,
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zoru-ink-muted">
                      {log.callId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ZoruCard>

      {/* Per-call detail sheet (transcript / recording metadata) */}
      <ZoruSheet
        open={detailLog !== null}
        onOpenChange={(open) => {
          if (!open) setDetailLog(null);
        }}
      >
        <ZoruSheetContent side="right" className="w-full max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Call detail</ZoruSheetTitle>
            <ZoruSheetDescription>
              Transcript and recording metadata for this call.
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {detailLog ? (
            <div className="mt-6 flex flex-col gap-4">
              <DetailRow label="Direction">
                {isInbound(detailLog.direction) ? 'Inbound' : 'Outbound'}
              </DetailRow>
              <DetailRow label="From">
                <span className="font-mono">{detailLog.from || '—'}</span>
              </DetailRow>
              <DetailRow label="To">
                <span className="font-mono">{detailLog.to || '—'}</span>
              </DetailRow>
              <DetailRow label="Status">
                <StatusBadge status={detailLog.status} />
              </DetailRow>
              <DetailRow label="Duration">
                {formatDuration(detailLog.duration)}
              </DetailRow>
              <DetailRow label="When">
                {detailLog.createdAt
                  ? format(
                      new Date(detailLog.createdAt),
                      'PPpp',
                    )
                  : '—'}
              </DetailRow>
              <DetailRow label="Call SID">
                <span className="font-mono break-all">
                  {detailLog.callId || '—'}
                </span>
              </DetailRow>
              <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface p-4 text-[12px] text-zoru-ink-muted">
                Recording and transcript playback are not yet available for this
                call. They will appear here once Meta exposes them via the
                Calling API.
              </div>
            </div>
          ) : null}
        </ZoruSheetContent>
      </ZoruSheet>
    </div>
  );
}

/* ── KPI tile ───────────────────────────────────────────────────── */

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4">
      <div className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-2 text-[22px] tracking-[-0.01em] leading-none tabular-nums text-zoru-ink">
        {value}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zoru-line pb-3 text-[13px]">
      <span className="text-zoru-ink-muted">{label}</span>
      <span className="text-right text-zoru-ink">{children}</span>
    </div>
  );
}
