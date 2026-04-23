'use client';

/**
 * Wachat Calls -- Logs tab.
 *
 * Clay-styled call logs with:
 *   - KPI tiles (total, inbound, outbound, answered, missed, avg duration)
 *   - Filters: direction, status, date range, phone search
 *   - Sortable table, CSV export, refresh
 *
 * Data: crm_call_logs collection via getCallLogs().
 */

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  LuArrowDownLeft,
  LuArrowUpRight,
  LuCheck,
  LuClock,
  LuLoader,
  LuPhone,
  LuPhoneMissed,
  LuRefreshCw,
  LuSearch,
  LuX,
  LuDownload,
} from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';

import { getCallLogs } from '@/app/actions/calling.actions';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayButton, ClayCard } from '@/components/clay';
import { cn } from '@/lib/utils';

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

function DirectionPill({ direction }: { direction?: string }) {
  const inbound = direction?.includes('USER_INITIATED') || direction?.toLowerCase() === 'inbound';
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-full',
        inbound ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600',
      )}
      aria-label={inbound ? 'Inbound' : 'Outbound'}
    >
      {inbound ? (
        <LuArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
      ) : (
        <LuArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
      )}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  const map: Record<string, { bg: string; fg: string; Icon: React.ComponentType<any>; label: string }> = {
    completed: { bg: 'bg-emerald-50', fg: 'text-emerald-700', Icon: LuCheck, label: 'Completed' },
    answered: { bg: 'bg-emerald-50', fg: 'text-emerald-700', Icon: LuCheck, label: 'Answered' },
    'no-answer': { bg: 'bg-amber-50', fg: 'text-amber-700', Icon: LuPhoneMissed, label: 'No Answer' },
    missed: { bg: 'bg-amber-50', fg: 'text-amber-700', Icon: LuPhoneMissed, label: 'Missed' },
    failed: { bg: 'bg-rose-50', fg: 'text-rose-700', Icon: LuX, label: 'Failed' },
    canceled: { bg: 'bg-rose-50', fg: 'text-rose-700', Icon: LuX, label: 'Cancelled' },
    cancelled: { bg: 'bg-rose-50', fg: 'text-rose-700', Icon: LuX, label: 'Cancelled' },
  };
  const entry = map[s] ?? { bg: 'bg-clay-bg-2', fg: 'text-clay-ink-muted', Icon: LuClock, label: status || 'Unknown' };
  const { bg, fg, Icon, label } = entry;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', bg, fg)}>
      <Icon className="h-3 w-3" strokeWidth={2} />
      {label}
    </span>
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
        typeof r.createdAt === 'string' ? r.createdAt : new Date(r.createdAt).toISOString(),
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
  const { toast } = useToast();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [isLoading, startTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [status, setStatus] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const fetchData = useCallback(
    (silent = false) => {
      if (!activeProjectId) return;
      startTransition(async () => {
        try {
          const data = await getCallLogs(activeProjectId);
          setLogs((data as unknown as CallLog[]) || []);
          if (!silent) toast({ title: 'Refreshed', description: `${data?.length ?? 0} calls loaded.` });
        } catch (err: any) {
          toast({ title: 'Error', description: err?.message || 'Failed to load call logs.', variant: 'destructive' });
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
    const to = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 : null;
    return logs.filter((l) => {
      if (direction !== 'all') {
        const inbound = (l.direction || '').includes('USER_INITIATED') || (l.direction || '').toLowerCase() === 'inbound';
        if (direction === 'inbound' && !inbound) return false;
        if (direction === 'outbound' && inbound) return false;
      }
      if (status !== 'all' && (l.status || '').toLowerCase() !== status) return false;
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
    const inbound = logs.filter((l) => (l.direction || '').includes('USER_INITIATED') || (l.direction || '').toLowerCase() === 'inbound').length;
    const outbound = total - inbound;
    const answered = logs.filter((l) => ['completed', 'answered'].includes((l.status || '').toLowerCase())).length;
    const missed = logs.filter((l) => ['no-answer', 'missed'].includes((l.status || '').toLowerCase())).length;
    const failed = logs.filter((l) => ['failed', 'canceled', 'cancelled'].includes((l.status || '').toLowerCase())).length;
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
      <ClayCard className="p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-bg-2 text-clay-ink-muted">
          <LuPhone className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold text-clay-ink">No project selected</h2>
        <p className="mx-auto mt-1.5 max-w-[360px] text-[12.5px] text-clay-ink-muted">
          Select a project from the home screen to view its call logs.
        </p>
      </ClayCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total calls" value={kpis.total.toLocaleString()} />
        <Kpi label="Inbound" value={kpis.inbound.toLocaleString()} accent="emerald" />
        <Kpi label="Outbound" value={kpis.outbound.toLocaleString()} accent="blue" />
        <Kpi label="Answered" value={kpis.answered.toLocaleString()} accent="emerald" />
        <Kpi label="Missed / failed" value={(kpis.missed + kpis.failed).toLocaleString()} accent="rose" />
        <Kpi label="Avg duration" value={formatDuration(kpis.avg)} />
      </div>

      {/* Filter bar */}
      <ClayCard padded={false} className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-clay-ink-muted" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Search by phone or Call SID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-[10px] border border-clay-border bg-clay-surface pl-9 pr-3 text-[13px] text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-border-strong focus:outline-none"
            />
          </div>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as typeof direction)}
            className="h-9 rounded-[10px] border border-clay-border bg-clay-surface px-3 text-[13px] text-clay-ink focus:border-clay-border-strong focus:outline-none"
          >
            <option value="all">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-[10px] border border-clay-border bg-clay-surface px-3 text-[13px] text-clay-ink capitalize focus:border-clay-border-strong focus:outline-none"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 rounded-[10px] border border-clay-border bg-clay-surface px-3 text-[13px] text-clay-ink focus:border-clay-border-strong focus:outline-none"
            aria-label="From date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 rounded-[10px] border border-clay-border bg-clay-surface px-3 text-[13px] text-clay-ink focus:border-clay-border-strong focus:outline-none"
            aria-label="To date"
          />
          {(search || direction !== 'all' || status !== 'all' || fromDate || toDate) && (
            <ClayButton
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
            </ClayButton>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ClayButton
              variant="pill"
              size="sm"
              leading={<LuDownload className="h-3.5 w-3.5" strokeWidth={2} />}
              onClick={() => downloadCsv(filtered)}
              disabled={filtered.length === 0}
            >
              Export CSV
            </ClayButton>
            <ClayButton
              variant="pill"
              size="sm"
              leading={isLoading ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : <LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
              onClick={() => fetchData(false)}
              disabled={isLoading}
            >
              Refresh
            </ClayButton>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-clay-border pt-3 text-[11.5px] text-clay-ink-muted">
          <span>{filtered.length}</span>
          <span>of</span>
          <span>{logs.length} calls</span>
        </div>
      </ClayCard>

      {/* Table */}
      <ClayCard padded={false} className="overflow-hidden">
        {isLoading && logs.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-bg-2 text-clay-ink-muted">
              <LuPhone className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="text-[13px] font-semibold text-clay-ink">
              {logs.length === 0 ? 'No calls yet' : 'No calls match your filters'}
            </div>
            <div className="max-w-[360px] text-[11.5px] text-clay-ink-muted">
              {logs.length === 0
                ? 'Call logs will appear here once your WhatsApp Business Calling is enabled and active.'
                : 'Try adjusting your search or clearing the filters.'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-clay-surface-2 border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <tr>
                  <th className="px-4 py-3 text-left w-10" />
                  <th className="px-4 py-3 text-left">From</th>
                  <th className="px-4 py-3 text-left">To</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Call SID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-border">
                {filtered.map((log) => (
                  <tr key={log._id} className="transition-colors hover:bg-clay-surface-2">
                    <td className="px-4 py-3">
                      <DirectionPill direction={log.direction} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-clay-ink">{log.from || '—'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-clay-ink">{log.to || '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-clay-ink">{formatDuration(log.duration)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-clay-ink-muted whitespace-nowrap">
                      {log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-clay-ink-muted">{log.callId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClayCard>
    </div>
  );
}

/* ── KPI tile ───────────────────────────────────────────────────── */

function Kpi({
  label,
  value,
  accent = 'neutral',
}: {
  label: string;
  value: string;
  accent?: 'neutral' | 'emerald' | 'blue' | 'rose';
}) {
  const tint: Record<typeof accent, string> = {
    neutral: 'text-clay-ink',
    emerald: 'text-emerald-700',
    blue: 'text-blue-700',
    rose: 'text-rose-700',
  };
  return (
    <div className="rounded-[14px] border border-clay-border bg-clay-surface p-4">
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-clay-ink-muted">{label}</div>
      <div className={cn('mt-2 text-[22px] font-semibold tracking-[-0.01em] leading-none tabular-nums', tint[accent])}>
        {value}
      </div>
    </div>
  );
}
