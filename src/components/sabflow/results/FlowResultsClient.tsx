'use client';

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useRef,
} from 'react';
import {
  Users,
  CheckCircle2,
  Activity,
  Timer,
  Search,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Inbox,
  BarChart2,
  Table2,
  X,
} from 'lucide-react';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Field,
  Input,
  Badge,
  EmptyState,
  Spinner,
  Skeleton,
  StatCard,
  Pagination,
  SegmentedControl,
} from '@/components/sabcrm/20ui';

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
  if (!iso) return '-';
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
  if (seconds == null) return '-';
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
  return id.length > len ? `${id.slice(0, len)}...` : id;
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
        className="flex items-end gap-1.5 h-24"
        role="img"
        aria-label="Submissions over time bar chart"
      >
        {visible.map((d) => {
          const heightPct = (d.count / maxCount) * 100;
          return (
            <div
              key={d.date}
              className="flex-1 h-full flex flex-col items-center justify-end gap-1 group relative"
            >
              {/* Tooltip */}
              {d.count > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[var(--st-text)] text-[var(--st-text-inverted)] text-[10px] rounded-[var(--st-radius-sm)] px-1.5 py-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {d.count} on {d.date}
                </div>
              )}
              <div
                className="w-full rounded-t-sm bg-[var(--st-accent)] transition-all duration-300 min-h-[2px]"
                style={{ height: `${Math.max(heightPct, d.count > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels - show every other one to save space */}
      <div className="flex items-start gap-1.5">
        {visible.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % 2 === 0 && (
              <span className="text-[9px] text-[var(--st-text-secondary)]">
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
    <Tr>
      <Td
        colSpan={5}
        className="bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)]"
      >
        <div className="space-y-3 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Collected variables
          </p>

          {entries.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)] italic">
              No variables collected.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entries.map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-[var(--st-radius)] px-2.5 py-1 text-sm"
                >
                  <span className="font-mono text-xs text-[var(--st-text)]">
                    {key}
                  </span>
                  <span className="text-[var(--st-text-tertiary)]">=</span>
                  <span className="text-[var(--st-text)] max-w-[240px] truncate">
                    {String(val)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[11px] text-[var(--st-text-secondary)] space-y-0.5 pt-1">
            <div>
              Session ID:{' '}
              <span className="font-mono">{submission.sessionId || submission._id}</span>
            </div>
            <div>Started: {fmtDate(submission.startedAt)}</div>
            <div>Completed: {fmtDate(submission.completedAt)}</div>
          </div>
        </div>
      </Td>
    </Tr>
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
        <div className="w-64">
          <Field label="Search submissions">
            <Input
              type="text"
              inputSize="sm"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search variable values..."
              iconLeft={Search}
              iconRight={search ? X : undefined}
            />
          </Field>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={RefreshCw}
            onClick={() => fetchPage(page, debouncedSearch)}
            disabled={isPending}
            loading={isPending}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Download}
            onClick={handleExport}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        {/* Loading skeleton */}
        {isPending && submissions.length === 0 ? (
          <Table>
            <THead>
              <Tr>
                <Th width={32} aria-label="Expand" />
                <Th>ID</Th>
                <Th className="hidden sm:table-cell">Started</Th>
                <Th>Completed</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <Tr key={i}>
                  <Td><Skeleton width={16} height={16} radius={4} /></Td>
                  <Td><Skeleton width={96} height={16} radius={4} /></Td>
                  <Td className="hidden sm:table-cell"><Skeleton width={144} height={16} radius={4} /></Td>
                  <Td><Skeleton width={144} height={16} radius={4} /></Td>
                  <Td><Skeleton width={80} height={20} radius={9999} /></Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : total === 0 ? (
          /* Empty state */
          <EmptyState
            icon={Inbox}
            title={debouncedSearch ? 'No matching submissions' : 'No submissions yet'}
            description={
              debouncedSearch
                ? `Nothing matched "${debouncedSearch}". Try a different search.`
                : 'Submissions will appear here once users complete your published flow.'
            }
            action={
              debouncedSearch ? (
                <Button variant="ghost" size="sm" onClick={() => handleSearchChange('')}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table hover>
            <THead>
              <Tr>
                <Th width={32} aria-label="Expand" />
                <Th>ID</Th>
                <Th className="hidden sm:table-cell">Started</Th>
                <Th>Completed</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody className={isPending ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
              {submissions.flatMap((sub) => {
                const isExpanded = expandedId === sub._id;
                return [
                  <Tr
                    key={sub._id}
                    onClick={() => setExpandedId(isExpanded ? null : sub._id)}
                    className="cursor-pointer"
                  >
                    <Td className="text-[var(--st-text-tertiary)]">
                      {isExpanded ? (
                        <ChevronDown size={16} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={16} aria-hidden="true" />
                      )}
                    </Td>
                    <Td className="font-mono text-[12px] text-[var(--st-text)]">
                      {truncateId(sub.sessionId || sub._id)}
                    </Td>
                    <Td className="hidden sm:table-cell text-[12px] text-[var(--st-text-secondary)]">
                      {fmtDate(sub.startedAt)}
                    </Td>
                    <Td className="text-[12px] text-[var(--st-text-secondary)]">
                      {fmtDate(sub.completedAt)}
                    </Td>
                    <Td>
                      {sub.isComplete ? (
                        <Badge tone="success" dot>
                          Complete
                        </Badge>
                      ) : (
                        <Badge tone="neutral" dot>
                          Partial
                        </Badge>
                      )}
                    </Td>
                  </Tr>,
                  ...(isExpanded
                    ? [<ExpandedRow key={`${sub._id}-exp`} submission={sub} />]
                    : []),
                ];
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--st-text-secondary)]">
            {total} submission{total !== 1 ? 's' : ''} total
          </span>
          <Pagination
            page={page}
            pageCount={totalPages}
            onPageChange={handlePageChange}
            size="compact"
          />
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
      <div className="flex items-center justify-center py-20 text-[var(--st-text-secondary)] gap-2">
        <Spinner size="md" label="Loading analytics" />
        <span className="text-sm">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <p className="text-sm text-[var(--st-text)]">{error}</p>
        <Button variant="ghost" size="sm" onClick={load}>
          Retry
        </Button>
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
          icon={Users}
          label="Total sessions"
          value={data.totalSessions}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={completedCount}
          delta={{ value: `${data.completionRate}% completion rate`, tone: 'neutral' }}
        />
        <StatCard
          icon={Activity}
          label="Completion rate"
          value={`${data.completionRate}%`}
        />
        <StatCard
          icon={Timer}
          label="Avg. time"
          value={fmtDuration(data.averageCompletionTime)}
          delta={{ value: 'to complete', tone: 'neutral' }}
        />
      </div>

      {/* Submissions over time */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Submissions over time</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={RefreshCw}
            onClick={load}
            disabled={isPending}
            loading={isPending}
          >
            Refresh
          </Button>
        </CardHeader>

        {data.submissionsOverTime.every((d) => d.count === 0) ? (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <Inbox size={24} aria-hidden="true" className="text-[var(--st-text-tertiary)] mb-2" />
            <p className="text-[12px] text-[var(--st-text-secondary)]">
              No submission data in the last 30 days.
            </p>
          </div>
        ) : (
          <CssBarChart data={data.submissionsOverTime} />
        )}
      </Card>

      {/* Drop-off by block */}
      {data.dropOffByBlock.length > 0 && (
        <Card padding="lg">
          <CardTitle>Drop-off points</CardTitle>
          <CardDescription>Where incomplete sessions last stopped</CardDescription>

          <div className="space-y-3 mt-4">
            {data.dropOffByBlock.map((item) => {
              const maxDropOff = Math.max(
                ...data.dropOffByBlock.map((x) => x.dropOffCount),
                1,
              );
              const pct = Math.round((item.dropOffCount / maxDropOff) * 100);
              return (
                <div key={item.blockId} className="flex items-center gap-3">
                  <div className="w-52 shrink-0 text-[12px] text-[var(--st-text)] truncate" title={item.blockLabel}>
                    {item.blockLabel}
                  </div>
                  <div className="flex-1 h-2 bg-[var(--st-bg-muted)] rounded-[var(--st-radius-pill)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--st-accent)] rounded-[var(--st-radius-pill)] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-8 shrink-0 text-right text-[12px] font-medium text-[var(--st-text)] tabular-nums">
                    {item.dropOffCount}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
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
      <SegmentedControl<Tab>
        className="self-start"
        aria-label="Flow results view"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'results', label: 'Results', icon: Table2 },
          { value: 'analytics', label: 'Analytics', icon: BarChart2 },
        ]}
      />

      {/* Tab content */}
      {tab === 'results' ? (
        <ResultsTab flowId={flowId} />
      ) : (
        <AnalyticsTab flowId={flowId} />
      )}
    </div>
  );
}
