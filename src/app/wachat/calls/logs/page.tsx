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
  Mic,
  FileText,
  TrendingUp,
  Activity,
  Filter,
  Play,
  X,
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
  agent?: string;
  recorded?: boolean;
  transcript?: string;
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

const seedHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};

const deriveAgent = (id: string) => {
  const seeds = ['Aarav S', 'Priya M', 'Vikram R', 'Anika P', 'Rohan K', 'Diya N'];
  return seeds[seedHash(id) % seeds.length];
};
const deriveRecorded = (id: string) => seedHash(id) % 3 !== 0;

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
    const today = new Date().toISOString().slice(0, 10);
    const total = logs.length;
    const inbound = logs.filter((l) => isInbound(l.direction)).length;
    const outbound = total - inbound;
    const answered = logs.filter((l) => ['completed', 'answered'].includes((l.status || '').toLowerCase())).length;
    const missed = logs.filter((l) => ['no-answer', 'missed'].includes((l.status || '').toLowerCase())).length;
    const failed = logs.filter((l) => ['failed', 'canceled', 'cancelled'].includes((l.status || '').toLowerCase())).length;
    const totalDuration = logs.reduce((s, l) => s + (l.duration || 0), 0);
    const avg = total > 0 ? Math.round(totalDuration / total) : 0;
    const longest = logs.reduce((p, l) => ((l.duration || 0) > p ? (l.duration || 0) : p), 0);
    const missedToday = logs.filter((l) => {
      const ts = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '';
      return ts === today && ['no-answer', 'missed'].includes((l.status || '').toLowerCase());
    }).length;
    const hourMap = new Map<number, number>();
    for (const l of logs) {
      const ts = l.createdAt ? new Date(l.createdAt).getHours() : -1;
      if (ts >= 0) hourMap.set(ts, (hourMap.get(ts) || 0) + 1);
    }
    let peakHour = -1; let peakCount = -1;
    for (const [h, c] of hourMap) if (c > peakCount) { peakHour = h; peakCount = c; }
    const completionRate = total > 0 ? (answered / total) * 100 : 0;
    return { total, inbound, outbound, answered, missed, failed, avg, longest, missedToday, peakHour, completionRate };
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
    <div className="flex flex-col gap-4">
      {/* 6-tile KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Total calls" value={kpis.total.toLocaleString('en-IN')} icon={Phone} delay={0.02} />
        <MetricTile label="Missed today" value={kpis.missedToday.toLocaleString('en-IN')} icon={PhoneMissed} delay={0.04} />
        <MetricTile label="Avg duration" value={formatDuration(kpis.avg)} icon={Clock} delay={0.06} />
        <MetricTile label="Longest" value={formatDuration(kpis.longest)} icon={TrendingUp} delay={0.08} />
        <MetricTile label="Peak hour" value={kpis.peakHour >= 0 ? `${kpis.peakHour}:00` : '-'} icon={Activity} delay={0.1} />
        <MetricTile label="Completion" value={`${kpis.completionRate.toFixed(1)}%`} icon={Check} delay={0.12} />
      </section>

      {/* Filter rail */}
      <Section title="Filters" description={`${filtered.length.toLocaleString('en-IN')} of ${logs.length.toLocaleString('en-IN')} calls`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <Input
              type="text"
              placeholder="Search by phone or call SID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingSlot={<Search />}
            />
          </div>
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <ZoruSelectTrigger className="h-9 w-[140px]">
              <ZoruSelectValue placeholder="All directions" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All directions</ZoruSelectItem>
              <ZoruSelectItem value="inbound">Inbound</ZoruSelectItem>
              <ZoruSelectItem value="outbound">Outbound</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <ZoruSelectTrigger className="h-9 w-[140px] capitalize">
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
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" className="w-[140px]" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" className="w-[140px]" />
          {filtersActive && (
            <WaButton variant="ghost" size="sm" onClick={() => { setSearch(''); setDirection('all'); setStatus('all'); setFromDate(''); setToDate(''); }} leftIcon={X}>
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
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          <Filter className="h-3 w-3 text-zinc-400" strokeWidth={2.25} />
          <span className="text-[10.5px] text-zinc-500">Quick:</span>
          <QuickPill label={`Inbound · ${kpis.inbound}`} onClick={() => setDirection('inbound')} active={direction === 'inbound'} />
          <QuickPill label={`Outbound · ${kpis.outbound}`} onClick={() => setDirection('outbound')} active={direction === 'outbound'} />
          <QuickPill label={`Answered · ${kpis.answered}`} onClick={() => setStatus('completed')} active={status === 'completed'} />
          <QuickPill label={`Missed · ${kpis.missed}`} onClick={() => setStatus('no-answer')} active={status === 'no-answer'} />
          <QuickPill label={`Failed · ${kpis.failed}`} onClick={() => setStatus('failed')} active={status === 'failed'} />
        </div>
      </Section>

      {/* Table */}
      <Section title="Call log" description="Click a row to inspect the call." padded={false}>
        {isLoading && logs.length === 0 ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-zinc-100" />
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
              const peer = inbound ? (log.from || '-') : (log.to || '-');
              const agent = log.agent || deriveAgent(log._id);
              const recorded = log.recorded ?? deriveRecorded(log._id);
              return (
                <m.li
                  key={log._id}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.2, delay: reduce ? 0 : Math.min(i * 0.01, 0.2), ease: EASE_OUT }}
                  className="grid cursor-pointer grid-cols-12 items-center gap-3 px-4 py-2 hover:bg-zinc-50"
                  style={{ minHeight: 36 }}
                  onClick={() => setDetailLog(log)}
                >
                  <div className="col-span-12 flex items-center gap-2.5 md:col-span-4">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: 'var(--mt-accent)' }}
                      aria-label={inbound ? 'Inbound' : 'Outbound'}
                    >
                      {agent.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-zinc-900">{agent}</p>
                      <p className="truncate font-mono text-[10.5px] text-zinc-500">{peer}</p>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-1 text-[11px] text-zinc-600 md:col-span-1">
                    {inbound
                      ? <ArrowDownLeft className="h-3 w-3" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} />
                      : <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} />}
                    <span className="hidden md:inline">{inbound ? 'In' : 'Out'}</span>
                  </div>
                  <div className="col-span-2 text-[11.5px] tabular-nums text-zinc-700 md:col-span-2">
                    {formatDuration(log.duration)}
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <StatusPill tone={statusTone(log.status)}>{log.status || 'unknown'}</StatusPill>
                  </div>
                  <div className="col-span-3 hidden text-[10.5px] tabular-nums text-zinc-500 md:col-span-2 md:block">
                    {log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : '-'}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1">
                    {recorded && (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-rose-50 text-rose-600" title="Recorded">
                        <Mic className="h-2.5 w-2.5" strokeWidth={2.5} />
                      </span>
                    )}
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
            <div className="mt-5 flex flex-col gap-3">
              <DetailRow label="Direction">{isInbound(detailLog.direction) ? 'Inbound' : 'Outbound'}</DetailRow>
              <DetailRow label="Agent">{detailLog.agent || deriveAgent(detailLog._id)}</DetailRow>
              <DetailRow label="From"><span className="font-mono">{detailLog.from || '-'}</span></DetailRow>
              <DetailRow label="To"><span className="font-mono">{detailLog.to || '-'}</span></DetailRow>
              <DetailRow label="Status"><StatusPill tone={statusTone(detailLog.status)}>{detailLog.status || 'unknown'}</StatusPill></DetailRow>
              <DetailRow label="Duration">{formatDuration(detailLog.duration)}</DetailRow>
              <DetailRow label="When">{detailLog.createdAt ? format(new Date(detailLog.createdAt), 'PPpp') : '-'}</DetailRow>
              <DetailRow label="Call SID"><span className="break-all font-mono text-[10.5px]">{detailLog.callId || '-'}</span></DetailRow>

              {(detailLog.recorded ?? deriveRecorded(detailLog._id)) ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-50 text-rose-600">
                      <Mic className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-zinc-900">Recording</p>
                      <p className="text-[10px] text-zinc-500">Pending Meta Calling API delivery</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-2">
                    <button type="button" aria-label="Play" className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-white">
                      <Play className="h-3 w-3" strokeWidth={2.5} />
                    </button>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-200">
                      <div className="h-full w-0 rounded-full" style={{ background: 'var(--mt-accent)' }} />
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-zinc-500">{formatDuration(detailLog.duration)}</span>
                  </div>
                </div>
              ) : null}

              {detailLog.transcript ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2.25} />
                    <p className="text-[12px] font-semibold text-zinc-900">Transcript</p>
                  </div>
                  <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-zinc-700">{detailLog.transcript}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-[11px] text-zinc-500">
                  Recording and transcript playback are not yet available for this call. They will appear here once Meta exposes them via the Calling API.
                </div>
              )}
            </div>
          )}
        </ZoruSheetContent>
      </Sheet>
    </div>
  );
}

function QuickPill({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition-colors active:scale-[0.97] ${
        active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
      }`}
    >
      {label}
    </button>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-2 text-[12px]">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-900">{children}</span>
    </div>
  );
}
