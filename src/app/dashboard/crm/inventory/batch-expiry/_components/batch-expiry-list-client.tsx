'use client';

/**
 * <BatchExpiryListClient> — canonical batch-expiry list view.
 *
 * Ships:
 *   - KPI strip (total batches, expiring in 30d, expired, near-expiry value)
 *   - Filter row (search by item name / batch no, status, warehouse)
 *   - Checkbox row selection
 *   - Bulk bar (write-off → archived, delete, export CSV / XLSX)
 *   - Per-row edit / delete actions (via existing <BatchExpiryTable>)
 *   - Export CSV + XLSX at toolbar level
 *   - New batch CTA
 *
 * Per CRM_REBUILD_PLAN §1D.
 */

import * as React from 'react';
import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Archive,
  Download,
  Edit,
  ListChecks,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';
import {
  deleteCrmItemBatch,
  saveCrmItemBatch,
} from '@/app/actions/crm-item-batches.actions';
import type {
  CrmItemBatchDoc,
  CrmItemBatchStatus,
} from '@/app/actions/crm-item-batches.actions';

/* ─── KPI types ─────────────────────────────────────────────────── */

export interface BatchExpiryKpi {
  total: number;
  expired: number;
  expiringIn30: number;
  nearExpiryValue: number;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const SOON_DAYS = 30;

function daysUntil(expiry: string | undefined): number | null {
  if (!expiry) return null;
  const d = new Date(expiry).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((d - Date.now()) / 86_400_000);
}

interface ExpiryFlag {
  expired: boolean;
  soon: boolean;
  daysLeft: number | null;
}

function expiryFlag(expiry: string | undefined): ExpiryFlag {
  const days = daysUntil(expiry);
  if (days == null) return { expired: false, soon: false, daysLeft: null };
  return {
    expired: days < 0,
    soon: days >= 0 && days <= SOON_DAYS,
    daysLeft: days,
  };
}

function statusToneFor(b: CrmItemBatchDoc, flag: ExpiryFlag): StatusTone {
  if (b.status === 'recalled') return 'red';
  if (b.status === 'archived') return 'neutral';
  if (flag.expired) return 'red';
  if (flag.soon) return 'amber';
  return 'green';
}

function statusLabelFor(b: CrmItemBatchDoc, flag: ExpiryFlag): string {
  if (b.status === 'recalled') return 'recalled';
  if (b.status === 'archived') return 'archived';
  if (flag.expired) return 'expired';
  if (flag.soon && flag.daysLeft != null) return `expires in ${flag.daysLeft}d`;
  return b.status ?? 'active';
}

function fmtDate(v: string | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(v: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
}

/* ─── KPI strip ──────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'danger' | 'warning' | 'neutral';
  active?: boolean;
  onClick?: () => void;
}) {
  const borderCls = active ? 'border-zoru-primary ring-1 ring-zoru-primary' : 'border-zoru-line';
  const valueCls =
    tone === 'danger'
      ? 'text-red-700 dark:text-red-400'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-zoru-ink';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col gap-1 rounded-lg border bg-zoru-surface p-3 text-left transition hover:border-zoru-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
        borderCls,
        onClick ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      <span className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </span>
      <span className={['text-xl font-semibold', valueCls].join(' ')}>
        {value}
      </span>
    </button>
  );
}

/* ─── Props ──────────────────────────────────────────────────────── */

interface BatchExpiryListClientProps {
  batches: CrmItemBatchDoc[];
  kpi: BatchExpiryKpi;
}

/* ─── Statuses for the filter dropdown ───────────────────────────── */

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'recalled', label: 'Recalled' },
  { value: 'archived', label: 'Archived' },
];

const EXPIRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Any expiry' },
  { value: 'expired', label: 'Already expired' },
  { value: 'soon', label: 'Expiring in 30 days' },
  { value: 'safe', label: 'Safe (> 30 days)' },
];

/* ─── Component ──────────────────────────────────────────────────── */

export function BatchExpiryListClient({
  batches: serverBatches,
  kpi,
}: BatchExpiryListClientProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [bulkPending, startBulkTransition] = React.useTransition();

  /* Filters */
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [expiryFilter, setExpiryFilter] = React.useState('all');
  const [locationFilter, setLocationFilter] = React.useState('');
  const [kpiFilter, setKpiFilter] = React.useState<'all' | 'expired' | 'expiring30'>('all');

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Dialogs */
  const [writeOffPending, setWriteOffPending] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = React.useState<CrmItemBatchDoc | null>(null);
  const [singleDeletePending, startSingleDeleteTransition] = React.useTransition();

  /* Derive unique locations for filter */
  const locationOptions = React.useMemo(() => {
    const ids = new Set<string>();
    for (const b of serverBatches) {
      if (b.locationId) ids.add(b.locationId);
    }
    return Array.from(ids).sort();
  }, [serverBatches]);

  /* Filtered list */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return serverBatches.filter((b) => {
      if (q) {
        const hay = `${b.itemName ?? ''} ${b.batchNumber ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (locationFilter && b.locationId !== locationFilter) return false;

      /* Expiry bucket filter */
      const flag = expiryFlag(b.expiryDate);
      if (expiryFilter === 'expired' && !flag.expired) return false;
      if (expiryFilter === 'soon' && !flag.soon) return false;
      if (expiryFilter === 'safe' && (flag.expired || flag.soon)) return false;

      /* KPI tile filter */
      if (kpiFilter === 'expired' && !flag.expired) return false;
      if (kpiFilter === 'expiring30' && !(flag.soon && !flag.expired)) return false;

      return true;
    });
  }, [serverBatches, query, statusFilter, locationFilter, expiryFilter, kpiFilter]);

  /* Selection helpers */
  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((b) => selected.has(b._id));

  const toggleRow = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      if (filtered.length === 0) return prev;
      const allSel = filtered.every((b) => prev.has(b._id));
      if (allSel) {
        const next = new Set(prev);
        for (const b of filtered) next.delete(b._id);
        return next;
      }
      const next = new Set(prev);
      for (const b of filtered) next.add(b._id);
      return next;
    });
  }, [filtered]);

  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setExpiryFilter('all');
    setLocationFilter('');
    setKpiFilter('all');
  }, []);

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    expiryFilter !== 'all' ||
    Boolean(locationFilter) ||
    kpiFilter !== 'all';

  /* Export */
  const EXPORT_HEADERS = [
    'Item',
    'Batch no.',
    'Manufacture date',
    'Expiry date',
    'Qty',
    'Unit',
    'Cost price',
    'Location',
    'Status',
  ];

  const toExportRows = React.useCallback(
    (rows: CrmItemBatchDoc[]): ExportRow[] =>
      rows.map((b) => ({
        'Item': b.itemName,
        'Batch no.': b.batchNumber,
        'Manufacture date': fmtDate(b.manufactureDate),
        'Expiry date': fmtDate(b.expiryDate),
        'Qty': b.quantity,
        'Unit': b.unit ?? '',
        'Cost price': b.costPrice ?? '',
        'Location': b.locationId ?? '',
        'Status': b.status,
      })),
    [],
  );

  const exportRows = React.useCallback(
    () => filtered.filter((b) => selected.size === 0 || selected.has(b._id)),
    [filtered, selected],
  );

  const handleExportCsv = React.useCallback(() => {
    const rows = exportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    downloadCsv(`batch-expiry-${dateStamp()}.csv`, EXPORT_HEADERS, toExportRows(rows));
    toast({ title: 'Exported', description: `${rows.length} batches saved to CSV.` });
  }, [exportRows, toExportRows, toast, EXPORT_HEADERS]);

  const handleExportXlsx = React.useCallback(async () => {
    const rows = exportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    await downloadXlsx(
      `batch-expiry-${dateStamp()}.xlsx`,
      EXPORT_HEADERS,
      toExportRows(rows),
      'Batches',
    );
    toast({ title: 'Exported', description: `${rows.length} batches saved to XLSX.` });
  }, [exportRows, toExportRows, toast, EXPORT_HEADERS]);

  /* Bulk write-off: set status to 'archived' */
  const runBulkWriteOff = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const fd = new FormData();
        fd.set('batchId', id);
        // We need itemName + batchNumber to pass validation; fetch from local state
        const batch = serverBatches.find((b) => b._id === id);
        if (!batch) continue;
        fd.set('itemName', batch.itemName);
        fd.set('batchNumber', batch.batchNumber);
        fd.set('quantity', String(batch.quantity));
        fd.set('status', 'archived' satisfies CrmItemBatchStatus);
        const res = await saveCrmItemBatch(undefined, fd);
        if (!res.error) ok += 1;
      }
      toast({ title: `${ok} batch${ok === 1 ? '' : 'es'} written off` });
      setSelected(new Set());
      setWriteOffPending(false);
      router.refresh();
    });
  }, [selected, serverBatches, router, toast]);

  /* Bulk delete */
  const runBulkDelete = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await deleteCrmItemBatch(id);
        if (res.success) ok += 1;
      }
      toast({ title: `${ok} batch${ok === 1 ? '' : 'es'} deleted` });
      setSelected(new Set());
      setDeletePending(false);
      router.refresh();
    });
  }, [selected, router, toast]);

  /* Single delete */
  const handleSingleDelete = React.useCallback(() => {
    if (!singleDeleteTarget) return;
    const id = singleDeleteTarget._id;
    startSingleDeleteTransition(async () => {
      const res = await deleteCrmItemBatch(id);
      if (res.success) {
        toast({ title: 'Batch deleted' });
        router.refresh();
      } else {
        toast({ title: 'Error', description: res.error ?? 'Could not delete batch.', variant: 'destructive' });
      }
      setSingleDeleteTarget(null);
    });
  }, [singleDeleteTarget, router, toast]);

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <>
      <EntityListShell
        title="Batch Expiry"
        subtitle="Track manufacture and expiry dates for batch-managed items to reduce wastage."
        primaryAction={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/inventory/batch-expiry/new">
              <Plus className="h-4 w-4" /> New batch
            </Link>
          </ZoruButton>
        }
      >
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Total batches"
            value={kpi.total.toLocaleString()}
            active={kpiFilter === 'all'}
            onClick={() => setKpiFilter('all')}
          />
          <KpiCard
            label="Expiring in 30 days"
            value={kpi.expiringIn30.toLocaleString()}
            tone="warning"
            active={kpiFilter === 'expiring30'}
            onClick={() =>
              setKpiFilter((prev) => (prev === 'expiring30' ? 'all' : 'expiring30'))
            }
          />
          <KpiCard
            label="Expired"
            value={kpi.expired.toLocaleString()}
            tone="danger"
            active={kpiFilter === 'expired'}
            onClick={() =>
              setKpiFilter((prev) => (prev === 'expired' ? 'all' : 'expired'))
            }
          />
          <KpiCard
            label="Near-expiry value"
            value={fmtMoney(kpi.nearExpiryValue)}
            tone="warning"
          />
        </div>

        <ZoruCard className="overflow-hidden p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
              <ZoruInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search item name or batch no…"
                className="h-9 pl-9 text-[13px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5" /> CSV
              </ZoruButton>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => void handleExportXlsx()}
              >
                <Download className="h-3.5 w-3.5" /> XLSX
              </ZoruButton>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-end gap-3 border-b border-zoru-line bg-zoru-surface-2/40 px-3 py-2">
            <div className="space-y-1">
              <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Status
              </ZoruLabel>
              <ZoruSelect value={statusFilter} onValueChange={setStatusFilter}>
                <ZoruSelectTrigger className="h-8 w-[150px]">
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
              <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Expiry
              </ZoruLabel>
              <ZoruSelect value={expiryFilter} onValueChange={setExpiryFilter}>
                <ZoruSelectTrigger className="h-8 w-[180px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {EXPIRY_OPTIONS.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {locationOptions.length > 0 ? (
              <div className="space-y-1">
                <ZoruLabel className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                  Warehouse
                </ZoruLabel>
                <ZoruSelect
                  value={locationFilter || 'all'}
                  onValueChange={(v) => setLocationFilter(v === 'all' ? '' : v)}
                >
                  <ZoruSelectTrigger className="h-8 w-[180px]">
                    <ZoruSelectValue placeholder="All warehouses" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All warehouses</ZoruSelectItem>
                    {locationOptions.map((id) => (
                      <ZoruSelectItem key={id} value={id}>
                        {id}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            ) : null}

            {filtersActive ? (
              <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </ZoruButton>
            ) : null}
          </div>

          {/* Bulk bar */}
          {selected.size > 0 ? (
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <ListChecks className="h-4 w-4 text-zoru-primary" />
                {selected.size} selected
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setWriteOffPending(true)}
                  disabled={bulkPending}
                >
                  <Archive className="h-3.5 w-3.5" /> Write off
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={handleExportCsv}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => void handleExportXlsx()}
                >
                  <Download className="h-3.5 w-3.5" /> XLSX
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeletePending(true)}
                  disabled={bulkPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </ZoruButton>
              </div>
            </div>
          ) : null}

          {/* Table */}
          <div className="overflow-x-auto">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="w-10 pl-3">
                    <ZoruCheckbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAll}
                      aria-label="Select all visible batches"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Item</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Batch no.</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Manufacture</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Expiry</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">Qty</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                  <ZoruTableHead className="text-right text-zoru-ink-muted">
                    Actions
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filtered.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={8}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {filtersActive
                        ? 'No batches match the current filters.'
                        : 'No batches yet. Add one to start tracking expiry.'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filtered.map((b) => {
                    const flag = expiryFlag(b.expiryDate);
                    const danger = flag.expired || flag.soon;
                    return (
                      <ZoruTableRow
                        key={b._id}
                        className={
                          flag.expired
                            ? 'border-zoru-line bg-red-50 dark:bg-red-950/30'
                            : flag.soon
                              ? 'border-zoru-line bg-amber-50/50 dark:bg-amber-950/20'
                              : 'border-zoru-line'
                        }
                      >
                        <ZoruTableCell className="pl-3">
                          <ZoruCheckbox
                            checked={selected.has(b._id)}
                            onCheckedChange={() => toggleRow(b._id)}
                            aria-label={`Select ${b.batchNumber}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <EntityRowLink
                            href={`/dashboard/crm/inventory/batch-expiry/${b._id}`}
                            label={b.itemName}
                            subtitle={
                              b.itemId
                                ? `Item ID ${b.itemId.slice(-6)}`
                                : undefined
                            }
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                          {b.batchNumber}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                          {fmtDate(b.manufactureDate)}
                        </ZoruTableCell>
                        <ZoruTableCell
                          className={
                            danger
                              ? 'text-[13px] font-medium text-red-700 dark:text-red-300'
                              : 'text-[13px] text-zoru-ink-muted'
                          }
                        >
                          {fmtDate(b.expiryDate)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right font-mono text-[13px] text-zoru-ink">
                          {b.quantity}
                          {b.unit ? ` ${b.unit}` : ''}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill
                            label={statusLabelFor(b, flag)}
                            tone={statusToneFor(b, flag)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ZoruButton variant="ghost" size="icon" asChild>
                              <Link
                                href={`/dashboard/crm/inventory/batch-expiry/${b._id}/edit`}
                                aria-label={`Edit ${b.batchNumber}`}
                              >
                                <Edit className="h-4 w-4 text-zoru-ink-muted" />
                              </Link>
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="icon"
                              onClick={() => setSingleDeleteTarget(b)}
                              aria-label={`Delete ${b.batchNumber}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </ZoruButton>
                          </div>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>

          {/* Summary row */}
          {filtered.length > 0 ? (
            <div className="border-t border-zoru-line px-3 py-2 text-[12px] text-zoru-ink-muted">
              Showing {filtered.length} of {serverBatches.length} batch
              {serverBatches.length === 1 ? '' : 'es'}
              {filtersActive ? ' (filtered)' : ''}
            </div>
          ) : null}
        </ZoruCard>

        {bulkPending ? <span className="sr-only">Working…</span> : null}
      </EntityListShell>

      {/* Bulk write-off confirm */}
      <ConfirmDialog
        open={writeOffPending}
        onOpenChange={setWriteOffPending}
        title={`Write off ${selected.size} batch${selected.size === 1 ? '' : 'es'}?`}
        description="Sets the selected batches to Archived. Stock will no longer be counted as available. This can be reversed by editing each batch."
        confirmLabel="Write off"
        confirmTone="primary"
        onConfirm={runBulkWriteOff}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} batch${selected.size === 1 ? '' : 'es'}?`}
        description="This permanently removes the selected batches. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={runBulkDelete}
      />

      {/* Single delete confirm */}
      <ConfirmDialog
        open={!!singleDeleteTarget}
        onOpenChange={(o) => !o && setSingleDeleteTarget(null)}
        title="Delete batch?"
        description={`Deleting batch "${singleDeleteTarget?.batchNumber}" removes it permanently. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleSingleDelete}
      />
    </>
  );
}
