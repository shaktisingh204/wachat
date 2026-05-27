'use client';

import { useState, useTransition } from 'react';
import { LuChevronDown, LuChevronRight, LuDownload, LuCalendar, LuRefreshCw } from 'react-icons/lu';
import type { FlowSession } from '@/app/actions/sabflow-results.types';
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
  completed: 'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/30 dark:text-zoru-ink-muted',
  active: 'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/30 dark:text-zoru-ink-muted',
  abandoned: 'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink dark:text-zoru-ink-muted',
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
      <td colSpan={5} className="px-4 py-3 bg-zoru-surface-2 dark:bg-zoru-ink/50 border-b border-zoru-line dark:border-zoru-line">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-zoru-ink dark:text-zoru-ink-muted uppercase tracking-wide mb-2">
            Collected variables
          </p>
          {entries.length === 0 ? (
            <p className="text-sm text-zoru-ink-muted dark:text-zoru-ink italic">No variables collected.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entries.map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 bg-white dark:bg-zoru-ink border border-zoru-line dark:border-zoru-line rounded-md px-2.5 py-1 text-sm"
                >
                  <span className="font-mono text-xs text-zoru-ink dark:text-zoru-ink-muted">{key}</span>
                  <span className="text-zoru-ink-muted dark:text-zoru-ink">=</span>
                  <span className="text-zoru-ink dark:text-zoru-ink-muted max-w-[200px] truncate">{val}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-xs text-zoru-ink-muted dark:text-zoru-ink space-y-0.5">
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
      <LuCalendar className="w-4 h-4 text-zoru-ink-muted" />
      <input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="text-sm border border-zoru-line dark:border-zoru-line rounded-md px-2 py-1 bg-white dark:bg-zoru-ink text-zoru-ink dark:text-zoru-ink-muted focus:outline-none focus:ring-2 focus:ring-zoru-line"
      />
      <span className="text-zoru-ink-muted text-sm">—</span>
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="text-sm border border-zoru-line dark:border-zoru-line rounded-md px-2 py-1 bg-white dark:bg-zoru-ink text-zoru-ink dark:text-zoru-ink-muted focus:outline-none focus:ring-2 focus:ring-zoru-line"
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
            className="flex items-center gap-1.5 text-sm text-zoru-ink hover:text-zoru-ink dark:hover:text-zoru-ink-muted transition-colors disabled:opacity-50"
          >
            <LuRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => exportToCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-sm bg-zoru-ink hover:bg-zoru-ink text-white rounded-md px-3 py-1.5 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LuDownload className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zoru-line dark:border-zoru-line overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zoru-surface-2 dark:bg-zoru-ink/60 border-b border-zoru-line dark:border-zoru-line">
            <tr>
              <th className="w-8" />
              <th className="text-left px-4 py-3 font-medium text-zoru-ink dark:text-zoru-ink-muted">Session ID</th>
              <th className="text-left px-4 py-3 font-medium text-zoru-ink dark:text-zoru-ink-muted">Started</th>
              <th className="text-left px-4 py-3 font-medium text-zoru-ink dark:text-zoru-ink-muted">Status</th>
              <th className="text-left px-4 py-3 font-medium text-zoru-ink dark:text-zoru-ink-muted">Messages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zoru-line dark:divide-zoru-line">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-4 bg-zoru-surface-2 dark:bg-zoru-ink rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-28 bg-zoru-surface-2 dark:bg-zoru-ink rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-zoru-surface-2 dark:bg-zoru-ink rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-zoru-surface-2 dark:bg-zoru-ink rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-8 bg-zoru-surface-2 dark:bg-zoru-ink rounded" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-zoru-ink-muted dark:text-zoru-ink">
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
                    className="cursor-pointer hover:bg-zoru-surface-2 dark:hover:bg-zoru-ink/40 transition-colors"
                  >
                    <td className="px-3 py-3 text-zoru-ink-muted">
                      {isExpanded
                        ? <LuChevronDown className="w-4 h-4" />
                        : <LuChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 font-mono text-zoru-ink dark:text-zoru-ink-muted">
                      {truncateId(session.sessionId)}
                    </td>
                    <td className="px-4 py-3 text-zoru-ink dark:text-zoru-ink-muted">
                      {fmtDate(session.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zoru-ink dark:text-zoru-ink-muted">
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
        <div className="flex items-center justify-between text-sm text-zoru-ink dark:text-zoru-ink-muted">
          <span>
            {total} session{total !== 1 ? 's' : ''} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 rounded hover:bg-zoru-surface-2 dark:hover:bg-zoru-ink disabled:opacity-40 disabled:cursor-not-allowed"
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
                        ? 'bg-zoru-ink text-white'
                        : 'hover:bg-zoru-surface-2 dark:hover:bg-zoru-ink'
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded hover:bg-zoru-surface-2 dark:hover:bg-zoru-ink disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
