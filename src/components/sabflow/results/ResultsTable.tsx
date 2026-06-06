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
  completed: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]',
  active: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]',
  abandoned: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]',
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
      <td colSpan={5} className="px-4 py-3 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/50 border-b border-[var(--st-border)] dark:border-[var(--st-border)]">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[var(--st-text)] dark:text-[var(--st-text-secondary)] uppercase tracking-wide mb-2">
            Collected variables
          </p>
          {entries.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)] dark:text-[var(--st-text)] italic">No variables collected.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entries.map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 bg-white dark:bg-[var(--st-text)] border border-[var(--st-border)] dark:border-[var(--st-border)] rounded-md px-2.5 py-1 text-sm"
                >
                  <span className="font-mono text-xs text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{key}</span>
                  <span className="text-[var(--st-text-secondary)] dark:text-[var(--st-text)]">=</span>
                  <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)] max-w-[200px] truncate">{val}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-xs text-[var(--st-text-secondary)] dark:text-[var(--st-text)] space-y-0.5">
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
      <LuCalendar className="w-4 h-4 text-[var(--st-text-secondary)]" />
      <input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="text-sm border border-[var(--st-border)] dark:border-[var(--st-border)] rounded-md px-2 py-1 bg-white dark:bg-[var(--st-text)] text-[var(--st-text)] dark:text-[var(--st-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--st-border)]"
      />
      <span className="text-[var(--st-text-secondary)] text-sm">—</span>
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="text-sm border border-[var(--st-border)] dark:border-[var(--st-border)] rounded-md px-2 py-1 bg-white dark:bg-[var(--st-text)] text-[var(--st-text)] dark:text-[var(--st-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--st-border)]"
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
            className="flex items-center gap-1.5 text-sm text-[var(--st-text)] hover:text-[var(--st-text)] dark:hover:text-[var(--st-text-secondary)] transition-colors disabled:opacity-50"
          >
            <LuRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => exportToCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-sm bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white rounded-md px-3 py-1.5 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LuDownload className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--st-border)] dark:border-[var(--st-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/60 border-b border-[var(--st-border)] dark:border-[var(--st-border)]">
            <tr>
              <th className="w-8" />
              <th className="text-left px-4 py-3 font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">Session ID</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">Started</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">Status</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">Messages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--st-border)] dark:divide-[var(--st-border)]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-4 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-28 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-8 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[var(--st-text-secondary)] dark:text-[var(--st-text)]">
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
                    className="cursor-pointer hover:bg-[var(--st-bg-muted)] dark:hover:bg-[var(--st-text)]/40 transition-colors"
                  >
                    <td className="px-3 py-3 text-[var(--st-text-secondary)]">
                      {isExpanded
                        ? <LuChevronDown className="w-4 h-4" />
                        : <LuChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                      {truncateId(session.sessionId)}
                    </td>
                    <td className="px-4 py-3 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                      {fmtDate(session.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
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
        <div className="flex items-center justify-between text-sm text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
          <span>
            {total} session{total !== 1 ? 's' : ''} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 rounded hover:bg-[var(--st-bg-muted)] dark:hover:bg-[var(--st-text)] disabled:opacity-40 disabled:cursor-not-allowed"
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
                        ? 'bg-[var(--st-text)] text-white'
                        : 'hover:bg-[var(--st-bg-muted)] dark:hover:bg-[var(--st-text)]'
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded hover:bg-[var(--st-bg-muted)] dark:hover:bg-[var(--st-text)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
