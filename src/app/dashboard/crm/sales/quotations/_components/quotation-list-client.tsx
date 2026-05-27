'use client';

import { Button, Card, useZoruToast, Input } from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';

/**
 * <QuotationListClient> — canonical Quotations list view.
 * Upgraded to use spreadsheet-style CrmBulkyGrid and useCrmBulkyState.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { SavedViewsBar } from '@/components/crm/SavedViewsBar';
import type { SavedView } from '@/lib/saved-views/types';
import { dateStamp, downloadXlsx } from '@/lib/crm-list-export';
import type { CrmQuotationStatus } from '@/lib/rust-client/crm-quotations';

import { QuotationBulkBar } from './quotation-bulk-bar';
import { QuotationFilters } from './quotation-filters';
import {
  QuotationKpiStrip,
  QuotationListToolbar,
  type Density,
  type PresetKey,
  type ViewMode,
} from './quotation-list-toolbar';
import { QuotationKanban } from './quotation-kanban';
import { useQuotationBulk } from './use-quotation-bulk';
import type { QuotationKpiSummary, QuotationListRow } from './types';

// Bulky components
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import { patchQuotation, listQuotations } from '@/app/actions/crm/quotations.actions';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

/* ─── Types ──────────────────────────────────────────────────────── */

interface QuotationListClientProps {
  quotations: QuotationListRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: QuotationKpiSummary;
  defaultCurrency: string;
  currentUserId?: string | null;
  error?: string;
}

const DENSITY_KEY = 'crm.quotations.density';

/* ─── Helpers ────────────────────────────────────────────────────── */

function toCsv(rows: QuotationListRow[]): string {
  const head = [
    'quotation_no',
    'customer_id',
    'date',
    'valid_until',
    'currency',
    'total',
    'status',
    'sales_agent_id',
    'created_at',
  ];
  const body = rows.map((r) =>
    [
      r.quotationNo,
      r.clientId ?? '',
      r.date ?? '',
      r.validUntil ?? '',
      r.currency ?? '',
      r.total ?? '',
      r.status,
      r.salesAgentId ?? '',
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

function fmtMoney(value: number | undefined | null, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

/* ─── Component ──────────────────────────────────────────────────── */

export function QuotationListClient({
  quotations: serverRows,
  page,
  limit,
  hasMore: initialHasMore,
  initialQuery,
  kpi,
  defaultCurrency,
  currentUserId,
  error,
}: QuotationListClientProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  /* View + density */
  const [view, setView] = React.useState<ViewMode>('table');
  const [density, setDensity] = React.useState<Density>('comfortable');

  /* Destructive-action confirms */
  const [archivePending, setArchivePending] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [convertPending, setConvertPending] = React.useState(false);

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

  /* Bulky State Hook */
  const {
    data: quotations,
    total,
    page: gridPage,
    setPage: setGridPage,
    limit: gridLimit,
    filters,
    isPending,
    selected,
    inlineEditRowId,
    editBuffer,
    hasActiveFilters,
    handleSearch,
    updateFilter,
    clearFilters: clearGridFilters,
    toggleSelectOne,
    toggleSelectAll,
    clearSelection,
    startInlineEdit,
    cancelInlineEdit,
    updateEditBuffer,
    triggerFetch,
    setData: setGridData,
  } = useCrmBulkyState<QuotationListRow>({
    initialData: serverRows,
    initialPage: page,
    initialLimit: limit,
    fetchFn: async ({ page: p, limit: l, search, filters: f }) => {
      const response = await listQuotations({
        page: p,
        limit: l,
        q: search || undefined,
      });

      // Map doc to QuotationListRow
      const mappedItems = response.quotations.map((doc) => {
        const clientId = doc.clientId ? String(doc.clientId) : null;
        return {
          _id: String(doc._id),
          quotationNo: doc.quotationNo,
          subject: doc.subject ?? null,
          clientId,
          clientLabel: clientId ? (serverRows.find(x => x.clientId === clientId)?.clientLabel || doc.clientId) : undefined,
          salesAgentId: doc.assignment?.assignedTo ? String(doc.assignment.assignedTo) : (doc.salesAgentId ? String(doc.salesAgentId) : null),
          date: doc.date ?? null,
          validUntil: doc.validUntil ?? null,
          currency: doc.currency ?? 'INR',
          total: doc.totals?.total ?? 0,
          status: doc.status,
          createdAt: doc.createdAt ?? doc.audit?.createdAt,
          updatedAt: doc.updatedAt ?? doc.audit?.updatedAt,
          expired: typeof doc.validUntil === 'string' && new Date(doc.validUntil).getTime() < Date.now() && doc.status !== 'accepted',
        };
      });

      let items = mappedItems;

      // Apply filters client-side
      if (f.statusFilter && f.statusFilter !== 'all') {
        if (f.statusFilter === 'expired') {
          items = items.filter((q) => q.expired);
        } else {
          items = items.filter((q) => (q.status ?? '').toLowerCase() === f.statusFilter);
        }
      }
      if (f.customerFilter) {
        items = items.filter((q) => q.clientId === f.customerFilter);
      }
      if (f.salesAgentFilter) {
        items = items.filter((q) => q.salesAgentId === f.salesAgentFilter);
      }
      if (f.currencyFilter) {
        items = items.filter((q) => q.currency === f.currencyFilter);
      }
      if (f.fromDate) {
        const fromTs = new Date(f.fromDate).getTime();
        items = items.filter((q) => q.date && new Date(q.date).getTime() >= fromTs);
      }
      if (f.toDate) {
        const toTs = new Date(f.toDate).getTime();
        items = items.filter((q) => q.date && new Date(q.date).getTime() <= toTs);
      }
      if (f.validFrom) {
        const validFromTs = new Date(f.validFrom).getTime();
        items = items.filter((q) => q.validUntil && new Date(q.validUntil).getTime() >= validFromTs);
      }
      if (f.validTo) {
        const validToTs = new Date(f.validTo).getTime();
        items = items.filter((q) => q.validUntil && new Date(q.validUntil).getTime() <= validToTs);
      }

      return {
        items,
        total: response.quotations.length,
        hasMore: response.hasMore,
      };
    },
  });

  // Re-sync local grid data when server inputs change
  React.useEffect(() => {
    setGridData(serverRows);
  }, [serverRows, setGridData]);

  React.useEffect(() => {
    triggerFetch();
  }, [triggerFetch, gridPage, gridLimit, filters]);

  /* ─── Inline Edit Save ─────────────────────────────────────────────────── */
  const handleSaveInlineEdit = async (id: string, updatedData: Partial<QuotationListRow>) => {
    try {
      const patch: any = {};
      if (updatedData.validUntil !== undefined) patch.validUntil = updatedData.validUntil;
      if (updatedData.currency !== undefined) patch.currency = updatedData.currency;
      if (updatedData.status !== undefined) patch.status = updatedData.status;
      if (updatedData.salesAgentId !== undefined) {
        patch.assignment = { assignedTo: updatedData.salesAgentId };
        patch.salesAgentId = updatedData.salesAgentId;
      }
      if (updatedData.total !== undefined) {
        patch.items = quotations.find(x => x._id === id)?.items; // preserve line items structure
        patch.totals = { total: Number(updatedData.total) };
      }

      const res = await patchQuotation(id, patch);
      if (res.error) {
        toast({
          title: 'Inline Edit Failed',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Quotation saved inline' });
        cancelInlineEdit();
        triggerFetch();
      }
    } catch (err: any) {
      toast({
        title: 'Error saving inline',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  /* CSV export */
  const exportCsv = React.useCallback(() => {
    const rows = quotations.filter((r) => selected.size === 0 || selected.has(r._id));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${rows.length} quotations saved to CSV.` });
  }, [quotations, selected, toast]);

  /* XLSX export */
  const exportXlsx = React.useCallback(() => {
    const rows = quotations.filter((r) => selected.size === 0 || selected.has(r._id));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const headers = [
      'quotation_no',
      'subject',
      'customer_id',
      'date',
      'valid_until',
      'currency',
      'total',
      'status',
      'sales_agent_id',
      'created_at',
    ];
    const exportRows = rows.map((r) => ({
      quotation_no: r.quotationNo,
      subject: r.subject ?? '',
      customer_id: r.clientId ?? '',
      date: r.date ?? '',
      valid_until: r.validUntil ?? '',
      currency: r.currency ?? '',
      total: r.total ?? '',
      status: r.status,
      sales_agent_id: r.salesAgentId ?? '',
      created_at: r.createdAt ?? '',
    }));
    void downloadXlsx(
      `quotations-${dateStamp()}.xlsx`,
      headers,
      exportRows,
      'Quotations',
    );
    toast({ title: 'Exported', description: `${rows.length} quotations saved to XLSX.` });
  }, [quotations, selected, toast]);

  /* Clear all filters */
  const clearFilters = React.useCallback(() => {
    clearGridFilters();
  }, [clearGridFilters]);

  /* Presets */
  const applyPreset = React.useCallback(
    (key: PresetKey) => {
      updateFilter('preset', key);
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (key === 'all') {
        clearFilters();
        return;
      }
      if (key === 'my-open') {
        updateFilter('statusFilter', 'sent');
        updateFilter('salesAgentFilter', currentUserId ?? null);
        return;
      }
      if (key === 'accepted-30d') {
        const past30 = new Date(today.getTime() - 30 * 86_400_000);
        updateFilter('statusFilter', 'accepted');
        updateFilter('fromDate', fmt(past30));
        updateFilter('toDate', fmt(today));
        return;
      }
      if (key === 'expiring-week') {
        const next7 = new Date(today.getTime() + 7 * 86_400_000);
        updateFilter('statusFilter', 'sent');
        updateFilter('validFrom', fmt(today));
        updateFilter('validTo', fmt(next7));
        return;
      }
      if (key === 'draft') {
        updateFilter('statusFilter', 'draft');
      }
    },
    [clearFilters, currentUserId, updateFilter],
  );

  /* Bulk handlers */
  const bulk = useQuotationBulk({
    selected,
    onCleared: () => clearSelection(),
  });

  const handleConvertToInvoiceBulk = React.useCallback(() => {
    setConvertPending(false);
    const first = Array.from(selected)[0];
    if (!first) return;
    router.push(`/dashboard/crm/sales/invoices/new?fromKind=quotation&fromId=${first}`);
  }, [selected, router]);

  const filtersActive = hasActiveFilters;

  const savedViewFilters = React.useMemo(
    () => ({
      query: filters.query || '',
      statusFilter: filters.statusFilter || 'all',
      customerFilter: filters.customerFilter || null,
      salesAgentFilter: filters.salesAgentFilter || null,
      currencyFilter: filters.currencyFilter || null,
      fromDate: filters.fromDate || '',
      toDate: filters.toDate || '',
      validFrom: filters.validFrom || '',
      validTo: filters.validTo || '',
      preset: filters.preset || 'all',
    }),
    [filters],
  );

  const handleApplyView = React.useCallback((view: SavedView) => {
    const f = (view.filters ?? {}) as Record<string, unknown>;
    Object.entries(f).forEach(([key, val]) => {
      updateFilter(key, val);
    });
  }, [updateFilter]);

  /* KPI segment clicks update the status filter. */
  const onKpiSegmentClick = React.useCallback(
    (segment: 'open' | 'accepted' | 'rejected' | 'expired' | 'converted' | 'draft') => {
      if (segment === 'open') {
        updateFilter('statusFilter', 'sent');
      } else {
        updateFilter('statusFilter', segment);
      }
    },
    [updateFilter],
  );

  /* ─── Column Definitions ───────────────────────────────────────────────── */
  const columns = React.useMemo<ColumnDef<QuotationListRow>[]>(() => [
    {
      key: 'quotationNo',
      header: 'Quote #',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/sales/quotations/${row._id}`}
          label={row.quotationNo || '—'}
          subtitle={row.subject || undefined}
        />
      ),
    },
    {
      key: 'clientId',
      header: 'Customer',
      render: (row) => row.clientId ? (
        <EntityPickerChip entity="client" id={row.clientId} />
      ) : (
        <span className="text-zoru-ink-muted">{row.clientLabel ?? '—'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-zoru-ink-muted">{fmtDate(row.date)}</span>,
    },
    {
      key: 'validUntil',
      header: 'Valid until',
      sortable: true,
      render: (row) => {
        const overdue = row.expired;
        const overdueClass = overdue ? 'text-zoru-danger-ink font-semibold' : 'text-zoru-ink-muted';
        return (
          <span className={overdueClass}>
            {fmtDate(row.validUntil)}
            {overdue && <span className="ml-1 text-[10px] uppercase font-bold text-zoru-danger-ink font-mono">expired</span>}
          </span>
        );
      },
      editRender: (row, value, onChange) => (
        <Input
          type="date"
          size="sm"
          className="h-8 w-36 text-[12.5px]"
          value={value !== undefined ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'currency',
      header: 'Currency',
      render: (row) => <span className="text-zoru-ink-muted">{row.currency || 'INR'}</span>,
      editRender: (row, value, onChange) => (
        <Input
          size="sm"
          className="h-8 w-20 text-[12.5px]"
          value={value !== undefined ? String(value) : 'INR'}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-zoru-ink font-semibold">
          {fmtMoney(row.total, row.currency ?? 'INR')}
        </span>
      ),
      editRender: (row, value, onChange) => (
        <Input
          type="number"
          size="sm"
          className="h-8 w-28 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => row.status ? (
        <StatusPill
          label={String(row.status).replace(/_/g, ' ')}
          tone={statusToTone(row.status)}
        />
      ) : (
        <span className="text-zoru-ink-muted">—</span>
      ),
      editRender: (row, value, onChange) => {
        const options = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];
        return (
          <select
            className="h-8 w-28 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg text-zoru-ink text-[12.5px] p-1 outline-none"
            value={value !== undefined ? String(value) : 'draft'}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'salesAgentId',
      header: 'Sales Agent',
      render: (row) => row.salesAgentId ? (
        <EntityPickerChip entity="user" id={row.salesAgentId} />
      ) : (
        <span className="text-zoru-ink-muted">—</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (row) => <span className="text-zoru-ink-muted">{fmtDate(row.createdAt)}</span>,
    },
  ], [serverRows, quotations]);

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <>
      <EntityListShell
        title="Quotations"
        subtitle="Create and manage sales quotations — open, accepted, rejected, expired, converted."
        viewSwitcher={null}
        primaryAction={
          <Button asChild>
            <Link href="/dashboard/crm/sales/quotations/new">
              <Plus className="h-4 w-4" /> New quotation
            </Link>
          </Button>
        }
        bulkBar={
          selected.size > 0 ? (
            <QuotationBulkBar
              count={selected.size}
              onExportCsv={exportCsv}
              onExportXlsx={exportXlsx}
              onClear={() => clearSelection()}
              onArchive={() => setArchivePending(true)}
              onDelete={() => setDeletePending(true)}
              onSend={bulk.send}
              onConvertToInvoice={() => setConvertPending(true)}
              onChangeStatus={bulk.changeStatus as (s: CrmQuotationStatus) => void}
            />
          ) : null
        }
        empty={
          quotations.length === 0 && !filtersActive ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">
                No quotations yet
              </h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Draft your first quotation to start the sales conversation.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/sales/quotations/new">
                  <Plus className="h-4 w-4" /> New quotation
                </Link>
              </Button>
            </div>
          ) : null
        }
        pagination={<PaginationBar page={gridPage} limit={gridLimit} hasMore={initialHasMore} />}
      >
        <div className="flex flex-col gap-5">
          <SavedViewsBar
            entityKind="quotation"
            currentFilters={savedViewFilters}
            currentColumns={[]}
            onApplyView={handleApplyView}
          />

          <QuotationKpiStrip kpi={kpi} onSegmentClick={onKpiSegmentClick} />

          {error ? (
            <div className="rounded border border-zoru-line/40 bg-zoru-ink/10 px-3 py-2 text-[12.5px] text-zoru-ink dark:text-zoru-ink-muted">
              {error}
            </div>
          ) : null}

          <Card className="overflow-hidden p-0 border-none bg-transparent">
            <QuotationListToolbar
              query={filters.query || ''}
              onQueryChange={handleSearch}
              view={view}
              onViewChange={setView}
              density={density}
              onDensityChange={handleDensityChange}
              preset={filters.preset || 'all'}
              onPresetChange={applyPreset}
              onExportCsv={exportCsv}
            />

            <QuotationFilters
              statusFilter={filters.statusFilter || 'all'}
              customerFilter={filters.customerFilter || null}
              salesAgentFilter={filters.salesAgentFilter || null}
              currencyFilter={filters.currencyFilter || null}
              fromDate={filters.fromDate || ''}
              toDate={filters.toDate || ''}
              validFrom={filters.validFrom || ''}
              validTo={filters.validTo || ''}
              filtersActive={filtersActive}
              onStatusChange={(val) => updateFilter('statusFilter', val)}
              onCustomerChange={(val) => updateFilter('customerFilter', val)}
              onSalesAgentChange={(val) => updateFilter('salesAgentFilter', val)}
              onCurrencyChange={(val) => updateFilter('currencyFilter', val)}
              onFromDateChange={(val) => updateFilter('fromDate', val)}
              onToDateChange={(val) => updateFilter('toDate', val)}
              onValidFromChange={(val) => updateFilter('validFrom', val)}
              onValidToChange={(val) => updateFilter('validTo', val)}
              onClear={clearFilters}
            />

            {view === 'kanban' ? (
              <div className="p-4">
                <QuotationKanban
                  quotations={quotations}
                  currency={defaultCurrency}
                />
              </div>
            ) : (
              <CrmBulkyGrid<QuotationListRow>
                columns={columns}
                data={quotations}
                selectedIds={selected}
                onSelectOne={toggleSelectOne}
                onSelectAll={(checked) => toggleSelectAll(quotations.map(x => x._id), checked)}
                density={density}
                inlineEditRowId={inlineEditRowId}
                editBuffer={editBuffer}
                onStartInlineEdit={startInlineEdit}
                onCancelInlineEdit={cancelInlineEdit}
                onSaveInlineEdit={handleSaveInlineEdit}
                onUpdateEditBuffer={updateEditBuffer}
                isLoading={isPending}
              />
            )}
          </Card>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${selected.size} quotation${selected.size === 1 ? '' : 's'}?`}
        description="Archived quotations are marked expired but remain in the database."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulk.archive()}
      />

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} quotation${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected quotations. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={async () => bulk.remove()}
      />

      <ConfirmDialog
        open={convertPending}
        onOpenChange={setConvertPending}
        title="Convert to invoice?"
        description={
          selected.size > 1
            ? 'Only the first selected quotation will open the new-invoice form pre-filled. Batch-conversion is not yet supported server-side.'
            : 'Opens the new-invoice form pre-filled with this quotation.'
        }
        confirmLabel="Continue"
        confirmTone="primary"
        onConfirm={async () => handleConvertToInvoiceBulk()}
      />

      {bulk.pending ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
