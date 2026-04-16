'use client';

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useRef,
} from 'react';
import {
  LuUsers,
  LuCheckCircle2,
  LuActivity,
  LuTimer,
  LuSearch,
  LuDownload,
  LuRefreshCw,
  LuChevronDown,
  LuChevronRight,
  LuChevronLeft,
  LuInbox,
  LuBarChart2,
  LuTable2,
  LuLoader2,
  LuX,
} from 'react-icons/lu';

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface Submission {
  _id: string;
  sessionId: string;
  flowId: string;
  variables: Record<string, unknown>;
  completedAt: string | null;
  startedAt: string | null;
  isComplete: boolean;
}

interface AnalyticsData {
  totalSessions: number;
  completionRate: number;
  averageCompletionTime: number | null;
  dropOffByBlock: { blockId: string; blockLabel: string; dropOffCount: number }[];
  submissionsOverTime: { date: string; count: number }[];
}

interface SubmissionsResponse {
  submissions: Submission[];
  total: number;
  page: number;
  totalPages: number;
}

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtAxisDate(iso: string): string {
  try {
    const [, m, d] = iso.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  } catch {
    return iso.slice(5);
  }
}

function truncateId(id: string, len = 10): string {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

/* ══════════════════════════════════════════════════════════
   Stat card
   ══════════════════════════════════════════════════════════ */

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}

function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-5 py-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {label}
        </p>
        <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mt-0.5 tabular-nums">
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Pure-CSS bar chart
   ══════════════════════════════════════════════════════════ */

interface BarChartProps {
  data: { date: string; count: number }[];
}

function CssBarChart({ data }: BarChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  // Show last 14 points to avoid overcrowding; user sees full 30 day data in table
  const visible = data.slice(-14);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-end gap-1.5"
        style={{ height: 96 }}
        role="img"
        aria-label="Submissions over time bar chart"
      >
        {visible.map((d) => {
          const heightPct = (d.count / maxCount) * 100;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center justify-end gap-1 group relative"
              style={{ height: '100%' }}
            >
              {/* Tooltip */}
              {d.count > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-zinc-800 dark:bg-zinc-700 text-white text-[10px] rounded px-1.5 py-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {d.count} on {d.date}
                </div>
              )}
              <div
                className="w-full rounded-t-sm bg-amber-400 dark:bg-amber-500 transition-all duration-300 min-h-[2px]"
                style={{ height: `${Math.max(heightPct, d.count > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels — show every other one to save space */}
      <div className="flex items-start gap-1.5">
        {visible.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % 2 === 0 && (
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
                {fmtAxisDate(d.date)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Expanded submission row
   ══════════════════════════════════════════════════════════ */

function ExpandedRow({ submission }: { submission: Submission }) {
  const entries = Object.entries(submission.variables).filter(
    ([, v]) => v !== '' && v != null,
  );

  return (
    <tr>
      <td
        colSpan={5}
        className="px-4 py-4 bg-zinc-50/80 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700"
      >
        <div className="space-y-3 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Collected variables
          </p>

          {entries.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
              No variables collected.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entries.map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2.5 py-1 text-sm"
                >
                  <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
                    {key}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500">=</span>
                  <span className="text-zinc-700 dark:text-zinc-300 max-w-[240px] truncate">
                    {String(val)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 space-y-0.5 pt-1">
            <div>
              Session ID:{' '}
              <span className="font-mono">{submission.sessionId || submission._id}</span>
            </div>
            <div>Started: {fmtDate(submission.startedAt)}</div>
            <div>Completed: {fmtDate(submission.completedAt)}</div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ══════════════════════════════════════════════════════════
   Results tab
   ══════════════════════════════════════════════════════════ */

interface ResultsTabProps {
  flowId: string;
}

const PAGE_SIZE = 20;

function ResultsTab({ flowId }: ResultsTabProps) {
  const [data, setData] = useState<SubmissionsResponse | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }, []);

  const fetchPage = useCallback(
    (p: number, searchTerm: string) => {
      startTransition(async () => {
        const qs = new URLSearchParams({
          page: String(p),
          limit: String(PAGE_SIZE),
          ...(searchTerm ? { search: searchTerm } : {}),
        });
        const res = await fetch(`/api/sabflow/${flowId}/submissions?${qs}`);
        if (res.ok) {
          const json = (await res.json()) as SubmissionsResponse;
          setData(json);
        }
      });
    },
    [flowId],
  );

  useEffect(() => {
    fetchPage(page, debouncedSearch);
  }, [fetchPage, page, debouncedSearch]);

  const handlePageChange = useCallback(
    (next: number) => {
      setPage(next);
      setExpandedId(null);
    },
    [],
  );

  const handleExport = useCallback(() => {
    window.location.href = `/api/sabflow/${flowId}/submissions/export`;
  }, [flowId]);

  const submissions = data?.submissions ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        {/* Search */}
        <div className="relative w-64">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search variable values…"
            className="w-full pl-9 pr-8 py-2 text-[13px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400"
          />
          {search && (
            <button
              onClick={() => { handleSearchChange(''); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label="Clear search"
            >
              <LuX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPage(page, debouncedSearch)}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50 px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <LuRefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
          >
            <LuDownload className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
        {/* Loading skeleton */}
        {isPending && submissions.length === 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="w-8" />
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">ID</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">Started</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Completed</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-4 bg-zinc-100 dark:bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 w-36 bg-zinc-100 dark:bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-36 bg-zinc-100 dark:bg-zinc-800 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : total === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
              <LuInbox className="w-7 h-7 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="text-[15px] font-semibold text-zinc-600 dark:text-zinc-400">
              {debouncedSearch ? 'No matching submissions' : 'No submissions yet'}
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">
              {debouncedSearch
                ? `Nothing matched "${debouncedSearch}". Try a different search.`
                : 'Submissions will appear here once users complete your published flow.'}
            </p>
            {debouncedSearch && (
              <button
                onClick={() => handleSearchChange('')}
                className="mt-3 text-sm text-amber-500 hover:text-amber-600 font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="w-8" />
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  ID
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                  Started
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Completed
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody
              className={`divide-y divide-zinc-100 dark:divide-zinc-800 transition-opacity ${isPending ? 'opacity-50' : ''}`}
            >
              {submissions.flatMap((sub) => {
                const isExpanded = expandedId === sub._id;
                return [
                  <tr
                    key={sub._id}
                    onClick={() => setExpandedId(isExpanded ? null : sub._id)}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-3 py-3 text-zinc-400">
                      {isExpanded ? (
                        <LuChevronDown className="w-4 h-4" />
                      ) : (
                        <LuChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
                      {truncateId(sub.sessionId || sub._id)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 hidden sm:table-cell text-[12px]">
                      {fmtDate(sub.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-[12px]">
                      {fmtDate(sub.completedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {sub.isComplete ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block" />
                          Partial
                        </span>
                      )}
                    </td>
                  </tr>,
                  ...(isExpanded
                    ? [<ExpandedRow key={`${sub._id}-exp`} submission={sub} />]
                    : []),
                ];
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <span className="text-[12px]">
            {total} submission{total !== 1 ? 's' : ''} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <LuChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages,
              )
              .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                  acc.push('ellipsis');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-1 text-zinc-400">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => handlePageChange(item as number)}
                    className={`h-7 w-7 rounded text-[12px] font-medium transition-colors ${
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
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <LuChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Analytics tab
   ══════════════════════════════════════════════════════════ */

interface AnalyticsTabProps {
  flowId: string;
}

function AnalyticsTab({ flowId }: AnalyticsTabProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/sabflow/${flowId}/analytics`);
      if (res.ok) {
        setData((await res.json()) as AnalyticsData);
      } else {
        setError('Failed to load analytics.');
      }
    });
  }, [flowId]);

  useEffect(() => {
    load();
  }, [load]);

  if (isPending && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400 gap-2">
        <LuLoader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{error}</p>
        <button
          onClick={load}
          className="text-sm text-amber-500 hover:text-amber-600 font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const completedCount = Math.round((data.totalSessions * data.completionRate) / 100);

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<LuUsers className="w-5 h-5" />}
          label="Total sessions"
          value={data.totalSessions}
        />
        <StatCard
          icon={<LuCheckCircle2 className="w-5 h-5" />}
          label="Completed"
          value={completedCount}
          sub={`${data.completionRate}% completion rate`}
        />
        <StatCard
          icon={<LuActivity className="w-5 h-5" />}
          label="Completion rate"
          value={`${data.completionRate}%`}
        />
        <StatCard
          icon={<LuTimer className="w-5 h-5" />}
          label="Avg. time"
          value={fmtDuration(data.averageCompletionTime)}
          sub="to complete"
        />
      </div>

      {/* Submissions over time */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">
              Submissions over time
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              Last 30 days
            </p>
          </div>
          <button
            onClick={load}
            disabled={isPending}
            className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            <LuRefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {data.submissionsOverTime.every((d) => d.count === 0) ? (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <LuInbox className="w-6 h-6 text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
              No submission data in the last 30 days.
            </p>
          </div>
        ) : (
          <CssBarChart data={data.submissionsOverTime} />
        )}
      </div>

      {/* Drop-off by block */}
      {data.dropOffByBlock.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
          <p className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200 mb-1">
            Drop-off points
          </p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-4">
            Where incomplete sessions last stopped
          </p>

          <div className="space-y-3">
            {data.dropOffByBlock.map((item) => {
              const maxDropOff = Math.max(
                ...data.dropOffByBlock.map((x) => x.dropOffCount),
                1,
              );
              const pct = Math.round((item.dropOffCount / maxDropOff) * 100);
              return (
                <div key={item.blockId} className="flex items-center gap-3">
                  <div className="w-52 shrink-0 text-[12px] text-zinc-600 dark:text-zinc-300 truncate" title={item.blockLabel}>
                    {item.blockLabel}
                  </div>
                  <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 dark:bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-8 shrink-0 text-right text-[12px] font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {item.dropOffCount}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Root component
   ══════════════════════════════════════════════════════════ */

type Tab = 'results' | 'analytics';

interface FlowResultsClientProps {
  flowId: string;
}

export function FlowResultsClient({ flowId }: FlowResultsClientProps) {
  const [tab, setTab] = useState<Tab>('results');

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1 self-start">
        {(
          [
            { id: 'results', label: 'Results', icon: LuTable2 },
            { id: 'analytics', label: 'Analytics', icon: LuBarChart2 },
          ] as { id: Tab; label: string; icon: React.ElementType }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              tab === id
                ? 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'results' ? (
        <ResultsTab flowId={flowId} />
      ) : (
        <AnalyticsTab flowId={flowId} />
      )}
    </div>
  );
}
