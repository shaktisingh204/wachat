'use client';

/**
 * AuditClient
 *
 * Renders the SabFlow audit-log table for the current workspace.
 *
 *   • Filterable by action, date range (last 24h / 7d / 30d / all),
 *     and free-text search across `target` + JSON-stringified metadata.
 *   • Action chips are colour-coded by family:
 *       flow.*       → blue
 *       credential.* → amber
 *       apiKey.*     → violet
 *       env.*        → emerald
 *       folder.*     → pink
 *   • Pagination: "Load more" appends the next 50 rows.
 *
 * Reads from GET /api/sabflow/audit — auth-gated, scoped to the
 * caller's workspace.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  LuArrowRight,
  LuChevronDown,
  LuChevronRight,
  LuFilter,
  LuHistory,
  LuLoader,
  LuRefreshCw,
  LuSearch,
  LuTriangleAlert,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────────
   Types & constants
   ────────────────────────────────────────────────────────────────────────── */

interface AuditRow {
  _id: string;
  userId: string;
  workspaceId?: string;
  flowId?: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

type DateRange = 'all' | '24h' | '7d' | '30d';

const PAGE_SIZE = 50;

const ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all',                 label: 'All actions' },
  { value: 'flow.created',        label: 'Flow created' },
  { value: 'flow.updated',        label: 'Flow updated' },
  { value: 'flow.deleted',        label: 'Flow deleted' },
  { value: 'flow.published',      label: 'Flow published' },
  { value: 'flow.archived',       label: 'Flow archived' },
  { value: 'credential.created',  label: 'Credential created' },
  { value: 'credential.deleted',  label: 'Credential deleted' },
  { value: 'apiKey.created',      label: 'API key created' },
  { value: 'apiKey.revoked',      label: 'API key revoked' },
  { value: 'env.upserted',        label: 'Env upserted' },
  { value: 'env.deleted',         label: 'Env deleted' },
  { value: 'folder.created',      label: 'Folder created' },
  { value: 'folder.renamed',      label: 'Folder renamed' },
  { value: 'folder.deleted',      label: 'Folder deleted' },
];

const DATE_FILTERS: Array<{ value: DateRange; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: 'Last 24h' },
  { value: '7d',  label: 'Last 7d' },
  { value: '30d', label: 'Last 30d' },
];

/** Tailwind classes for the family-coloured action chip. */
function actionChipClasses(action: string): string {
  if (action.startsWith('flow.')) {
    return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/50 dark:text-[var(--st-text-secondary)]';
  }
  if (action.startsWith('credential.')) {
    return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/50 dark:text-[var(--st-text-secondary)]';
  }
  if (action.startsWith('apiKey.')) {
    return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/50 dark:text-[var(--st-text-secondary)]';
  }
  if (action.startsWith('env.')) {
    return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/50 dark:text-[var(--st-text-secondary)]';
  }
  if (action.startsWith('folder.')) {
    return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/50 dark:text-[var(--st-text-secondary)]';
  }
  return 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/50 dark:text-[var(--st-text-secondary)]';
}

/* ──────────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────────── */

export function AuditClient() {
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /* ── data loader (server-side filters: action only) ────────────────────── */

  const fetchPage = useCallback(
    async (skip: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        params.set('skip', String(skip));
        if (actionFilter !== 'all') params.set('action', actionFilter);
        const res = await fetch(`/api/sabflow/audit?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`Failed to load audit log (${res.status})`);
        }
        const json = (await res.json()) as {
          entries: AuditRow[];
          total: number;
        };
        setTotal(json.total ?? 0);
        setEntries((prev) =>
          append ? [...prev, ...(json.entries ?? [])] : (json.entries ?? []),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [actionFilter],
  );

  useEffect(() => {
    setEntries([]);
    setExpanded(new Set());
    void fetchPage(0, false);
  }, [fetchPage]);

  const handleRefresh = useCallback(() => {
    setExpanded(new Set());
    void fetchPage(0, false);
  }, [fetchPage]);

  const handleLoadMore = useCallback(() => {
    void fetchPage(entries.length, true);
  }, [entries.length, fetchPage]);

  /* ── client-side filters (date + search) ───────────────────────────────── */

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      dateRange === '24h' ? 24 * 60 * 60 * 1000 :
      dateRange === '7d'  ? 7  * 24 * 60 * 60 * 1000 :
      dateRange === '30d' ? 30 * 24 * 60 * 60 * 1000 :
      0;

    const needle = search.trim().toLowerCase();

    return entries.filter((row) => {
      if (cutoffMs > 0) {
        const t = new Date(row.createdAt).getTime();
        if (Number.isFinite(t) && now - t > cutoffMs) return false;
      }
      if (needle) {
        const haystack = [
          row.target ?? '',
          row.action,
          row.flowId ?? '',
          row.metadata ? JSON.stringify(row.metadata) : '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [entries, dateRange, search]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const canLoadMore = entries.length < total;

  /* ── render ────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--gray-4)] px-4 sm:px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
          <LuHistory className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            Audit log
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            Who changed what across your SabFlow workspace
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[var(--gray-9)] tabular-nums">
            {total.toLocaleString()} total
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            <LuRefreshCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--gray-4)] px-4 sm:px-6 py-2.5 shrink-0">
        <div className="relative flex items-center w-full sm:w-auto">
          <LuSearch className="absolute left-2.5 h-3.5 w-3.5 text-[var(--gray-8)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search target or metadata…"
            className="w-full sm:w-[280px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] py-1.5 pl-8 pr-2.5 text-[12.5px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[var(--st-border)]"
          />
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[10.5px] text-[var(--gray-9)] ml-auto">
          <LuFilter className="h-3 w-3" strokeWidth={2} />
          Filter:
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] py-1.5 pl-2.5 pr-2.5 text-[12px] font-medium text-[var(--gray-11)] outline-none hover:border-[var(--gray-7)] focus:border-[var(--st-border)]"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-0.5 rounded-lg bg-[var(--gray-3)] p-0.5">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setDateRange(f.value)}
              className={cn(
                'rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors',
                dateRange === f.value
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
        {loading && entries.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Loading audit entries…</span>
          </div>
        ) : error ? (
          <div className="m-6 flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3 text-[12px] text-[var(--st-text)]">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
              <LuHistory className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] text-[var(--gray-11)] font-medium">
              {search || actionFilter !== 'all' || dateRange !== 'all'
                ? 'No entries match'
                : 'No audit entries yet'}
            </p>
            <p className="text-[11.5px] text-[var(--gray-9)]">
              {search || actionFilter !== 'all' || dateRange !== 'all'
                ? 'Try a different filter.'
                : 'Mutating actions on flows, credentials, and keys appear here.'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-[12px]">
              <thead className="border-b border-[var(--gray-4)] text-left">
                <tr className="text-[10.5px] uppercase tracking-wide text-[var(--gray-9)]">
                  <th className="px-4 sm:px-6 py-2 font-semibold w-[4%]"></th>
                  <th className="hidden sm:table-cell px-3 py-2 font-semibold">Time</th>
                  <th className="hidden lg:table-cell px-3 py-2 font-semibold">User</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                  <th className="px-3 py-2 font-semibold">Target</th>
                  <th className="hidden md:table-cell px-3 py-2 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const isOpen = expanded.has(row._id);
                  const hasMetadata =
                    !!row.metadata && Object.keys(row.metadata).length > 0;
                  return (
                    <Row
                      key={row._id}
                      row={row}
                      isOpen={isOpen}
                      hasMetadata={hasMetadata}
                      onToggle={() => toggleExpanded(row._id)}
                    />
                  );
                })}
              </tbody>
            </table>

            {canLoadMore && (
              <div className="flex justify-center px-4 sm:px-6 py-4">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <LuLoader className="h-3.5 w-3.5 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      Load more
                      <LuArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Row sub-component
   ────────────────────────────────────────────────────────────────────────── */

function Row({
  row,
  isOpen,
  hasMetadata,
  onToggle,
}: {
  row: AuditRow;
  isOpen: boolean;
  hasMetadata: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <>
      <tr className="border-b border-[var(--gray-3)] hover:bg-[var(--gray-2)]">
        <td className="px-4 sm:px-6 py-2.5">
          {hasMetadata ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={isOpen ? 'Collapse metadata' : 'Expand metadata'}
              className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]"
            >
              {isOpen ? (
                <LuChevronDown className="h-3.5 w-3.5" />
              ) : (
                <LuChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="inline-block h-5 w-5" />
          )}
        </td>
        <td className="hidden sm:table-cell px-3 py-2.5 text-[var(--gray-10)] tabular-nums">
          <span title={row.createdAt}>{formatTime(row.createdAt)}</span>
        </td>
        <td className="hidden lg:table-cell px-3 py-2.5 text-[var(--gray-11)]">
          <span className="font-mono text-[11px]" title={row.userId}>
            {shortenId(row.userId)}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span
            className={cn(
              'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide',
              actionChipClasses(row.action),
            )}
          >
            {row.action}
          </span>
        </td>
        <td className="px-3 py-2.5 text-[var(--gray-10)]">
          {row.flowId ? (
            <Link
              href={`/dashboard/sabflow/${row.flowId}`}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--st-text)] hover:text-[var(--st-text)]"
              title={row.flowId}
            >
              {row.target ?? shortenId(row.flowId)}
              <LuArrowRight className="h-3 w-3" />
            </Link>
          ) : row.target ? (
            <span className="font-mono text-[11px]" title={row.target}>
              {row.target}
            </span>
          ) : (
            <span className="text-[var(--gray-8)]">—</span>
          )}
        </td>
        <td className="hidden md:table-cell px-3 py-2.5 text-[var(--gray-10)]">
          {hasMetadata ? (
            <button
              type="button"
              onClick={onToggle}
              className="text-[11px] text-[var(--gray-9)] underline-offset-2 hover:text-[var(--gray-12)] hover:underline"
            >
              {isOpen ? 'Hide JSON' : 'Show JSON'}
            </button>
          ) : (
            <span className="text-[var(--gray-8)]">—</span>
          )}
        </td>
      </tr>
      {isOpen && hasMetadata && (
        <tr className="border-b border-[var(--gray-3)] bg-[var(--gray-2)]">
          <td className="px-4 sm:px-6 py-2" />
          <td colSpan={5} className="px-3 py-2">
            <pre className="max-h-[260px] overflow-auto rounded-md border border-[var(--gray-4)] bg-[var(--gray-1)] px-3 py-2 text-[11px] leading-relaxed text-[var(--gray-11)]">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
            {(row.ipAddress || row.userAgent) && (
              <div className="mt-1.5 flex flex-wrap gap-3 text-[10.5px] text-[var(--gray-9)]">
                {row.ipAddress && (
                  <span>
                    IP: <span className="font-mono">{row.ipAddress}</span>
                  </span>
                )}
                {row.userAgent && (
                  <span className="truncate max-w-[480px]">
                    UA: <span className="font-mono">{row.userAgent}</span>
                  </span>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Formatters
   ────────────────────────────────────────────────────────────────────────── */

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortenId(id: string): string {
  if (!id) return '—';
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
