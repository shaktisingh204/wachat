'use client';

/**
 * ExecutionsListClient
 *
 * Lists recent flow executions with status badges, duration, trigger mode,
 * and a click-through to the replay view. Includes filter chips (status,
 * trigger mode) and a free-text search across flow name plus session id.
 *
 * Reads from GET /api/sabflow/executions, which already returns a JSON list of
 * `ExecutionHistoryDoc` rows for the caller's project.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageHeader,
  PageHeaderHeading,
  PageDescription,
  PageTitle,
  SegmentedControl,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Alert,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { getActiveLocale, t } from '@/lib/sabflow/i18n';
import type {
  ExecutionStatus,
  ExecutionTriggerMode,
} from '@/lib/sabflow/types';

const LOCALE = getActiveLocale();

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

const STATUS_TONE: Record<ExecutionStatus, BadgeTone> = {
  running: 'info',
  success: 'success',
  error: 'danger',
  cancelled: 'neutral',
};

const TRIGGER_LABELS: Record<ExecutionTriggerMode, string> = {
  manual: 'Manual',
  schedule: 'Schedule',
  webhook: 'Webhook',
  start: 'Start',
  test: 'Test',
};

const STATUS_FILTERS: ReadonlyArray<{ value: ExecutionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Errored' },
  { value: 'running', label: 'Running' },
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
    <div className="20ui flex flex-col h-full">
      {/* Header */}
      <PageHeader compact className="px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] shrink-0"
            aria-hidden="true"
          >
            <Activity className="h-4 w-4" strokeWidth={2} />
          </span>
          <PageHeaderHeading>
            <PageTitle className="text-[15px]">{t('executions.title', LOCALE)}</PageTitle>
            <PageDescription className="hidden sm:block">
              Past flow runs with per-node detail
            </PageDescription>
          </PageHeaderHeading>
        </div>
        <PageActions>
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            loading={loading}
            iconLeft={RefreshCw}
          >
            <span className="hidden sm:inline">{t('executions.refresh', LOCALE)}</span>
          </Button>
        </PageActions>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 border-b border-[var(--st-border)] px-4 sm:px-6 py-2.5 shrink-0">
        <div className="w-full sm:w-[260px]">
          <Field>
            <Input
              inputSize="sm"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by flow, session, or id"
              iconLeft={Search}
              aria-label="Search executions"
            />
          </Field>
        </div>
        <div className="sm:ml-auto">
          <SegmentedControl
            size="sm"
            aria-label="Filter executions by status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            items={STATUS_FILTERS}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && executions.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Loading executions" />
            <span className="text-[12px]">Loading executions</span>
          </div>
        ) : error ? (
          <div className="m-6">
            <Alert tone="danger" title="Could not load executions">
              {error}
            </Alert>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <EmptyState
              icon={Activity}
              title={
                search || statusFilter !== 'all'
                  ? 'No executions match'
                  : t('executions.empty', LOCALE)
              }
              description={
                search || statusFilter !== 'all'
                  ? 'Try a different filter.'
                  : 'Run a flow to see its history here.'
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile: card list (under md) */}
            <div className="md:hidden divide-y divide-[var(--st-border)]">
              {filtered.map((row) => (
                <Link
                  key={row._id}
                  href={`/dashboard/sabflow/executions/${row._id}`}
                  className="block px-4 py-3 hover:bg-[var(--st-bg-secondary)]"
                >
                  <div className="flex items-start gap-2">
                    <Badge
                      tone={STATUS_TONE[row.status] ?? 'neutral'}
                      className="shrink-0 mt-0.5 uppercase"
                    >
                      {row.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-[13px] text-[var(--st-text)] truncate">
                          {row.flowName ?? 'Untitled flow'}
                        </span>
                        <ArrowRight
                          className="h-3 w-3 shrink-0 text-[var(--st-text-tertiary)]"
                          aria-hidden="true"
                        />
                      </div>
                      {row.error && (
                        <p
                          className="mt-0.5 truncate text-[11px] text-[var(--st-danger)]"
                          title={row.error}
                        >
                          {row.error}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--st-text-secondary)]">
                        <span>
                          {row.triggerMode ? TRIGGER_LABELS[row.triggerMode] : '-'}
                        </span>
                        <span>{row.startedAt ? formatTime(row.startedAt) : '-'}</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatDuration(row.executionTimeMs)}
                        </span>
                        <span className="tabular-nums">
                          {row.nodeCount ?? 0} nodes
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: table (md+) */}
            <div className="hidden md:block">
              <Table density="compact">
                <THead>
                  <Tr>
                    <Th>Status</Th>
                    <Th>Flow</Th>
                    <Th>Trigger</Th>
                    <Th>Started</Th>
                    <Th>Duration</Th>
                    <Th align="right">Nodes</Th>
                    <Th align="right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((row) => (
                    <Tr key={row._id}>
                      <Td>
                        <Badge
                          tone={STATUS_TONE[row.status] ?? 'neutral'}
                          className="uppercase"
                        >
                          {row.status}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="font-medium text-[var(--st-text)]">
                          {row.flowName ?? 'Untitled flow'}
                        </span>
                        {row.error && (
                          <p
                            className="mt-0.5 truncate text-[11px] text-[var(--st-danger)] max-w-[280px]"
                            title={row.error}
                          >
                            {row.error}
                          </p>
                        )}
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">
                        {row.triggerMode ? TRIGGER_LABELS[row.triggerMode] : '-'}
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">
                        {row.startedAt ? formatTime(row.startedAt) : '-'}
                      </Td>
                      <Td className="text-[var(--st-text-secondary)] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatDuration(row.executionTimeMs)}
                        </span>
                      </Td>
                      <Td align="right" className="text-[var(--st-text-secondary)] tabular-nums">
                        {row.nodeCount ?? 0}
                      </Td>
                      <Td align="right">
                        <Link
                          href={`/dashboard/sabflow/executions/${row._id}`}
                          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--st-accent)] hover:underline"
                        >
                          View
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
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
  if (!ms || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}
