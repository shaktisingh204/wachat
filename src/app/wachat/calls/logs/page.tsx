'use client';

import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Input,
  Select,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  Skeleton,
  StatCard,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock,
  Phone,
  PhoneMissed,
  RefreshCw,
  Search,
  X,
  Download,
  } from 'lucide-react';
import { formatDistanceToNow,
  format } from 'date-fns';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { getCallLogs } from '@/app/actions/calling.actions';
import { useProject } from '@/context/project-context';

/**
 * Wachat Calls — Logs tab (20ui).
 *
 * KPI tiles, filters, sortable table, CSV export, refresh.
 * Per-call detail drawer for transcript / recording metadata.
 *
 * Data: crm_call_logs collection via getCallLogs().
 */

import * as React from 'react';

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
      className="inline-flex h-7 w-7 items-center justify-center rounded-full [background:var(--st-bg-secondary)] [color:var(--st-text)]"
      aria-label={inbound ? 'Inbound' : 'Outbound'}
    >
      {inbound ? (
        <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  type Tone = 'success' | 'warning' | 'danger' | 'neutral';
  const map: Record<
    string,
    { tone: Tone; Icon: React.ComponentType<{ className?: string }>; label: string }
  > = {
    completed: { tone: 'success', Icon: Check, label: 'Completed' },
    answered: { tone: 'success', Icon: Check, label: 'Answered' },
    'no-answer': { tone: 'warning', Icon: PhoneMissed, label: 'No Answer' },
    missed: { tone: 'warning', Icon: PhoneMissed, label: 'Missed' },
    failed: { tone: 'danger', Icon: X, label: 'Failed' },
    canceled: { tone: 'danger', Icon: X, label: 'Cancelled' },
    cancelled: { tone: 'danger', Icon: X, label: 'Cancelled' },
  };
  const entry =
    map[s] ?? { tone: 'neutral' as Tone, Icon: Clock, label: status || 'Unknown' };
  const { tone, Icon, label } = entry;
  return (
    <Badge tone={tone} className="capitalize">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
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

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Calls', href: '/wachat/calls' },
  { label: 'Logs' },
];

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
          toast({ title: 'Error', description: message, tone: 'danger' });
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

  const directionOptions = useMemo(
    () => [
      { value: 'all', label: 'All directions' },
      { value: 'inbound', label: 'Inbound' },
      { value: 'outbound', label: 'Outbound' },
    ],
    [],
  );

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.status && set.add(l.status.toLowerCase()));
    return [
      { value: 'all', label: 'All statuses' },
      ...Array.from(set).map((s) => ({ value: s, label: s })),
    ];
  }, [logs]);

  if (!activeProjectId) {
    return (
      <WachatPage
        breadcrumb={BREADCRUMB}
        title="Call logs"
        description="Inbound and outbound WhatsApp Business calls."
        width="wide"
      >
        <EmptyState
          icon={Phone}
          title="No project selected"
          description="Select a project from the home screen to view its call logs."
        />
      </WachatPage>
    );
  }

  const filtersActive =
    search || direction !== 'all' || status !== 'all' || fromDate || toDate;

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      title="Call logs"
      description="Inbound and outbound WhatsApp Business calls."
      width="wide"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            iconLeft={Download}
            onClick={() => downloadCsv(filtered)}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            loading={isLoading}
            onClick={() => fetchData(false)}
          >
            Refresh
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total calls" value={kpis.total.toLocaleString()} />
          <StatCard label="Inbound" value={kpis.inbound.toLocaleString()} />
          <StatCard label="Outbound" value={kpis.outbound.toLocaleString()} />
          <StatCard label="Answered" value={kpis.answered.toLocaleString()} />
          <StatCard
            label="Missed / failed"
            value={(kpis.missed + kpis.failed).toLocaleString()}
          />
          <StatCard label="Avg duration" value={formatDuration(kpis.avg)} />
        </div>

        {/* Filter bar */}
        <Card padding="md">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1">
              <Input
                type="text"
                placeholder="Search by phone or Call SID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                iconLeft={Search}
                aria-label="Search calls"
              />
            </div>
            <Select
              value={direction}
              onChange={(v) => setDirection((v ?? 'all') as typeof direction)}
              options={directionOptions}
              placeholder="All directions"
              aria-label="Filter by direction"
              className="w-[160px]"
            />
            <Select
              value={status}
              onChange={(v) => setStatus(v ?? 'all')}
              options={statusOptions}
              placeholder="All statuses"
              aria-label="Filter by status"
              className="w-[160px] capitalize"
            />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              className="w-[150px]"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              className="w-[150px]"
            />
            {filtersActive ? (
              <Button
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
              </Button>
            ) : null}
          </div>
          <div
            className="mt-3 flex items-center gap-2 border-t pt-3 text-[11.5px] [border-color:var(--st-border)] [color:var(--st-text-tertiary)]"
          >
            <span>{filtered.length}</span>
            <span>of</span>
            <span>{logs.length} calls</span>
          </div>
        </Card>

        {/* Table */}
        <Card padding="none" className="overflow-hidden">
          {isLoading && logs.length === 0 ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Phone}
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
              <Table hover>
                <THead>
                  <Tr>
                    <Th width={40} aria-label="Direction" />
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Duration</Th>
                    <Th>Status</Th>
                    <Th>When</Th>
                    <Th>Call SID</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((log) => (
                    <Tr
                      key={log._id}
                      className="cursor-pointer"
                      onClick={() => setDetailLog(log)}
                    >
                      <Td>
                        <DirectionPill direction={log.direction} />
                      </Td>
                      <Td className="font-mono text-[12px] [color:var(--st-text)]">
                        {log.from || '—'}
                      </Td>
                      <Td className="font-mono text-[12px] [color:var(--st-text)]">
                        {log.to || '—'}
                      </Td>
                      <Td className="tabular-nums [color:var(--st-text)]">
                        {formatDuration(log.duration)}
                      </Td>
                      <Td>
                        <StatusBadge status={log.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-[12px] [color:var(--st-text-secondary)]">
                        {log.createdAt
                          ? formatDistanceToNow(new Date(log.createdAt), {
                              addSuffix: true,
                            })
                          : '—'}
                      </Td>
                      <Td className="font-mono text-[11px] [color:var(--st-text-secondary)]">
                        {log.callId || '—'}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Per-call detail drawer (transcript / recording metadata) */}
      <Drawer
        open={detailLog !== null}
        onOpenChange={(open) => {
          if (!open) setDetailLog(null);
        }}
      >
        <DrawerContent side="right">
          <DrawerHeader>
            <DrawerTitle>Call detail</DrawerTitle>
            <DrawerDescription>
              Transcript and recording metadata for this call.
            </DrawerDescription>
          </DrawerHeader>
          {detailLog ? (
            <div className="flex flex-col gap-4 px-4 pb-4">
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
              <Callout tone="neutral">
                Recording and transcript playback are not yet available for this
                call. They will appear here once Meta exposes them via the
                Calling API.
              </Callout>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </WachatPage>
  );
}

/* ── detail row ─────────────────────────────────────────────────── */

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-3 text-[13px] [border-color:var(--st-border)]">
      <span className="[color:var(--st-text-secondary)]">{label}</span>
      <span className="text-right [color:var(--st-text)]">{children}</span>
    </div>
  );
}
