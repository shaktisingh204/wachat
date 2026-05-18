'use client';

import {
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
/**
 * <DealListClient> — canonical Deals list view per CRM_REBUILD_PLAN §1D.
 *
 * Ships:
 *   - KPI strip (open count, open value, won/lost this month, win rate, avg cycle)
 *   - View switcher (table | kanban | calendar)
 *   - Filters (pipeline → stage cascade, owner, status, date range, amount range, tags)
 *   - Saved filter presets ("All", "My open", "Closing this week", "At-risk", "Won")
 *   - Density toggle (Comfortable / Compact / Dense)
 *   - Search across title + client name
 *   - Bulk-action bar (archive / delete / export CSV / change-stage / assign-to)
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import { DealKanban } from './deal-kanban';
import { DealCalendar } from './deal-calendar';
import { DealTable } from './deal-table';
import { DealBulkBar } from './deal-bulk-bar';
import {
  DealKpiStrip,
  DealListToolbar,
  type Density,
  type PresetKey,
  type ViewMode,
} from './deal-list-toolbar';
import { useDealBulk } from './use-deal-bulk';
import type { DealKpiSummary, DealListRow } from './types';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface DealListClientProps {
  deals: DealListRow[];
  total: number;
  page: number;
  limit: number;
  initialQuery: string;
  kpi: DealKpiSummary;
  stages: string[];
  defaultCurrency: string;
  currentUserId?: string | null;
  error?: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const DENSITY_KEY = 'crm.deals.density';

/* ─── Helpers ────────────────────────────────────────────────────────── */

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

function countWonLost(rows: DealListRow[]): { won: number; lost: number } {
  let won = 0;
  let lost = 0;
  for (const r of rows) {
    const s = deriveStatus(r.stage);
    if (s === 'won') won++;
    else if (s === 'lost') lost++;
  }
  return { won, lost };
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
  currentUserId,
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
  const [probMax, setProbMax] = React.useState('');
  const [preset, setPreset] = React.useState<PresetKey>('all');
  const [density, setDensity] = React.useState<Density>('comfortable');

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggleRow = React.useCallback(
    (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  /* Confirm dialog state */
  const [deletePending, setDeletePending] = React.useState(false);
  const [archivePending, setArchivePending] = React.useState(false);

  /* Hydrate density from localStorage on mount. */
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DENSITY_KEY);
      if (raw === 'comfortable' || raw === 'compact' || raw === 'dense') {
        setDensity(raw);
      }
    } catch {
      // ignore — localStorage unavailable
    }
  }, []);

  const handleDensityChange = React.useCallback((next: Density) => {
    setDensity(next);
    try {
      window.localStorage.setItem(DENSITY_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  /* Filtered + sorted view */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = amountMin ? Number(amountMin) : Number.NEGATIVE_INFINITY;
    const max = amountMax ? Number(amountMax) : Number.POSITIVE_INFINITY;
    const probMaxN = probMax ? Number(probMax) : Number.POSITIVE_INFINITY;
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
      if (typeof d.probability === 'number' && d.probability > probMaxN) return false;
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
    probMax,
    tagFilter,
  ]);

  /* Bulk actions */
  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((d) => selected.has(d._id));
  const toggleAll = React.useCallback(
    () =>
      setSelected((prev) => {
        if (filtered.length === 0) return prev;
        const allSel = filtered.every((d) => prev.has(d._id));
        if (allSel) {
          const next = new Set(prev);
          for (const d of filtered) next.delete(d._id);
          return next;
        }
        const next = new Set(prev);
        for (const d of filtered) next.add(d._id);
        return next;
      }),
    [filtered],
  );

  const exportCsv = React.useCallback(() => {
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
  }, [filtered, selected, toast]);

  const clearFilters = React.useCallback(() => {
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
    setProbMax('');
    setPreset('all');
  }, []);

  /* Saved filter presets */
  const applyPreset = React.useCallback(
    (key: PresetKey) => {
      setPreset(key);
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (key === 'all') {
        clearFilters();
        return;
      }
      if (key === 'my-open') {
        setStatusFilter('open');
        setOwnerFilter(currentUserId ?? null);
        setFromDate('');
        setToDate('');
        setProbMax('');
        return;
      }
      if (key === 'closing-week') {
        const next7 = new Date(today.getTime() + 7 * 86_400_000);
        setStatusFilter('open');
        setFromDate(fmt(today));
        setToDate(fmt(next7));
        setProbMax('');
        return;
      }
      if (key === 'at-risk') {
        const next14 = new Date(today.getTime() + 14 * 86_400_000);
        setStatusFilter('open');
        setProbMax('30');
        setFromDate('');
        setToDate(fmt(next14));
        return;
      }
      if (key === 'won') {
        setStatusFilter('won');
        setOwnerFilter(null);
        setFromDate('');
        setToDate('');
        setProbMax('');
      }
    },
    [clearFilters, currentUserId],
  );

  /* Bulk action handlers */
  const bulk = useDealBulk({
    selected,
    onCleared: () => setSelected(new Set()),
  });

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
    Boolean(amountMax) ||
    Boolean(probMax);

  /* KPI: win rate. */
  const winRate = React.useMemo(() => {
    const { won, lost } = countWonLost(serverDeals);
    const total = won + lost;
    if (total === 0) return null;
    return Math.round((won / total) * 1000) / 10;
  }, [serverDeals]);

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="flex w-full flex-col gap-5">
      {/* KPI strip */}
      <DealKpiStrip
        kpi={kpi}
        defaultCurrency={defaultCurrency}
        winRate={winRate}
        onWinRateClick={() => setStatusFilter('won')}
      />

      {error ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
          {error}
        </div>
      ) : null}

      <ZoruCard className="overflow-hidden p-0">
        {/* Toolbar */}
        <DealListToolbar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          density={density}
          onDensityChange={handleDensityChange}
          preset={preset}
          onPresetChange={applyPreset}
          onExportCsv={exportCsv}
        />

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
              <ZoruLabel>Probability max %</ZoruLabel>
              <ZoruInput
                type="number"
                value={probMax}
                onChange={(e) => setProbMax(e.target.value)}
                placeholder="100"
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
          onArchive={() => setArchivePending(true)}
          onDelete={() => setDeletePending(true)}
          onChangeStage={bulk.changeStage}
          onAssign={bulk.assign}
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
            density={density}
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

      {/* Bulk-archive confirm */}
      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${selected.size} deal${selected.size === 1 ? '' : 's'}?`}
        description="Archived deals are hidden from default views but can be restored later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulk.archive()}
      />

      {/* Bulk-delete confirm */}
      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} deal${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected deals. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={async () => bulk.remove()}
      />

      {bulk.pending ? <span className="sr-only">Working…</span> : null}
    </div>
  );
}
