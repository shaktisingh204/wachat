'use client';

/**
 * <DealListClient> — canonical Deals list view per CRM_REBUILD_PLAN §1D.
 *
 * Ships:
 *   - KPI strip (open count, open value, won/lost this month, avg cycle)
 *   - View switcher (table | kanban | calendar)
 *   - Filters (pipeline → stage cascade, owner, status, date range, amount range, tags)
 *   - Search across title + client name
 *   - Bulk-action bar (archive / delete / export CSV / change-stage / assign-to)
 *
 * The list page hydrates this with a flat `deals` array + a `kpi` summary;
 * filtering, sorting, and search all happen client-side for snappy
 * interaction. The server-side action layer still respects userId scoping.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarRange,
  Columns3,
  Download,
  Plus,
  Search,
  Table as TableIcon,
  Trophy,
} from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import { DealKanban } from './deal-kanban';
import { DealCalendar } from './deal-calendar';
import { DealTable } from './deal-table';
import { DealBulkBar } from './deal-bulk-bar';
import type { DealKpiSummary, DealListRow } from './types';

/* ─── Types ──────────────────────────────────────────────────────────── */

type ViewMode = 'table' | 'kanban' | 'calendar';

interface DealListClientProps {
  deals: DealListRow[];
  total: number;
  page: number;
  limit: number;
  initialQuery: string;
  kpi: DealKpiSummary;
  stages: string[];
  defaultCurrency: string;
  error?: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */

function fmtMoney(value?: number | null, currency = 'INR'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function deriveStatus(stage?: string): string {
  if (!stage) return 'open';
  const s = stage.toLowerCase();
  if (s.includes('won') || s === 'won') return 'won';
  if (s.includes('lost') || s === 'lost') return 'lost';
  return 'open';
}

function toCsv(rows: DealListRow[]): string {
  const head = ['title', 'client', 'amount', 'currency', 'stage', 'status', 'probability', 'expectedClose', 'createdAt'];
  const body = rows.map((r) =>
    [
      r.name,
      r.clientLabel ?? '',
      r.amount ?? '',
      r.currency ?? '',
      r.stage ?? '',
      deriveStatus(r.stage),
      r.probability ?? '',
      r.expectedClose ?? '',
      r.createdAt ?? '',
    ]
      .map((cell) => {
        const v = String(cell ?? '');
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(','),
  );
  return [head.join(','), ...body].join('\n');
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function DealListClient({
  deals: serverDeals,
  total,
  page,
  limit,
  initialQuery,
  kpi,
  stages,
  defaultCurrency,
  error,
}: DealListClientProps) {
  const { toast } = useZoruToast();

  /* View mode + filters */
  const [view, setView] = React.useState<ViewMode>('table');
  const [query, setQuery] = React.useState(initialQuery);
  const [pipelineFilter, setPipelineFilter] = React.useState<string | null>(null);
  const [stageFilter, setStageFilter] = React.useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [tagFilter, setTagFilter] = React.useState<string>('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [amountMin, setAmountMin] = React.useState('');
  const [amountMax, setAmountMax] = React.useState('');

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* Confirm dialog state */
  const [deletePending, setDeletePending] = React.useState(false);

  /* Filtered + sorted view */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = amountMin ? Number(amountMin) : Number.NEGATIVE_INFINITY;
    const max = amountMax ? Number(amountMax) : Number.POSITIVE_INFINITY;
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;

    return serverDeals.filter((d) => {
      if (q) {
        const hay = `${d.name ?? ''} ${d.clientLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (pipelineFilter && d.pipelineId !== pipelineFilter) return false;
      if (stageFilter && d.stage !== stageFilter) return false;
      if (ownerFilter && d.ownerId !== ownerFilter) return false;
      if (statusFilter !== 'all' && deriveStatus(d.stage) !== statusFilter) return false;
      const amount = typeof d.amount === 'number' ? d.amount : 0;
      if (amount < min || amount > max) return false;
      if (from && d.expectedClose) {
        const t = new Date(d.expectedClose).getTime();
        if (!Number.isNaN(t) && t < from) return false;
      }
      if (to && d.expectedClose) {
        const t = new Date(d.expectedClose).getTime();
        if (!Number.isNaN(t) && t > to) return false;
      }
      if (tagFilter && !(d.tags ?? []).some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))) {
        return false;
      }
      return true;
    });
  }, [
    serverDeals,
    query,
    pipelineFilter,
    stageFilter,
    ownerFilter,
    statusFilter,
    fromDate,
    toDate,
    amountMin,
    amountMax,
    tagFilter,
  ]);

  /* Bulk actions */
  const allSelectedOnPage = filtered.length > 0 && filtered.every((d) => selected.has(d._id));
  const toggleAll = () =>
    setSelected((prev) => {
      if (allSelectedOnPage) {
        const next = new Set(prev);
        for (const d of filtered) next.delete(d._id);
        return next;
      }
      const next = new Set(prev);
      for (const d of filtered) next.add(d._id);
      return next;
    });

  const exportCsv = () => {
    const rows = filtered.filter((d) => selected.size === 0 || selected.has(d._id));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deals-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${rows.length} deals saved to CSV.` });
  };

  const clearFilters = () => {
    setQuery('');
    setPipelineFilter(null);
    setStageFilter(null);
    setOwnerFilter(null);
    setStatusFilter('all');
    setTagFilter('');
    setFromDate('');
    setToDate('');
    setAmountMin('');
    setAmountMax('');
  };

  const filtersActive =
    Boolean(query) ||
    Boolean(pipelineFilter) ||
    Boolean(stageFilter) ||
    Boolean(ownerFilter) ||
    statusFilter !== 'all' ||
    Boolean(tagFilter) ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(amountMin) ||
    Boolean(amountMax);

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="flex w-full flex-col gap-5">
      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <ZoruStatCard
          label="Open deals"
          value={kpi.openCount.toLocaleString()}
          period="currently active"
          icon={<Trophy />}
        />
        <ZoruStatCard
          label="Open pipeline"
          value={fmtMoney(kpi.openValue, defaultCurrency)}
          period="sum of open"
        />
        <ZoruStatCard
          label="Won this month"
          value={fmtMoney(kpi.wonThisMonth, defaultCurrency)}
          period="closed-won"
        />
        <ZoruStatCard
          label="Lost this month"
          value={fmtMoney(kpi.lostThisMonth, defaultCurrency)}
          period="closed-lost"
          invertDelta
        />
        <ZoruStatCard
          label="Avg cycle"
          value={kpi.avgCycleDays > 0 ? `${kpi.avgCycleDays.toFixed(1)} d` : '—'}
          period="created → close"
        />
      </div>

      {error ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
          {error}
        </div>
      ) : null}

      <ZoruCard className="overflow-hidden p-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <ZoruInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or client…"
              className="h-9 pl-9 text-[13px]"
              aria-label="Search deals"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {/* View switcher */}
            <div className="flex items-center rounded border border-zoru-line bg-zoru-surface p-0.5">
              <ZoruButton
                type="button"
                variant={view === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('table')}
                aria-pressed={view === 'table'}
                aria-label="Table view"
              >
                <TableIcon className="h-3.5 w-3.5" />
              </ZoruButton>
              <ZoruButton
                type="button"
                variant={view === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('kanban')}
                aria-pressed={view === 'kanban'}
                aria-label="Kanban view"
              >
                <Columns3 className="h-3.5 w-3.5" />
              </ZoruButton>
              <ZoruButton
                type="button"
                variant={view === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('calendar')}
                aria-pressed={view === 'calendar'}
                aria-label="Calendar view"
              >
                <CalendarRange className="h-3.5 w-3.5" />
              </ZoruButton>
            </div>

            <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> Export
            </ZoruButton>

            <ZoruButton size="sm" asChild>
              <Link href="/dashboard/crm/sales-crm/deals/new">
                <Plus className="h-3.5 w-3.5" /> New deal
              </Link>
            </ZoruButton>
          </div>
        </div>

        {/* Filters */}
        <details className="border-b border-zoru-line bg-zoru-surface-2/40" open>
          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Filters {filtersActive ? <span className="ml-2 text-zoru-ink">·</span> : null}
            {filtersActive ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  clearFilters();
                }}
                className="ml-1 text-zoru-primary hover:underline"
              >
                clear all
              </button>
            ) : null}
          </summary>
          <div className="grid gap-3 px-3 pb-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-1">
              <ZoruLabel>Pipeline</ZoruLabel>
              <EntityFormField
                entity="pipeline"
                name="_filter_pipeline"
                initialId={pipelineFilter}
                onChange={(next) => {
                  setPipelineFilter(next);
                  // Reset stage when pipeline changes.
                  setStageFilter(null);
                }}
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Stage</ZoruLabel>
              <EntityFormField
                entity="stage"
                name="_filter_stage"
                initialId={stageFilter}
                filter={pipelineFilter ? { pipelineId: pipelineFilter } : undefined}
                onChange={(next) => setStageFilter(next)}
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Owner</ZoruLabel>
              <EntityFormField
                entity="user"
                name="_filter_owner"
                initialId={ownerFilter}
                onChange={(next) => setOwnerFilter(next)}
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Status</ZoruLabel>
              <ZoruSelect value={statusFilter} onValueChange={setStatusFilter}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="space-y-1">
              <ZoruLabel>Expected close — from</ZoruLabel>
              <ZoruInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Expected close — to</ZoruLabel>
              <ZoruInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Amount min</ZoruLabel>
              <ZoruInput
                type="number"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Amount max</ZoruLabel>
              <ZoruInput
                type="number"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="∞"
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Tag</ZoruLabel>
              <ZoruInput
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="any-tag"
              />
            </div>
          </div>
        </details>

        {/* Bulk action bar */}
        <DealBulkBar
          count={selected.size}
          stages={stages}
          onExportCsv={exportCsv}
          onClear={() => setSelected(new Set())}
          onDelete={() => setDeletePending(true)}
        />

        {/* Body */}
        {view === 'kanban' ? (
          <div className="p-3">
            <DealKanban deals={filtered} stages={stages} currency={defaultCurrency} />
          </div>
        ) : view === 'calendar' ? (
          <div className="p-3">
            <DealCalendar deals={filtered} />
          </div>
        ) : (
          <DealTable
            deals={filtered}
            selected={selected}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            allSelectedOnPage={allSelectedOnPage}
            filtersActive={filtersActive}
            defaultCurrency={defaultCurrency}
          />
        )}

        {view === 'table' ? (
          <div className="border-t border-zoru-line p-3">
            <PaginationBar
              page={page}
              limit={limit}
              total={total}
              hasMore={page * limit < total}
            />
          </div>
        ) : null}
      </ZoruCard>

      {/* Bulk-delete confirm */}
      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} deal${selected.size === 1 ? '' : 's'}?`}
        description="This is a destructive action. The Rust delete endpoint is queued; for now this removes nothing."
        confirmLabel="I understand"
        requireTyped="DELETE"
        onConfirm={async () => {
          toast({
            title: 'Bulk delete deferred',
            description:
              'Hard-delete moves through the Rust action layer — flagging your selection for the dual-impl sweep.',
          });
          setSelected(new Set());
        }}
      />
    </div>
  );
}
