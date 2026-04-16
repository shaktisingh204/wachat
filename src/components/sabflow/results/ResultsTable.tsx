'use client';

import { useState, useTransition } from 'react';
import { LuChevronDown, LuChevronRight, LuDownload, LuCalendar, LuRefreshCw } from 'react-icons/lu';
import type { FlowSession } from '@/app/actions/sabflow-results';

/* ── helpers ────────────────────────────────────────────── */

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function truncateId(id: string, len = 12) {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

function statusLabel(session: FlowSession): 'completed' | 'active' | 'abandoned' {
  if (session.isCompleted) return 'completed';
  const updatedMs = new Date(session.updatedAt).getTime();
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
  return updatedMs > thirtyMinAgo ? 'active' : 'abandoned';
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  abandoned: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

function exportToCsv(sessions: FlowSession[]) {
  const header = ['Session ID', 'Started At', 'Status', 'Messages', 'Last Message', 'Updated At'];
  const rows = sessions.map((s) => [
    s.sessionId,
    s.createdAt,
    statusLabel(s),
    String(s.messageCount ?? 0),
    s.lastMessage ?? '',
    s.updatedAt,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sabflow-results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Variable chat history row ──────────────────────────── */

function ExpandedRow({ session }: { session: FlowSession }) {
  const entries = Object.entries(session.variables).filter(([, v]) => v !== '');

  return (
    <tr>
      <td colSpan={5} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Collected variables
          </p>
          {entries.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">No variables collected.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entries.map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2.5 py-1 text-sm"
                >
                  <span className="font-mono text-xs text-amber-600 dark:text-amber-400">{key}</span>
                  <span className="text-zinc-400 dark:text-zinc-500">=</span>
                  <span className="text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate">{val}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-xs text-zinc-400 dark:text-zinc-500 space-y-0.5">
            <div>Session ID: <span className="font-mono">{session.sessionId}</span></div>
            <div>Last updated: {fmtDate(session.updatedAt)}</div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ── DateRangeFilter ────────────────────────────────────── */

type DateRange = { from: string; to: string };

function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <LuCalendar className="w-4 h-4 text-zinc-400" />
      <input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <span className="text-zinc-400 text-sm">—</span>
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </div>
  );
}

/* ── ResultsTable ───────────────────────────────────────── */

type Props = {
  sessions: FlowSession[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  isLoading: boolean;
};

export function ResultsTable({
  sessions,
  total,
  page,
  pageSize,
  onPageChange,
  onRefresh,
  isLoading,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' });
  const [, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filtered = dateRange.from || dateRange.to
    ? sessions.filter((s) => {
        const d = s.createdAt.slice(0, 10);
        if (dateRange.from && d < dateRange.from) return false;
        if (dateRange.to && d > dateRange.to) return false;
        return true;
      })
    : sessions;

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => startTransition(onRefresh)}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            <LuRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => exportToCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1.5 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LuDownload className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="w-8" />
              <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Session ID</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Started</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Messages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-700 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-8 bg-zinc-200 dark:bg-zinc-700 rounded" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-zinc-400 dark:text-zinc-500">
                  No sessions found.
                </td>
              </tr>
            ) : (
              filtered.flatMap((session) => {
                const status = statusLabel(session);
                const isExpanded = expandedId === session.sessionId;
                return [
                  <tr
                    key={session.sessionId}
                    onClick={() => toggleRow(session.sessionId)}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-3 py-3 text-zinc-400">
                      {isExpanded
                        ? <LuChevronDown className="w-4 h-4" />
                        : <LuChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">
                      {truncateId(session.sessionId)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {fmtDate(session.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {session.messageCount ?? 0}
                    </td>
                  </tr>,
                  ...(isExpanded ? [<ExpandedRow key={`${session.sessionId}-exp`} session={session} />] : []),
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            {total} session{total !== 1 ? 's' : ''} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
              .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-1">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => onPageChange(item as number)}
                    className={`w-7 h-7 rounded text-sm font-medium transition-colors ${
                      item === page
                        ? 'bg-amber-500 text-white'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
