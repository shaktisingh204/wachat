'use client';

import { Card, useZoruToast } from '@/components/zoruui';
/**
 * <VendorBidListClient> — canonical Vendor Bids list view per
 * `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D (thin spec).
 *
 * Ships:
 *   - 5-tile KPI strip (draft / submitted / shortlisted / awarded /
 *     rejected), each clickable.
 *   - 6 filters (status, linked RFQ id, vendor, submitted-from,
 *     submitted-to, lead-time bucket).
 *   - Search across vendor name + terms.
 *   - Bulk-action bar (archive · delete · export CSV · change status).
 *   - Density toggle + +New CTA.
 *
 * Per the scope-cap rule, saved presets are intentionally omitted —
 * the §1D thin spec for the purchase-side mirror.
 */

import * as React from 'react';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import type { CrmVendorBidStatus } from '@/lib/rust-client/crm-vendor-bids';

import { VendorBidTable } from './vendor-bid-table';
import { VendorBidBulkBar } from './vendor-bid-bulk-bar';
import { VendorBidFilters } from './vendor-bid-filters';
import {
  VendorBidKpiStrip,
  VendorBidListToolbar,
  type Density,
  type ViewMode,
} from './vendor-bid-list-toolbar';
import { useVendorBidBulk } from './use-vendor-bid-bulk';
import type { VendorBidKpiSummary, VendorBidListRow } from './types';

/* ─── Types ──────────────────────────────────────────────────────── */

interface VendorBidListClientProps {
  bids: VendorBidListRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: VendorBidKpiSummary;
  defaultCurrency: string;
  error?: string;
}

const DENSITY_KEY = 'crm.vendor-bids.density';

/* ─── Helpers ────────────────────────────────────────────────────── */

function toCsv(rows: VendorBidListRow[]): string {
  const head = [
    'bid_no',
    'vendor_id',
    'vendor_name',
    'rfq_id',
    'submitted_at',
    'currency',
    'total',
    'lead_time_days',
    'status',
    'created_at',
  ];
  const body = rows.map((r) =>
    [
      r.bidNo,
      r.vendorId,
      r.vendorName ?? '',
      r.rfqId ?? '',
      r.submittedAt ?? '',
      r.currency ?? '',
      r.total ?? '',
      r.leadTimeDays ?? '',
      r.status,
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

function matchLeadBucket(value: number | undefined, bucket: string): boolean {
  if (bucket === 'all') return true;
  if (value == null) return false;
  if (bucket === '0-7') return value >= 0 && value <= 7;
  if (bucket === '8-30') return value >= 8 && value <= 30;
  if (bucket === '31-60') return value >= 31 && value <= 60;
  if (bucket === '61+') return value >= 61;
  return true;
}

/* ─── Component ──────────────────────────────────────────────────── */

export function VendorBidListClient({
  bids: serverRows,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  defaultCurrency,
  error,
}: VendorBidListClientProps) {
  const { toast } = useZoruToast();

  /* View + filters */
  const [view, setView] = React.useState<ViewMode>('table');
  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [rfqIdFilter, setRfqIdFilter] = React.useState<string>('');
  const [vendorIdFilter, setVendorIdFilter] = React.useState<string | null>(null);
  const [submittedFrom, setSubmittedFrom] = React.useState('');
  const [submittedTo, setSubmittedTo] = React.useState('');
  const [leadTimeFilter, setLeadTimeFilter] = React.useState<string>('all');
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
    const sFrom = submittedFrom ? new Date(submittedFrom).getTime() : null;
    const sTo = submittedTo ? new Date(submittedTo).getTime() : null;
    const rfqQ = rfqIdFilter.trim().toLowerCase();

    return serverRows.filter((r) => {
      if (q) {
        const hay = `${r.vendorName ?? ''} ${r.bidNo} ${r.vendorId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (rfqQ && (r.rfqId ?? '').toLowerCase() !== rfqQ) return false;
      if (vendorIdFilter && r.vendorId !== vendorIdFilter) return false;
      if (sFrom && r.submittedAt) {
        const t = new Date(r.submittedAt).getTime();
        if (!Number.isNaN(t) && t < sFrom) return false;
      }
      if (sTo && r.submittedAt) {
        const t = new Date(r.submittedAt).getTime();
        if (!Number.isNaN(t) && t > sTo) return false;
      }
      if (!matchLeadBucket(r.leadTimeDays, leadTimeFilter)) return false;
      return true;
    });
  }, [
    serverRows,
    query,
    statusFilter,
    rfqIdFilter,
    vendorIdFilter,
    submittedFrom,
    submittedTo,
    leadTimeFilter,
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
    a.download = `vendor-bids-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${rows.length} vendor bids saved to CSV.` });
  }, [filtered, selected, toast]);

  /* Clear all filters */
  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setRfqIdFilter('');
    setVendorIdFilter(null);
    setSubmittedFrom('');
    setSubmittedTo('');
    setLeadTimeFilter('all');
  }, []);

  /* Bulk handlers */
  const bulk = useVendorBidBulk({
    selected,
    onCleared: () => setSelected(new Set()),
  });

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    Boolean(rfqIdFilter) ||
    Boolean(vendorIdFilter) ||
    Boolean(submittedFrom) ||
    Boolean(submittedTo) ||
    leadTimeFilter !== 'all';

  /* KPI segment clicks update the status filter. */
  const onKpiSegmentClick = React.useCallback(
    (segment: 'draft' | 'submitted' | 'shortlisted' | 'awarded' | 'rejected') => {
      setStatusFilter(segment);
    },
    [],
  );

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <div className="flex w-full flex-col gap-5">
      <VendorBidKpiStrip kpi={kpi} onSegmentClick={onKpiSegmentClick} />

      {error ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <VendorBidListToolbar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          density={density}
          onDensityChange={handleDensityChange}
          onExportCsv={exportCsv}
        />

        <VendorBidFilters
          statusFilter={statusFilter}
          rfqIdFilter={rfqIdFilter}
          vendorIdFilter={vendorIdFilter}
          submittedFrom={submittedFrom}
          submittedTo={submittedTo}
          leadTimeFilter={leadTimeFilter}
          filtersActive={filtersActive}
          onStatusChange={setStatusFilter}
          onRfqIdChange={setRfqIdFilter}
          onVendorIdChange={setVendorIdFilter}
          onSubmittedFromChange={setSubmittedFrom}
          onSubmittedToChange={setSubmittedTo}
          onLeadTimeChange={setLeadTimeFilter}
          onClear={clearFilters}
        />

        <VendorBidBulkBar
          count={selected.size}
          onExportCsv={exportCsv}
          onClear={() => setSelected(new Set())}
          onArchive={() => setArchivePending(true)}
          onDelete={() => setDeletePending(true)}
          onChangeStatus={bulk.changeStatus as (s: CrmVendorBidStatus) => void}
        />

        <VendorBidTable
          bids={filtered}
          selected={selected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          allSelectedOnPage={allSelectedOnPage}
          filtersActive={filtersActive}
          defaultCurrency={defaultCurrency}
          density={density}
        />

        <PaginationBar page={page} limit={limit} hasMore={hasMore} />
      </Card>

      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${selected.size} vendor bid${selected.size === 1 ? '' : 's'}?`}
        description="Archived bids are flipped to `withdrawn` but remain in the database."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulk.archive()}
      />

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} vendor bid${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected vendor bids. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={async () => bulk.remove()}
      />

      {bulk.pending ? <span className="sr-only">Working…</span> : null}
    </div>
  );
}
