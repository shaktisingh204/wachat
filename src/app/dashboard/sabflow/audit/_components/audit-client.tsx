'use client';

/**
 * AuditClient
 *
 * Renders the SabFlow audit-log table for the current workspace.
 *
 *   - Filterable by action, date range (last 24h / 7d / 30d / all),
 *     and free-text search across `target` + JSON-stringified metadata.
 *   - Action chips are colour-coded by family (one tone carries one meaning):
 *       flow.*       -> info
 *       credential.* -> warning
 *       apiKey.*     -> accent
 *       env.*        -> success
 *       folder.*     -> danger
 *   - Pagination: "Load more" appends the next 50 rows.
 *
 * Reads from GET /api/sabflow/audit - auth-gated, scoped to the
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
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Filter,
  History,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

/* --------------------------------------------------------------------------
   Types & constants
   -------------------------------------------------------------------------- */

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

const DATE_FILTERS: ReadonlyArray<{ value: DateRange; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: 'Last 24h' },
  { value: '7d',  label: 'Last 7d' },
  { value: '30d', label: 'Last 30d' },
];

/** Map an action's family to a Badge tone so colour only ever carries meaning. */
function actionTone(action: string): BadgeTone {
  if (action.startsWith('flow.')) return 'info';
  if (action.startsWith('credential.')) return 'warning';
  if (action.startsWith('apiKey.')) return 'accent';
  if (action.startsWith('env.')) return 'success';
  if (action.startsWith('folder.')) return 'danger';
  return 'neutral';
}

/* --------------------------------------------------------------------------
   Component
   -------------------------------------------------------------------------- */

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

  /* -- data loader (server-side filters: action only) --------------------- */

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

  /* -- client-side filters (date + search) -------------------------------- */

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
  const isFiltered = Boolean(search || actionFilter !== 'all' || dateRange !== 'all');

  /* -- render ------------------------------------------------------------- */

  return (
    <div className="ui20 flex flex-col h-full">
      {/* Header */}
      <PageHeader className="px-4 sm:px-6 shrink-0">
        <PageHeaderHeading>
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
              aria-hidden="true"
            >
              <History className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="flex flex-col leading-tight min-w-0">
              <PageTitle>Audit log</PageTitle>
              <PageDescription>
                Who changed what across your SabFlow workspace
              </PageDescription>
            </div>
          </div>
        </PageHeaderHeading>
        <PageActions>
          <span className="text-[11px] text-[var(--st-text-secondary)] tabular-nums">
            {total.toLocaleString()} total
          </span>
          <Button
            size="sm"
            variant="secondary"
            iconLeft={RefreshCw}
            loading={loading}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--st-border)] px-4 sm:px-6 py-2.5 shrink-0">
        <Field className="w-full sm:w-auto">
          <Input
            inputSize="sm"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search target or metadata..."
            aria-label="Search audit entries"
            iconLeft={Search}
            className="w-full sm:w-[280px]"
          />
        </Field>

        <div className="hidden sm:flex items-center gap-1 text-[10.5px] text-[var(--st-text-secondary)] ml-auto">
          <Filter className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Filter:
        </div>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger aria-label="Filter by action" className="w-[180px]">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SegmentedControl<DateRange>
          size="sm"
          aria-label="Filter by date range"
          items={DATE_FILTERS}
          value={dateRange}
          onChange={setDateRange}
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && entries.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Loading audit entries" />
            <span className="text-[12px]">Loading audit entries...</span>
          </div>
        ) : error ? (
          <div className="m-6">
            <Alert tone="danger" icon={TriangleAlert} title="Could not load audit log">
              {error}
            </Alert>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <EmptyState
              icon={History}
              title={isFiltered ? 'No entries match' : 'No audit entries yet'}
              description={
                isFiltered
                  ? 'Try a different filter.'
                  : 'Mutating actions on flows, credentials, and keys appear here.'
              }
            />
          </div>
        ) : (
          <>
            <Table density="compact">
              <THead>
                <Tr>
                  <Th width="4%" aria-label="Expand" />
                  <Th className="hidden sm:table-cell">Time</Th>
                  <Th className="hidden lg:table-cell">User</Th>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th className="hidden md:table-cell">Metadata</Th>
                </Tr>
              </THead>
              <TBody>
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
              </TBody>
            </Table>

            {canLoadMore && (
              <div className="flex justify-center px-4 sm:px-6 py-4">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={loadingMore}
                  iconRight={loadingMore ? undefined : ArrowRight}
                  onClick={handleLoadMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Row sub-component
   -------------------------------------------------------------------------- */

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
      <Tr>
        <Td>
          {hasMetadata ? (
            <IconButton
              size="sm"
              icon={isOpen ? ChevronDown : ChevronRight}
              label={isOpen ? 'Collapse metadata' : 'Expand metadata'}
              onClick={onToggle}
            />
          ) : (
            <span className="inline-block h-5 w-5" aria-hidden="true" />
          )}
        </Td>
        <Td className="hidden sm:table-cell text-[var(--st-text-secondary)] tabular-nums">
          <span title={row.createdAt}>{formatTime(row.createdAt)}</span>
        </Td>
        <Td className="hidden lg:table-cell">
          <span className="font-mono text-[11px]" title={row.userId}>
            {shortenId(row.userId)}
          </span>
        </Td>
        <Td>
          <Badge tone={actionTone(row.action)} kind="soft">
            {row.action}
          </Badge>
        </Td>
        <Td className="text-[var(--st-text-secondary)]">
          {row.flowId ? (
            <Link
              href={`/dashboard/sabflow/${row.flowId}`}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--st-accent)] hover:underline"
              title={row.flowId}
            >
              {row.target ?? shortenId(row.flowId)}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : row.target ? (
            <span className="font-mono text-[11px]" title={row.target}>
              {row.target}
            </span>
          ) : (
            <span className="text-[var(--st-text-tertiary)]">-</span>
          )}
        </Td>
        <Td className="hidden md:table-cell text-[var(--st-text-secondary)]">
          {hasMetadata ? (
            <Button variant="ghost" size="sm" onClick={onToggle}>
              {isOpen ? 'Hide JSON' : 'Show JSON'}
            </Button>
          ) : (
            <span className="text-[var(--st-text-tertiary)]">-</span>
          )}
        </Td>
      </Tr>
      {isOpen && hasMetadata && (
        <Tr className="bg-[var(--st-bg-secondary)]">
          <Td />
          <Td colSpan={5}>
            <pre className="max-h-[260px] overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[11px] leading-relaxed text-[var(--st-text-secondary)]">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
            {(row.ipAddress || row.userAgent) && (
              <div className="mt-1.5 flex flex-wrap gap-3 text-[10.5px] text-[var(--st-text-secondary)]">
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
          </Td>
        </Tr>
      )}
    </>
  );
}

/* --------------------------------------------------------------------------
   Formatters
   -------------------------------------------------------------------------- */

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
  if (!id) return '-';
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}
