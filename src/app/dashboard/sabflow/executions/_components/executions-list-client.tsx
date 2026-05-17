'use client';

/**
 * ExecutionsListClient
 *
 * Lists recent flow executions with status badges, duration, trigger mode,
 * and a click-through to the replay view.  Includes filter chips (status,
 * trigger mode) and a free-text search across flow name + session id.
 *
 * Reads from GET /api/sabflow/executions — already returns a JSON list of
 * `ExecutionHistoryDoc` rows for the caller's project.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LuActivity,
  LuArrowRight,
  LuClock,
  LuFilter,
  LuLoader,
  LuRefreshCw,
  LuSearch,
  LuTriangleAlert,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type {
  ExecutionStatus,
  ExecutionTriggerMode,
} from '@/lib/sabflow/types';

type ExecutionRow = {
  _id: string;
  flowId: string;
  flowName?: string;
  sessionId?: string;
  triggerMode?: ExecutionTriggerMode;
  status: ExecutionStatus;
  startedAt?: string;
  finishedAt?: string;
  executionTimeMs?: number;
  error?: string;
  nodeCount?: number;
};

const STATUS_STYLES: Record<ExecutionStatus, string> = {
  running:   'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  success:   'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300',
  error:     'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  cancelled: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300',
};

const TRIGGER_LABELS: Record<ExecutionTriggerMode, string> = {
  manual:   'Manual',
  schedule: 'Schedule',
  webhook:  'Webhook',
  start:    'Start',
  test:     'Test',
};

const STATUS_FILTERS: Array<{ value: ExecutionStatus | 'all'; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'success',   label: 'Success' },
  { value: 'error',     label: 'Errored' },
  { value: 'running',   label: 'Running' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ExecutionsListClient() {
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<ExecutionStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/sabflow/executions?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Failed to load executions (${res.status})`);
      }
      const json = (await res.json()) as { executions: ExecutionRow[] };
      setExecutions(json.executions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return executions;
    const needle = search.toLowerCase();
    return executions.filter(
      (e) =>
        (e.flowName ?? '').toLowerCase().includes(needle) ||
        (e.sessionId ?? '').toLowerCase().includes(needle) ||
        e._id.toLowerCase().includes(needle),
    );
  }, [executions, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--gray-4)] px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
          <LuActivity className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            Executions
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            Past flow runs with per-node detail
          </p>
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            <LuRefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--gray-4)] px-6 py-2.5 shrink-0">
        <div className="relative flex items-center">
          <LuSearch className="absolute left-2.5 h-3.5 w-3.5 text-[var(--gray-8)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by flow, session, or id…"
            className="w-[260px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] py-1.5 pl-8 pr-2.5 text-[12.5px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808]"
          />
        </div>
        <div className="flex items-center gap-1 text-[10.5px] text-[var(--gray-9)] ml-auto">
          <LuFilter className="h-3 w-3" strokeWidth={2} />
          Filter:
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-[var(--gray-3)] p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                  : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && executions.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Loading executions…</span>
          </div>
        ) : error ? (
          <div className="m-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
              <LuActivity className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] text-[var(--gray-11)] font-medium">
              {search || statusFilter !== 'all'
                ? 'No executions match'
                : 'No executions yet'}
            </p>
            <p className="text-[11.5px] text-[var(--gray-9)]">
              {search || statusFilter !== 'all'
                ? 'Try a different filter.'
                : 'Run a flow to see its history here.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="border-b border-[var(--gray-4)] text-left">
              <tr className="text-[10.5px] uppercase tracking-wide text-[var(--gray-9)]">
                <th className="px-6 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Flow</th>
                <th className="px-3 py-2 font-semibold">Trigger</th>
                <th className="px-3 py-2 font-semibold">Started</th>
                <th className="px-3 py-2 font-semibold">Duration</th>
                <th className="px-3 py-2 font-semibold">Nodes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row._id}
                  className="border-b border-[var(--gray-3)] hover:bg-[var(--gray-2)]"
                >
                  <td className="px-6 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
                        STATUS_STYLES[row.status] ?? STATUS_STYLES.cancelled,
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-[var(--gray-12)]">
                      {row.flowName ?? '—'}
                    </span>
                    {row.error && (
                      <p
                        className="mt-0.5 truncate text-[11px] text-red-600 max-w-[280px]"
                        title={row.error}
                      >
                        {row.error}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--gray-10)]">
                    {row.triggerMode ? TRIGGER_LABELS[row.triggerMode] : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--gray-10)]">
                    {row.startedAt ? formatTime(row.startedAt) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--gray-10)] tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <LuClock className="h-3 w-3" />
                      {formatDuration(row.executionTimeMs)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--gray-10)] tabular-nums">
                    {row.nodeCount ?? 0}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/dashboard/sabflow/executions/${row._id}`}
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#f76808] hover:text-[#e25c00]"
                    >
                      View <LuArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}
