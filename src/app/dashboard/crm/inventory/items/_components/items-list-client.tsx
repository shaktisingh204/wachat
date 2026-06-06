'use client';

import { Card, useZoruToast } from '@/components/sabcrm/20ui/compat';
/**
 * <ItemsListClient> — canonical Items list view per CRM_REBUILD_PLAN §1D.
 *
 * Ships:
 *   - KPI strip (total SKUs, active, low stock, out of stock, inventory value)
 *   - View switcher (table | grid)
 *   - Filters (status, category, brand, vendor, tax rate, type, unit,
 *     trackInventory bool)
 *   - Saved filter presets (All, Active, Low stock, Out of stock, Archived)
 *   - Density toggle (Comfortable / Compact / Dense)
 *   - Search across name, SKU, barcode, HSN
 *   - Bulk-action bar (archive / delete / export CSV / bulk-edit /
 *     adjust stock / sync price)
 */

import * as React from 'react';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  dateStamp,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

import { ItemsKpiStrip } from './items-kpi-strip';
import { ItemsToolbar } from './items-toolbar';
import { ItemsBulkBar, type ItemsBulkEditField } from './items-bulk-bar';
import { ItemsTable } from './items-table';
import { ItemsGrid } from './items-grid';
import { ItemsFilters } from './items-filters';
import { useItemsBulk } from './use-items-bulk';
import type {
  ItemDensity,
  ItemKpiSnapshot,
  ItemListRow,
  ItemPresetKey,
  ItemViewMode,
} from './types';
import { isLowStock, isOutOfStock } from './types';

interface ItemsListClientProps {
  items: ItemListRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: ItemKpiSnapshot;
  defaultCurrency: string;
  error?: string;
}

const DENSITY_KEY = 'crm.items.density';

function toCsv(rows: ItemListRow[]): string {
  const head = [
    'name',
    'sku',
    'barcode',
    'hsn',
    'type',
    'currency',
    'costPrice',
    'sellingPrice',
    'taxRate',
    'totalStock',
    'reorderPoint',
    'status',
    'createdAt',
  ];
  const body = rows.map((r) =>
    [
      r.name,
      r.sku,
      r.barcode ?? '',
      r.hsnSac ?? '',
      r.itemType ?? '',
      r.currency,
      r.costPrice,
      r.sellingPrice,
      r.taxRate ?? '',
      r.totalStock,
      r.reorderPoint ?? '',
      r.status ?? '',
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

export function ItemsListClient({
  items: serverItems,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  defaultCurrency,
  error,
}: ItemsListClientProps) {
  const { toast } = useZoruToast();

  /* WebSocket for live inventory tracking */
  React.useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/realtime/inventory`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'INVENTORY_UPDATE') {
             // Handle live update
             toast({ title: 'Live Update', description: 'Inventory updated in real-time.' });
          }
        } catch (err) {
          console.error('Failed to parse websocket message', err);
        }
      };
    } catch (e) {
      console.error('Failed to connect WebSocket', e);
    }
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [toast]);

  /* View + density */
  const [view, setView] = React.useState<ItemViewMode>('table');
  const [density, setDensity] = React.useState<ItemDensity>('comfortable');

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DENSITY_KEY);
      if (raw === 'comfortable' || raw === 'compact' || raw === 'dense') {
        setDensity(raw);
      }
    } catch {
      /* ignore */
    }
  }, []);
  const handleDensityChange = React.useCallback((next: ItemDensity) => {
    setDensity(next);
    try {
      window.localStorage.setItem(DENSITY_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  /* Filters */
  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [brandFilter, setBrandFilter] = React.useState<string | null>(null);
  const [vendorFilter, setVendorFilter] = React.useState<string | null>(null);
  const [taxRateFilter, setTaxRateFilter] = React.useState<string | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [unitFilter, setUnitFilter] = React.useState<string | null>(null);
  const [trackFilter, setTrackFilter] = React.useState<string>('all');
  const [preset, setPreset] = React.useState<ItemPresetKey>('all');

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

  /* Confirm dialogs */
  const [deletePending, setDeletePending] = React.useState(false);
  const [archivePending, setArchivePending] = React.useState(false);

  /* Filtered view */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return serverItems.filter((item) => {
      if (q) {
        const hay = [
          item.name,
          item.sku,
          item.barcode ?? '',
          item.hsnSac ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const s = (item.status ?? 'active').toLowerCase();
      if (statusFilter !== 'all' && s !== statusFilter) return false;
      if (categoryFilter && item.categoryId !== categoryFilter) return false;
      if (brandFilter && item.brandId !== brandFilter) return false;
      if (vendorFilter && !(item.vendorIds ?? []).includes(vendorFilter))
        return false;
      if (taxRateFilter && item.taxRateId !== taxRateFilter) return false;
      if (typeFilter !== 'all' && (item.itemType ?? 'goods') !== typeFilter)
        return false;
      if (unitFilter && item.unitId !== unitFilter) return false;
      if (trackFilter === 'tracked' && !item.isTrackInventory) return false;
      if (trackFilter === 'untracked' && item.isTrackInventory) return false;
      return true;
    });
  }, [
    serverItems,
    query,
    statusFilter,
    categoryFilter,
    brandFilter,
    vendorFilter,
    taxRateFilter,
    typeFilter,
    unitFilter,
    trackFilter,
  ]);

  /* Bulk-action toggling */
  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((d) => selected.has(d._id));
  const toggleAll = React.useCallback(() => {
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
    });
  }, [filtered]);

  /**
   * Project visible/selected rows into the flat `ExportRow` shape used by
   * the shared XLSX/CSV helpers. Kept colocated with `toCsv` so column
   * ordering stays consistent across both formats.
   */
  const buildExportRows = React.useCallback(
    (rows: ItemListRow[]): { headers: string[]; rows: ExportRow[] } => {
      const headers = [
        'name',
        'sku',
        'barcode',
        'hsn',
        'type',
        'currency',
        'costPrice',
        'sellingPrice',
        'taxRate',
        'totalStock',
        'reorderPoint',
        'status',
        'createdAt',
      ];
      const out: ExportRow[] = rows.map((r) => ({
        name: r.name,
        sku: r.sku,
        barcode: r.barcode ?? '',
        hsn: r.hsnSac ?? '',
        type: r.itemType ?? '',
        currency: r.currency,
        costPrice: r.costPrice,
        sellingPrice: r.sellingPrice,
        taxRate: r.taxRate ?? '',
        totalStock: r.totalStock,
        reorderPoint: r.reorderPoint ?? '',
        status: r.status ?? '',
        createdAt: r.createdAt ?? '',
      }));
      return { headers, rows: out };
    },
    [],
  );

  const exportXlsx = React.useCallback(async () => {
    const rows = filtered.filter(
      (d) => selected.size === 0 || selected.has(d._id),
    );
    if (rows.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Filter or select rows first.',
      });
      return;
    }
    const projected = buildExportRows(rows);
    await downloadXlsx(
      `items-${dateStamp()}.xlsx`,
      projected.headers,
      projected.rows,
      'Items',
    );
    toast({
      title: 'Exported',
      description: `${rows.length} items saved to XLSX.`,
    });
  }, [filtered, selected, toast, buildExportRows]);

  const exportCsv = React.useCallback(() => {
    const rows = filtered.filter(
      (d) => selected.size === 0 || selected.has(d._id),
    );
    if (rows.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Filter or select rows first.',
      });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `items-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${rows.length} items saved to CSV.`,
    });
  }, [filtered, selected, toast]);

  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setCategoryFilter(null);
    setBrandFilter(null);
    setVendorFilter(null);
    setTaxRateFilter(null);
    setTypeFilter('all');
    setUnitFilter(null);
    setTrackFilter('all');
    setPreset('all');
  }, []);

  /* Presets */
  const applyPreset = React.useCallback(
    (key: ItemPresetKey) => {
      setPreset(key);
      if (key === 'all') {
        clearFilters();
        return;
      }
      if (key === 'active') {
        setStatusFilter('active');
        return;
      }
      if (key === 'archived') {
        setStatusFilter('archived');
        return;
      }
      if (key === 'low-stock') {
        // Status-agnostic; we filter client-side by predicate below — but
        // we still flip status to 'active' so archived items don't surface.
        setStatusFilter('active');
        setTrackFilter('tracked');
      }
      if (key === 'out-of-stock') {
        setStatusFilter('active');
        setTrackFilter('tracked');
      }
    },
    [clearFilters],
  );

  // Apply preset-derived predicates on top of the field filters.
  const presetFiltered = React.useMemo(() => {
    if (preset === 'low-stock') return filtered.filter(isLowStock);
    if (preset === 'out-of-stock') return filtered.filter(isOutOfStock);
    return filtered;
  }, [filtered, preset]);

  /* Bulk handlers */
  const bulk = useItemsBulk({
    selected,
    onCleared: () => setSelected(new Set()),
  });

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    Boolean(categoryFilter) ||
    Boolean(brandFilter) ||
    Boolean(vendorFilter) ||
    Boolean(taxRateFilter) ||
    typeFilter !== 'all' ||
    Boolean(unitFilter) ||
    trackFilter !== 'all' ||
    preset !== 'all';

  const handleBulkEdit = React.useCallback(
    (field: ItemsBulkEditField) => bulk.bulkEdit(field),
    [bulk],
  );

  return (
    <div className="flex w-full flex-col gap-5">
      <ItemsKpiStrip
        kpi={kpi}
        currency={defaultCurrency}
        active={preset}
        onSelect={applyPreset}
      />

      {error ? (
        <div className="rounded border border-zoru-line/40 bg-zoru-ink/10 px-3 py-2 text-[12.5px] text-zoru-ink dark:text-zoru-ink-muted">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <ItemsToolbar
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

        <ItemsFilters
          filtersActive={filtersActive}
          onClearAll={clearFilters}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryFilter={setCategoryFilter}
          brandFilter={brandFilter}
          onBrandFilter={setBrandFilter}
          vendorFilter={vendorFilter}
          onVendorFilter={setVendorFilter}
          taxRateFilter={taxRateFilter}
          onTaxRateFilter={setTaxRateFilter}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          unitFilter={unitFilter}
          onUnitFilter={setUnitFilter}
          trackFilter={trackFilter}
          onTrackFilter={setTrackFilter}
        />

        <ItemsBulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onExportCsv={exportCsv}
          onExportXlsx={exportXlsx}
          onArchive={() => setArchivePending(true)}
          onDelete={() => setDeletePending(true)}
          onAdjustStock={bulk.adjustStock}
          onSyncPrice={bulk.syncPrice}
          onBulkEdit={handleBulkEdit}
        />

        {view === 'grid' ? (
          <ItemsGrid
            items={presetFiltered}
            selected={selected}
            onToggleRow={toggleRow}
            filtersActive={filtersActive}
          />
        ) : (
          <ItemsTable
            items={presetFiltered}
            selected={selected}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            allSelectedOnPage={allSelectedOnPage}
            filtersActive={filtersActive}
            density={density}
          />
        )}

        <div className="border-t border-zoru-line p-3">
          <PaginationBar page={page} limit={limit} hasMore={hasMore} />
        </div>
      </Card>

      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
        description="Archived items are hidden from default views. (Wiring lands when `saveCrmProduct` exposes status.)"
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulk.archive()}
      />

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected items and their stock adjustment history. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={async () => bulk.remove()}
      />

      {bulk.pending ? <span className="sr-only">Working…</span> : null}
    </div>
  );
}
