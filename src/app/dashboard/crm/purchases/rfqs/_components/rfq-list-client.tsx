'use client';

import { Card, useZoruToast } from '@/components/zoruui';
/**
 * <RfqListClient> — canonical RFQs list view per
 * `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D (purchase-side mirror of
 * the canonical Quotations module).
 *
 * Ships:
 *   - 5-tile KPI strip (draft / open / closed / awarded / cancelled),
 *     each clickable.
 *   - 6 filters (status, owner, scope category, vendors-invited count,
 *     deadline-from, deadline-to).
 *   - Search across title + terms.
 *   - Bulk-action bar (archive · delete · export CSV · close · change
 *     status).
 *   - View switcher (table; kept for parity with deals).
 *   - 4 saved presets (All open · My drafts · Closing this week ·
 *     Awarded last 30d).
 *   - Density toggle + +New CTA.
 */

import * as React from 'react';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import type { CrmRfqStatus } from '@/lib/rust-client/crm-rfqs';
import {
  dateStamp,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

import { RfqTable } from './rfq-table';
import { RfqBulkBar } from './rfq-bulk-bar';
import { RfqFilters } from './rfq-filters';
import {
  RfqKpiStrip,
  RfqListToolbar,
  type Density,
  type PresetKey,
  type ViewMode,
} from './rfq-list-toolbar';
import { useRfqBulk } from './use-rfq-bulk';
import type { RfqKpiSummary, RfqListRow } from './types';

/* ─── Types ──────────────────────────────────────────────────────── */

interface RfqListClientProps {
  rfqs: RfqListRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: RfqKpiSummary;
  defaultCurrency: string;
  currentUserId?: string | null;
  error?: string;
}

const DENSITY_KEY = 'crm.rfqs.density';

/* ─── Helpers ────────────────────────────────────────────────────── */

function toCsv(rows: RfqListRow[]): string {
  const head = [
    'rfq_no',
    'title',
    'vendors_invited',
    'deadline',
    'required_by',
    'currency',
    'estimated_value',
    'status',
    'owner_id',
    'created_at',
  ];
  const body = rows.map((r) =>
    [
      r._id,
      r.title,
      r.vendorsInvitedCount,
      r.deadline ?? '',
      r.requiredBy ?? '',
      r.currency ?? '',
      r.estimatedValue ?? '',
      r.status,
      r.ownerId ?? '',
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

function matchVendorsBucket(count: number, bucket: string): boolean {
  if (bucket === 'all') return true;
  if (bucket === 'none') return count === 0;
  if (bucket === '1-2') return count >= 1 && count <= 2;
  if (bucket === '3-5') return count >= 3 && count <= 5;
  if (bucket === '6+') return count >= 6;
  return true;
}

/* ─── Component ──────────────────────────────────────────────────── */

export function RfqListClient({
  rfqs: serverRows,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  defaultCurrency,
  currentUserId,
  error,
}: RfqListClientProps) {
  const { toast } = useZoruToast();

  /* View + filters */
  const [view, setView] = React.useState<ViewMode>('table');
  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [ownerFilter, setOwnerFilter] = React.useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = React.useState<string>('all');
  const [vendorsInvitedFilter, setVendorsInvitedFilter] =
    React.useState<string>('all');
  const [deadlineFrom, setDeadlineFrom] = React.useState('');
  const [deadlineTo, setDeadlineTo] = React.useState('');
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

  /* Destructive-action confirms */
  const [archivePending, setArchivePending] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [closePending, setClosePending] = React.useState(false);

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

  /* Filtered list */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const dFrom = deadlineFrom ? new Date(deadlineFrom).getTime() : null;
    const dTo = deadlineTo ? new Date(deadlineTo).getTime() : null;

    return serverRows.filter((r) => {
      if (q) {
        const hay = `${r.title ?? ''} ${r.scope ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (ownerFilter && r.ownerId !== ownerFilter) return false;
      // Scope filter is a soft client-side hint until the wire shape
      // carries a `scopeCategory` field — match on title substring as
      // a usability nudge.
      if (scopeFilter !== 'all') {
        const hay = `${r.title ?? ''} ${r.scope ?? ''}`.toLowerCase();
        if (!hay.includes(scopeFilter)) return false;
      }
      if (!matchVendorsBucket(r.vendorsInvitedCount, vendorsInvitedFilter)) {
        return false;
      }
      if (dFrom && r.deadline) {
        const t = new Date(r.deadline).getTime();
        if (!Number.isNaN(t) && t < dFrom) return false;
      }
      if (dTo && r.deadline) {
        const t = new Date(r.deadline).getTime();
        if (!Number.isNaN(t) && t > dTo) return false;
      }
      return true;
    });
  }, [
    serverRows,
    query,
    statusFilter,
    ownerFilter,
    scopeFilter,
    vendorsInvitedFilter,
    deadlineFrom,
    deadlineTo,
  ]);

  /* Bulk selection */
  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));

  const toggleAll = React.useCallback(
    () =>
      setSelected((prev) => {
        if (filtered.length === 0) return prev;
        const allSel = filtered.every((r) => prev.has(r._id));
        if (allSel) {
          const next = new Set(prev);
          for (const r of filtered) next.delete(r._id);
          return next;
        }
        const next = new Set(prev);
        for (const r of filtered) next.add(r._id);
        return next;
      }),
    [filtered],
  );

  /* XLSX export — wraps the shared list-export helper. Kept beside
     `exportCsv` so column ordering stays identical across formats. */
  const exportXlsx = React.useCallback(async () => {
    const rows = filtered.filter((r) => selected.size === 0 || selected.has(r._id));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const headers = [
      'rfq_no',
      'title',
      'vendors_invited',
      'deadline',
      'required_by',
      'currency',
      'estimated_value',
      'status',
      'owner_id',
      'created_at',
    ];
    const out: ExportRow[] = rows.map((r) => ({
      rfq_no: r._id,
      title: r.title,
      vendors_invited: r.vendorsInvitedCount,
      deadline: r.deadline ?? '',
      required_by: r.requiredBy ?? '',
      currency: r.currency ?? '',
      estimated_value: r.estimatedValue ?? '',
      status: r.status,
      owner_id: r.ownerId ?? '',
      created_at: r.createdAt ?? '',
    }));
    await downloadXlsx(`rfqs-${dateStamp()}.xlsx`, headers, out, 'RFQs');
    toast({ title: 'Exported', description: `${rows.length} RFQs saved to XLSX.` });
  }, [filtered, selected, toast]);

  /* CSV export */
  const exportCsv = React.useCallback(() => {
    const rows = filtered.filter((r) => selected.size === 0 || selected.has(r._id));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfqs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${rows.length} RFQs saved to CSV.` });
  }, [filtered, selected, toast]);

  /* Clear all filters */
  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setOwnerFilter(null);
    setScopeFilter('all');
    setVendorsInvitedFilter('all');
    setDeadlineFrom('');
    setDeadlineTo('');
    setPreset('all');
  }, []);

  /* Presets */
  const applyPreset = React.useCallback(
    (key: PresetKey) => {
      setPreset(key);
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (key === 'all') {
        clearFilters();
        return;
      }
      if (key === 'all-open') {
        setStatusFilter('open');
        return;
      }
      if (key === 'my-drafts') {
        setStatusFilter('draft');
        setOwnerFilter(currentUserId ?? null);
        return;
      }
      if (key === 'closing-week') {
        const next7 = new Date(today.getTime() + 7 * 86_400_000);
        setStatusFilter('open');
        setDeadlineFrom(fmt(today));
        setDeadlineTo(fmt(next7));
        return;
      }
      if (key === 'awarded-30d') {
        setStatusFilter('awarded');
      }
    },
    [clearFilters, currentUserId],
  );

  /* Bulk handlers */
  const bulk = useRfqBulk({
    selected,
    onCleared: () => setSelected(new Set()),
  });

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    Boolean(ownerFilter) ||
    scopeFilter !== 'all' ||
    vendorsInvitedFilter !== 'all' ||
    Boolean(deadlineFrom) ||
    Boolean(deadlineTo);

  /* KPI segment clicks update the status filter. */
  const onKpiSegmentClick = React.useCallback(
    (segment: 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled') => {
      setStatusFilter(segment);
    },
    [],
  );

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <div className="flex w-full flex-col gap-5">
      <RfqKpiStrip kpi={kpi} onSegmentClick={onKpiSegmentClick} />

      {error ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
          {error}
        </div>
      ) : null}

      <ZoruCard className="overflow-hidden p-0">
        <RfqListToolbar
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

        <RfqFilters
          statusFilter={statusFilter}
          ownerFilter={ownerFilter}
          scopeFilter={scopeFilter}
          vendorsInvitedFilter={vendorsInvitedFilter}
          deadlineFrom={deadlineFrom}
          deadlineTo={deadlineTo}
          filtersActive={filtersActive}
          onStatusChange={setStatusFilter}
          onOwnerChange={setOwnerFilter}
          onScopeChange={setScopeFilter}
          onVendorsInvitedChange={setVendorsInvitedFilter}
          onDeadlineFromChange={setDeadlineFrom}
          onDeadlineToChange={setDeadlineTo}
          onClear={clearFilters}
        />

        <RfqBulkBar
          count={selected.size}
          onExportCsv={exportCsv}
          onExportXlsx={exportXlsx}
          onClear={() => setSelected(new Set())}
          onArchive={() => setArchivePending(true)}
          onDelete={() => setDeletePending(true)}
          onClose={() => setClosePending(true)}
          onChangeStatus={bulk.changeStatus as (s: CrmRfqStatus) => void}
        />

        <RfqTable
          rfqs={filtered}
          selected={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          allSelectedOnPage={allSelectedOnPage}
          filtersActive={filtersActive}
          defaultCurrency={defaultCurrency}
          density={density}
        />

        <PaginationBar page={page} limit={limit} hasMore={hasMore} />
      </ZoruCard>

      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${selected.size} RFQ${selected.size === 1 ? '' : 's'}?`}
        description="Archived RFQs are flipped to `cancelled` but remain in the database."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulk.archive()}
      />

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} RFQ${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected RFQs. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={async () => bulk.remove()}
      />

      <ConfirmDialog
        open={closePending}
        onOpenChange={setClosePending}
        title={`Close ${selected.size} RFQ${selected.size === 1 ? '' : 's'}?`}
        description="Closed RFQs stop accepting new vendor bids. You can still award an existing bid."
        confirmLabel="Close"
        confirmTone="primary"
        onConfirm={async () => bulk.close()}
      />

      {bulk.pending ? <span className="sr-only">Working…</span> : null}
    </div>
  );
}
