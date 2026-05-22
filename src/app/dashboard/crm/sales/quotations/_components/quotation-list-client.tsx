'use client';

import { Button, Card, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { FileText,
  Plus } from 'lucide-react';

/**
 * <QuotationListClient> — canonical Quotations list view per
 * `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D.
 *
 * Ships:
 *   - 5-tile KPI strip (open / accepted / rejected / expired /
 *     conversion-rate), each clickable.
 *   - 6 filters (status, customer, sales agent, date range, valid-until
 *     range, currency).
 *   - Search across quotation number + customer name.
 *   - Bulk-action bar (archive · delete · export CSV · send · change
 *     status · convert to invoice).
 *   - View switcher (table; kept for parity with deals).
 *   - 5 saved presets (All · My open · Accepted last 30d · Expiring this
 *     week · Draft).
 *   - Density toggle + +New CTA.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { dateStamp, downloadXlsx } from '@/lib/crm-list-export';
import type { CrmQuotationStatus } from '@/lib/rust-client/crm-quotations';

import { QuotationTable } from './quotation-table';
import { QuotationBulkBar } from './quotation-bulk-bar';
import { QuotationFilters } from './quotation-filters';
import {
  QuotationKpiStrip,
  QuotationListToolbar,
  type Density,
  type PresetKey,
  type ViewMode,
} from './quotation-list-toolbar';
import { useQuotationBulk } from './use-quotation-bulk';
import type { QuotationKpiSummary, QuotationListRow } from './types';

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

/* ─── Component ──────────────────────────────────────────────────── */

export function QuotationListClient({
  quotations: serverRows,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  defaultCurrency,
  currentUserId,
  error,
}: QuotationListClientProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  /* View + filters */
  const [view, setView] = React.useState<ViewMode>('table');
  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [customerFilter, setCustomerFilter] = React.useState<string | null>(null);
  const [salesAgentFilter, setSalesAgentFilter] = React.useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = React.useState<string | null>(null);
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [validFrom, setValidFrom] = React.useState('');
  const [validTo, setValidTo] = React.useState('');
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

  /* Filtered list */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;
    const vfrom = validFrom ? new Date(validFrom).getTime() : null;
    const vto = validTo ? new Date(validTo).getTime() : null;

    return serverRows.filter((r) => {
      if (q) {
        const hay = `${r.quotationNo ?? ''} ${r.clientId ?? ''} ${r.subject ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'expired') {
          if (!r.expired) return false;
        } else if (r.status !== statusFilter) return false;
      }
      if (customerFilter && r.clientId !== customerFilter) return false;
      if (salesAgentFilter && r.salesAgentId !== salesAgentFilter) return false;
      if (currencyFilter && r.currency !== currencyFilter) return false;
      if (from && r.date) {
        const t = new Date(r.date).getTime();
        if (!Number.isNaN(t) && t < from) return false;
      }
      if (to && r.date) {
        const t = new Date(r.date).getTime();
        if (!Number.isNaN(t) && t > to) return false;
      }
      if (vfrom && r.validUntil) {
        const t = new Date(r.validUntil).getTime();
        if (!Number.isNaN(t) && t < vfrom) return false;
      }
      if (vto && r.validUntil) {
        const t = new Date(r.validUntil).getTime();
        if (!Number.isNaN(t) && t > vto) return false;
      }
      return true;
    });
  }, [
    serverRows,
    query,
    statusFilter,
    customerFilter,
    salesAgentFilter,
    currencyFilter,
    fromDate,
    toDate,
    validFrom,
    validTo,
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
    a.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${rows.length} quotations saved to CSV.` });
  }, [filtered, selected, toast]);

  /* XLSX export */
  const exportXlsx = React.useCallback(() => {
    const rows = filtered.filter((r) => selected.size === 0 || selected.has(r._id));
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
  }, [filtered, selected, toast]);

  /* Clear all filters */
  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setCustomerFilter(null);
    setSalesAgentFilter(null);
    setCurrencyFilter(null);
    setFromDate('');
    setToDate('');
    setValidFrom('');
    setValidTo('');
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
      if (key === 'my-open') {
        setStatusFilter('sent');
        setSalesAgentFilter(currentUserId ?? null);
        return;
      }
      if (key === 'accepted-30d') {
        const past30 = new Date(today.getTime() - 30 * 86_400_000);
        setStatusFilter('accepted');
        setFromDate(fmt(past30));
        setToDate(fmt(today));
        return;
      }
      if (key === 'expiring-week') {
        const next7 = new Date(today.getTime() + 7 * 86_400_000);
        setStatusFilter('sent');
        setValidFrom(fmt(today));
        setValidTo(fmt(next7));
        return;
      }
      if (key === 'draft') {
        setStatusFilter('draft');
      }
    },
    [clearFilters, currentUserId],
  );

  /* Bulk handlers */
  const bulk = useQuotationBulk({
    selected,
    onCleared: () => setSelected(new Set()),
  });

  const handleConvertToInvoiceBulk = React.useCallback(() => {
    setConvertPending(false);
    // Single-tab navigation conversion for the first selected; UX could
    // be enhanced later to batch-create invoices server-side.
    const first = Array.from(selected)[0];
    if (!first) return;
    router.push(`/dashboard/crm/sales/invoices/new?fromKind=quotation&fromId=${first}`);
  }, [selected, router]);

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    Boolean(customerFilter) ||
    Boolean(salesAgentFilter) ||
    Boolean(currencyFilter) ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(validFrom) ||
    Boolean(validTo);

  /* KPI segment clicks update the status filter. */
  const onKpiSegmentClick = React.useCallback(
    (segment: 'open' | 'accepted' | 'rejected' | 'expired' | 'converted' | 'draft') => {
      if (segment === 'open') {
        // "Total open" = draft + sent; closest single-status pick is sent.
        setStatusFilter('sent');
      } else {
        setStatusFilter(segment);
      }
    },
    [],
  );

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <>
      <EntityListShell
        title="Quotations"
        subtitle="Create and manage sales quotations — open, accepted, rejected, expired, converted."
        primaryAction={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/quotations/new">
              <Plus className="h-4 w-4" /> New quotation
            </Link>
          </ZoruButton>
        }
        bulkBar={
          selected.size > 0 ? (
            <QuotationBulkBar
              count={selected.size}
              onExportCsv={exportCsv}
              onExportXlsx={exportXlsx}
              onClear={() => setSelected(new Set())}
              onArchive={() => setArchivePending(true)}
              onDelete={() => setDeletePending(true)}
              onSend={bulk.send}
              onConvertToInvoice={() => setConvertPending(true)}
              onChangeStatus={bulk.changeStatus as (s: CrmQuotationStatus) => void}
            />
          ) : null
        }
        empty={
          filtered.length === 0 && !filtersActive ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">
                No quotations yet
              </h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Draft your first quotation to start the sales conversation.
              </p>
              <ZoruButton asChild>
                <Link href="/dashboard/crm/sales/quotations/new">
                  <Plus className="h-4 w-4" /> New quotation
                </Link>
              </ZoruButton>
            </div>
          ) : null
        }
        pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} />}
      >
        <div className="flex flex-col gap-5">
          <QuotationKpiStrip kpi={kpi} onSegmentClick={onKpiSegmentClick} />

          {error ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
              {error}
            </div>
          ) : null}

          <ZoruCard className="overflow-hidden p-0">
            <QuotationListToolbar
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

            <QuotationFilters
              statusFilter={statusFilter}
              customerFilter={customerFilter}
              salesAgentFilter={salesAgentFilter}
              currencyFilter={currencyFilter}
              fromDate={fromDate}
              toDate={toDate}
              validFrom={validFrom}
              validTo={validTo}
              filtersActive={filtersActive}
              onStatusChange={setStatusFilter}
              onCustomerChange={setCustomerFilter}
              onSalesAgentChange={setSalesAgentFilter}
              onCurrencyChange={setCurrencyFilter}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              onValidFromChange={setValidFrom}
              onValidToChange={setValidTo}
              onClear={clearFilters}
            />

            <QuotationTable
              quotations={filtered}
              selected={selected}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              allSelectedOnPage={allSelectedOnPage}
              filtersActive={filtersActive}
              defaultCurrency={defaultCurrency}
              density={density}
            />
          </ZoruCard>
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
