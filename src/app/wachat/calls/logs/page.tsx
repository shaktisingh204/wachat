'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { m, useReducedMotion } from 'motion/react';
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
  Download,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

import { getCallLogs } from '@/app/actions/calling.actions';
import { useProject } from '@/context/project-context';
import {
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  useZoruToast,
} from '@/components/zoruui';
import {
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

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

const isInbound = (direction?: string) =>
  (direction || '').includes('USER_INITIATED') || (direction || '').toLowerCase() === 'inbound';

const statusTone = (s?: string): StatusTone => {
  const v = (s ?? '').toLowerCase();
  if (v === 'completed' || v === 'answered') return 'live';
  if (v === 'no-answer' || v === 'missed') return 'queued';
  if (v === 'failed' || v === 'canceled' || v === 'cancelled') return 'failed';
  return 'draft';
};

const formatDuration = (seconds: number | null | undefined) => {
  const v = typeof seconds === 'number' ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(v / 60);
  const s = v % 60;
  return minutes === 0 ? `${s}s` : `${minutes}m ${s}s`;
};

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
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
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
  const reduce = useReducedMotion();
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
          if (!silent) toast({ title: 'Refreshed', description: `${data?.length ?? 0} calls loaded.` });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to load call logs.';
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 : null;
    return logs.filter((l) => {
      if (direction !== 'all') {
        const inbound = isInbound(l.direction);
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

  const kpis = useMemo(() => {
    const total = logs.length;
    const inbound = logs.filter((l) => isInbound(l.direction)).length;
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
      <EmptyState
        icon={Phone}
        title="No project selected"
        description="Pick a project from the home screen to view its call logs."
      />
    );
  }

  const filtersActive = search || direction !== 'all' || status !== 'all' || fromDate || toDate;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricTile label="Total calls" value={kpis.total.toLocaleString('en-IN')} delay={0.02} />
        <MetricTile label="Inbound" value={kpis.inbound.toLocaleString('en-IN')} icon={ArrowDownLeft} delay={0.04} />
        <MetricTile label="Outbound" value={kpis.outbound.toLocaleString('en-IN')} icon={ArrowUpRight} delay={0.06} />
        <MetricTile label="Answered" value={kpis.answered.toLocaleString('en-IN')} icon={Check} delay={0.08} />
        <MetricTile label="Missed / failed" value={(kpis.missed + kpis.failed).toLocaleString('en-IN')} icon={PhoneMissed} delay={0.1} />
        <MetricTile label="Avg duration" value={formatDuration(kpis.avg)} icon={Clock} delay={0.12} />
      </section>

      {/* Filter bar */}
      <Section title="Filters" description={`${filtered.length.toLocaleString('en-IN')} of ${logs.length.toLocaleString('en-IN')} calls`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <Input
              type="text"
              placeholder="Search by phone or call SID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingSlot={<Search />}
            />
          </div>
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <ZoruSelectTrigger className="h-9 w-[160px]">
              <ZoruSelectValue placeholder="All directions" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All directions</ZoruSelectItem>
              <ZoruSelectItem value="inbound">Inbound</ZoruSelectItem>
              <ZoruSelectItem value="outbound">Outbound</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
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
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" className="w-[150px]" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" className="w-[150px]" />
          {filtersActive && (
            <WaButton variant="ghost" size="sm" onClick={() => { setSearch(''); setDirection('all'); setStatus('all'); setFromDate(''); setToDate(''); }}>
              Clear
            </WaButton>
          )}
          <div className="ml-auto flex items-center gap-2">
            <WaButton variant="outline" size="sm" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0} leftIcon={Download}>
              Export
            </WaButton>
            <WaButton variant="outline" size="sm" onClick={() => fetchData(false)} disabled={isLoading} leftIcon={isLoading ? Loader2 : RefreshCw}>
              Refresh
            </WaButton>
          </div>
        </div>
      </Section>

      {/* Table */}
      <Section title="Call log" description="Click a row to inspect the call." padded={false}>
        {isLoading && logs.length === 0 ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-zinc-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Phone}
              title={logs.length === 0 ? 'No calls yet' : 'No calls match your filters'}
              description={
                logs.length === 0
                  ? 'Call logs appear here once WhatsApp Business calling is enabled.'
                  : 'Try adjusting your search or clearing the filters.'
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {filtered.map((log, i) => {
              const inbound = isInbound(log.direction);
              return (
                <m.li
                  key={log._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : Math.min(i * 0.02, 0.25), ease: EASE_OUT }}
                  className="cursor-pointer transition-colors duration-150 hover:bg-zinc-50"
                  onClick={() => setDetailLog(log)}
                >
                  <div className="flex flex-wrap items-center gap-4 px-5 py-3">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-full"
                      style={{ background: 'var(--mt-accent-soft)' }}
                      aria-label={inbound ? 'Inbound' : 'Outbound'}
                    >
                      {inbound
                        ? <ArrowDownLeft className="h-4 w-4" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                        : <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[13px] font-semibold text-zinc-900">
                        {inbound ? (log.from || '-') : (log.to || '-')}
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-zinc-500">
                        {inbound ? `from · ${log.from || '-'}` : `to · ${log.to || '-'}`}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-[13px] font-semibold tabular-nums text-zinc-900">{formatDuration(log.duration)}</p>
                      <p className="text-[10.5px] text-zinc-500">{log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : '-'}</p>
                    </div>
                    <StatusPill tone={statusTone(log.status)}>{log.status || 'unknown'}</StatusPill>
                  </div>
                </m.li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Detail sheet */}
      <Sheet open={detailLog !== null} onOpenChange={(open) => { if (!open) setDetailLog(null); }}>
        <ZoruSheetContent side="right" className="w-full max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Call detail</ZoruSheetTitle>
            <ZoruSheetDescription>Transcript and recording metadata for this call.</ZoruSheetDescription>
          </ZoruSheetHeader>
          {detailLog && (
            <div className="mt-6 flex flex-col gap-4">
              <DetailRow label="Direction">{isInbound(detailLog.direction) ? 'Inbound' : 'Outbound'}</DetailRow>
              <DetailRow label="From"><span className="font-mono">{detailLog.from || '-'}</span></DetailRow>
              <DetailRow label="To"><span className="font-mono">{detailLog.to || '-'}</span></DetailRow>
              <DetailRow label="Status"><StatusPill tone={statusTone(detailLog.status)}>{detailLog.status || 'unknown'}</StatusPill></DetailRow>
              <DetailRow label="Duration">{formatDuration(detailLog.duration)}</DetailRow>
              <DetailRow label="When">{detailLog.createdAt ? format(new Date(detailLog.createdAt), 'PPpp') : '-'}</DetailRow>
              <DetailRow label="Call SID"><span className="break-all font-mono">{detailLog.callId || '-'}</span></DetailRow>
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-[12px] text-zinc-500">
                Recording and transcript playback are not yet available for this call. They will appear here once Meta exposes them via the Calling API.
              </div>
            </div>
          )}
        </ZoruSheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3 text-[13px]">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-900">{children}</span>
    </div>
  );
}
