'use client';

/**
 * UsageClient — workspace-wide flow execution stats.
 *
 * Renders:
 *   - Four KPI cards (total / success rate / errors / p95 duration)
 *   - Daily run sparkline (CSS bars, no charting lib)
 *   - Top-10 flows by run count
 *   - Top-5 failing flows
 *
 * Window selector: 7 / 30 / 90 days.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LuActivity,
  LuAward,
  LuChartLine,
  LuChartNoAxesColumn,
  LuLoader,
  LuRefreshCw,
  LuTimer,
  LuTriangleAlert,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

type UsageResponse = {
  windowDays: number;
  since: string;
  summary: {
    total: number;
    success: number;
    errored: number;
    running: number;
    cancelled: number;
    successRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
  };
  daily: { date: string; count: number; errors: number }[];
  topFlows: { flowId: string; name: string; runs: number }[];
  topFailing: { flowId: string; name: string; errors: number }[];
};

const WINDOWS: Array<{ days: number; label: string }> = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export function UsageClient() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sabflow/usage?days=${days}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Failed to load usage (${res.status})`);
      const json = (await res.json()) as UsageResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-[var(--gray-4)] px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
          <LuChartLine className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            Usage
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            Workspace-wide execution stats — past {days} day{days === 1 ? '' : 's'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-[var(--gray-3)] p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                type="button"
                onClick={() => setDays(w.days)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors',
                  days === w.days
                    ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                    : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            <LuRefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading && !data ? (
          <div className="flex h-40 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Loading usage…</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <>
            <KpiCards data={data} />
            <DailyChart data={data} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TopFlowsCard data={data} />
              <TopFailingCard data={data} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ── KPI cards ───────────────────────────────────────────────────────────── */

function KpiCards({ data }: { data: UsageResponse }) {
  const { summary } = data;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi
        icon={<LuActivity className="h-3.5 w-3.5" />}
        label="Total runs"
        value={summary.total.toLocaleString()}
        accent="text-blue-600 dark:text-blue-400"
      />
      <Kpi
        icon={<LuAward className="h-3.5 w-3.5" />}
        label="Success rate"
        value={`${(summary.successRate * 100).toFixed(1)}%`}
        accent="text-emerald-600 dark:text-emerald-400"
      />
      <Kpi
        icon={<LuTriangleAlert className="h-3.5 w-3.5" />}
        label="Errors"
        value={summary.errored.toLocaleString()}
        accent="text-red-600 dark:text-red-400"
      />
      <Kpi
        icon={<LuTimer className="h-3.5 w-3.5" />}
        label="p95 duration"
        value={formatDuration(summary.p95DurationMs)}
        accent="text-amber-600 dark:text-amber-400"
      />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] px-4 py-3">
      <div className={cn('flex items-center gap-1.5 text-[11px] font-medium', accent)}>
        {icon}
        <span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--gray-12)]">
        {value}
      </div>
    </div>
  );
}

/* ── Daily sparkline ─────────────────────────────────────────────────────── */

function DailyChart({ data }: { data: UsageResponse }) {
  if (data.daily.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--gray-5)] text-[12px] text-[var(--gray-9)]">
        No runs in this window yet.
      </div>
    );
  }
  const max = Math.max(...data.daily.map((d) => d.count));
  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide mb-3">
        <LuChartNoAxesColumn className="h-3 w-3" />
        Daily runs
      </div>
      <div className="flex items-end gap-1 h-32">
        {data.daily.map((d) => {
          const heightPct = max > 0 ? Math.max(2, (d.count / max) * 100) : 2;
          const errHeightPct =
            max > 0 ? Math.max(0, (d.errors / max) * 100) : 0;
          return (
            <div
              key={d.date}
              className="flex flex-1 flex-col items-center gap-1 group"
              title={`${d.date}: ${d.count} run(s), ${d.errors} error(s)`}
            >
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t bg-blue-500/30 group-hover:bg-blue-500/60 transition-colors"
                  style={{ height: `${heightPct}%` }}
                />
                {errHeightPct > 0 && (
                  <div
                    className="absolute bottom-0 w-full rounded-t bg-red-500/60"
                    style={{ height: `${errHeightPct}%` }}
                  />
                )}
              </div>
              <span className="text-[9px] text-[var(--gray-8)] tabular-nums">
                {d.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Top flows ───────────────────────────────────────────────────────────── */

function TopFlowsCard({ data }: { data: UsageResponse }) {
  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide mb-3">
        Top flows by runs
      </div>
      {data.topFlows.length === 0 ? (
        <p className="text-[12px] text-[var(--gray-9)]">No data.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.topFlows.map((f, idx) => (
            <li key={f.flowId} className="flex items-center gap-2">
              <span className="w-5 text-[10.5px] tabular-nums text-[var(--gray-9)]">
                #{idx + 1}
              </span>
              <Link
                href={`/dashboard/sabflow/flow-builder/${f.flowId}`}
                className="flex-1 truncate text-[12px] font-medium text-[var(--gray-12)] hover:text-[#f76808]"
              >
                {f.name}
              </Link>
              <span className="tabular-nums text-[11.5px] text-[var(--gray-10)]">
                {f.runs.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TopFailingCard({ data }: { data: UsageResponse }) {
  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-3">
        Top failing flows
      </div>
      {data.topFailing.length === 0 ? (
        <p className="text-[12px] text-[var(--gray-9)]">No failures in window — nice.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.topFailing.map((f, idx) => (
            <li key={f.flowId} className="flex items-center gap-2">
              <span className="w-5 text-[10.5px] tabular-nums text-[var(--gray-9)]">
                #{idx + 1}
              </span>
              <Link
                href={`/dashboard/sabflow/flow-builder/${f.flowId}`}
                className="flex-1 truncate text-[12px] font-medium text-[var(--gray-12)] hover:text-[#f76808]"
              >
                {f.name}
              </Link>
              <Link
                href={`/dashboard/sabflow/executions?status=error`}
                className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-red-700 dark:text-red-300 hover:bg-red-500/20"
              >
                {f.errors}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}
