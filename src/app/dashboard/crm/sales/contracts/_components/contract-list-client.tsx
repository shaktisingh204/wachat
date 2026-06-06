'use client';

/**
 * <ContractListClient> — §1D list view for CRM contracts.
 *
 * Composes <EntityListShell> with:
 *   - KPI strip (Active · Pending Signature · Expiring Soon · Terminated · Renewed)
 *   - Filters: status, customer search, date range (effective/expiry), value range
 *   - Dense Table with row checkboxes
 *   - Bulk-action bar: archive, change status, export CSV, delete
 *   - URL-based pagination via PaginationBar
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button, Card, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import { Archive, CalendarRange, Download, FileSignature, Plus, Trash2, X } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  deleteContractAction,
  setContractStatusV2,
  type ContractKpisV2,
  type ContractStatusV2,
} from '@/app/actions/crm/contracts.actions';
import { dateStamp, downloadCsv, downloadXlsx } from '@/lib/crm-list-export';
import type { CrmContractDoc } from '@/lib/rust-client/crm-contracts';

/* ─── KPI strip ────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  tone?: 'green' | 'amber' | 'red' | 'neutral';
}

function KpiCard({ label, value, active, onClick, tone = 'neutral' }: KpiCardProps) {
  const toneClass =
    tone === 'green'
      ? 'border-[var(--st-border)]/30 bg-[var(--st-text)]/10 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]'
      : tone === 'amber'
        ? 'border-[var(--st-border)]/30 bg-[var(--st-text)]/10 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]'
        : tone === 'red'
          ? 'border-[var(--st-border)]/30 bg-[var(--st-text)]/10 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col gap-0.5 rounded-[var(--st-radius)] border px-4 py-3 text-left transition-all',
        toneClass,
        active ? 'ring-2 ring-[var(--st-accent)] ring-offset-1' : 'hover:opacity-80',
      ].join(' ')}
    >
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-[11.5px]">{label}</span>
    </button>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

import { fmtDate, fmtINR } from '@/lib/utils';

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  return fmtINR(value, currency);
}

function toCsv(rows: CrmContractDoc[]): string {
  const head = [
    'id',
    'contractNo',
    'title',
    'partyName',
    'type',
    'status',
    'effectiveDate',
    'expiryDate',
    'value',
    'currency',
    'esignProvider',
    'createdAt',
  ];
  const body = rows.map((r) =>
    [
      r._id,
      r.contractNo ?? '',
      r.title ?? '',
      r.partyName ?? '',
      r.type ?? '',
      r.status ?? '',
      r.effectiveDate ?? '',
      r.expiryDate ?? '',
      typeof r.value === 'number' ? r.value : '',
      r.currency ?? '',
      r.esignProvider ?? '',
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

/* ─── Props ──────────────────────────────────────────────────────────── */

export interface ContractListClientProps {
  contracts: CrmContractDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: ContractKpisV2;
  error?: string;
}

const ALL = 'all';

/* ─── Component ──────────────────────────────────────────────────────── */

export function ContractListClient({
  contracts: serverRows,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  error,
}: ContractListClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  /* Search */
  const [query, setQuery] = React.useState(initialQuery);

  /* Filters */
  const statusFilter = sp?.get('status') ?? ALL;
  const partySearch = sp?.get('party') ?? '';
  const effectiveFrom = sp?.get('eff_from') ?? '';
  const effectiveTo = sp?.get('eff_to') ?? '';
  const expiryFrom = sp?.get('exp_from') ?? '';
  const expiryTo = sp?.get('exp_to') ?? '';
  const valueMin = sp?.get('val_min') ?? '';
  const valueMax = sp?.get('val_max') ?? '';

  const updateFilter = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [sp, pathname, router],
  );

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Dialogs */
  const [pendingDelete, setPendingDelete] = React.useState<CrmContractDoc | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [pendingBulkArchive, setPendingBulkArchive] = React.useState(false);

  const [busy, startBusy] = React.useTransition();

  /* Debounce search → URL */
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  /* In-memory filter — status + party search + date ranges + value range */
  const filtered = React.useMemo(() => {
    const minVal = valueMin ? Number(valueMin) : Number.NEGATIVE_INFINITY;
    const maxVal = valueMax ? Number(valueMax) : Number.POSITIVE_INFINITY;
    const effFromTs = effectiveFrom ? new Date(effectiveFrom).getTime() : null;
    const effToTs = effectiveTo ? new Date(effectiveTo).getTime() : null;
    const expFromTs = expiryFrom ? new Date(expiryFrom).getTime() : null;
    const expToTs = expiryTo ? new Date(expiryTo).getTime() : null;
    const partyCmp = partySearch.trim().toLowerCase();

    return serverRows.filter((c) => {
      if (statusFilter !== ALL && (c.status as string) !== statusFilter) return false;
      if (partyCmp && !(c.partyName ?? '').toLowerCase().includes(partyCmp)) return false;
      const val = typeof c.value === 'number' ? c.value : 0;
      if (val < minVal || val > maxVal) return false;
      if (effFromTs && c.effectiveDate) {
        const t = new Date(c.effectiveDate).getTime();
        if (!Number.isNaN(t) && t < effFromTs) return false;
      }
      if (effToTs && c.effectiveDate) {
        const t = new Date(c.effectiveDate).getTime();
        if (!Number.isNaN(t) && t > effToTs) return false;
      }
      if (expFromTs && c.expiryDate) {
        const t = new Date(c.expiryDate).getTime();
        if (!Number.isNaN(t) && t < expFromTs) return false;
      }
      if (expToTs && c.expiryDate) {
        const t = new Date(c.expiryDate).getTime();
        if (!Number.isNaN(t) && t > expToTs) return false;
      }
      return true;
    });
  }, [serverRows, statusFilter, partySearch, effectiveFrom, effectiveTo, expiryFrom, expiryTo, valueMin, valueMax]);

  const filtersActive =
    statusFilter !== ALL ||
    Boolean(partySearch) ||
    Boolean(effectiveFrom) ||
    Boolean(effectiveTo) ||
    Boolean(expiryFrom) ||
    Boolean(expiryTo) ||
    Boolean(valueMin) ||
    Boolean(valueMax);

  const clearFilters = React.useCallback(() => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    params.delete('status');
    params.delete('party');
    params.delete('eff_from');
    params.delete('eff_to');
    params.delete('exp_from');
    params.delete('exp_to');
    params.delete('val_min');
    params.delete('val_max');
    params.set('page', '1');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [sp, pathname, router]);

  /* Selection helpers */
  const allIds = React.useMemo(() => filtered.map((c) => String(c._id)), [filtered]);
  const allSelectedOnPage = allIds.length > 0 && allIds.every((id) => selected.has(id));

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
      if (allIds.length === 0) return prev;
      const allSel = allIds.every((id) => prev.has(id));
      if (allSel) {
        const next = new Set(prev);
        for (const id of allIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of allIds) next.add(id);
      return next;
    });
  }, [allIds]);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  /* Single delete */
  const confirmSingleDelete = () => {
    if (!pendingDelete) return;
    const id = String(pendingDelete._id);
    const label = pendingDelete.title || 'Untitled contract';
    startBusy(async () => {
      const res = await deleteContractAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `"${label}" removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  /* Bulk delete */
  const bulkDelete = () =>
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await deleteContractAction(id);
        if (res.success) ok += 1;
        else fail += 1;
      }
      toast({
        title: `Deleted ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'All selected contracts removed.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkDelete(false);
      router.refresh();
    });

  /* Bulk archive — sets status to 'terminated' as the archive equivalent */
  const bulkArchive = () =>
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await setContractStatusV2(id, 'terminated');
        if (res.success) ok += 1;
        else fail += 1;
      }
      toast({
        title: `Archived ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'Selected contracts archived.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkArchive(false);
      router.refresh();
    });

  /* Bulk status change */
  const bulkStatus = React.useCallback(
    (next: ContractStatusV2) => {
      if (selected.size === 0) return;
      startBusy(async () => {
        let ok = 0;
        let fail = 0;
        for (const id of selected) {
          const res = await setContractStatusV2(id, next);
          if (res.success) ok += 1;
          else fail += 1;
        }
        toast({
          title: `Updated ${ok}`,
          description: fail > 0 ? `${fail} failed.` : `Status set to ${next.replace(/_/g, ' ')}.`,
          variant: fail > 0 ? 'destructive' : undefined,
        });
        clearSelection();
        router.refresh();
      });
    },
    [selected, toast, clearSelection, router],
  );

  /* Bulk export CSV */
  const bulkExportCsv = React.useCallback(() => {
    const rows = filtered.filter(
      (c) => selected.size === 0 || selected.has(String(c._id)),
    );
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const headers = [
      'id', 'contractNo', 'title', 'partyName', 'type', 'status',
      'effectiveDate', 'expiryDate', 'value', 'currency', 'esignProvider', 'createdAt',
    ];
    const exportRows = rows.map((r) => ({
      id: String(r._id),
      contractNo: r.contractNo ?? '',
      title: r.title ?? '',
      partyName: r.partyName ?? '',
      type: r.type ?? '',
      status: r.status ?? '',
      effectiveDate: r.effectiveDate ?? '',
      expiryDate: r.expiryDate ?? '',
      value: typeof r.value === 'number' ? r.value : '',
      currency: r.currency ?? '',
      esignProvider: r.esignProvider ?? '',
      createdAt: r.createdAt ?? '',
    }));
    downloadCsv(`contracts-${dateStamp()}.csv`, headers, exportRows);
    toast({ title: 'Exported', description: `${rows.length} contracts saved to CSV.` });
  }, [filtered, selected, toast]);

  /* Bulk export XLSX */
  const bulkExportXlsx = React.useCallback(() => {
    const rows = filtered.filter(
      (c) => selected.size === 0 || selected.has(String(c._id)),
    );
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const headers = [
      'id', 'contractNo', 'title', 'partyName', 'type', 'status',
      'effectiveDate', 'expiryDate', 'value', 'currency', 'esignProvider', 'createdAt',
    ];
    const exportRows = rows.map((r) => ({
      id: String(r._id),
      contractNo: r.contractNo ?? '',
      title: r.title ?? '',
      partyName: r.partyName ?? '',
      type: r.type ?? '',
      status: r.status ?? '',
      effectiveDate: r.effectiveDate ?? '',
      expiryDate: r.expiryDate ?? '',
      value: typeof r.value === 'number' ? r.value : '',
      currency: r.currency ?? '',
      esignProvider: r.esignProvider ?? '',
      createdAt: r.createdAt ?? '',
    }));
    void downloadXlsx(`contracts-${dateStamp()}.xlsx`, headers, exportRows, 'Contracts');
    toast({ title: 'Exported', description: `${rows.length} contracts saved to XLSX.` });
  }, [filtered, selected, toast]);

  /* KPI pivot */
  const kpiCards = [
    { key: 'active', label: 'Active', value: kpi.active, tone: 'green' as const },
    { key: 'pending_signature', label: 'Pending signature', value: kpi.pendingSignature, tone: 'amber' as const },
    { key: '__expiring__', label: 'Expiring soon', value: kpi.expiringSoon, tone: 'amber' as const },
    { key: 'terminated', label: 'Terminated', value: kpi.terminated, tone: 'red' as const },
    { key: 'renewed', label: 'Renewed', value: kpi.renewed, tone: 'green' as const },
  ];

  return (
    <>
      <EntityListShell
        title="Contracts"
        subtitle="Draft, send, e-sign and track customer contracts in one place."
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Search contracts…',
        }}
        primaryAction={
          <Button asChild>
            <Link href="/dashboard/crm/sales/contracts/new">
              <Plus className="h-4 w-4" /> New contract
            </Link>
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <EnumFilterField
              enumName="contractStatus"
              value={statusFilter === ALL ? null : statusFilter}
              onChange={(v) => updateFilter('status', v ?? ALL)}
              placeholder="All statuses"
            />
            <Input
              value={partySearch}
              onChange={(e) => updateFilter('party', e.target.value)}
              placeholder="Counter-party…"
              className="h-9 w-[180px] text-[13px]"
              aria-label="Filter by counter-party name"
            />
            <details className="relative">
              <summary className="list-none">
                <Button variant="outline" size="sm" className="h-9 text-[12.5px]">
                  <CalendarRange className="h-3.5 w-3.5" /> Effective range
                </Button>
              </summary>
              <div className="absolute left-0 z-20 mt-2 grid w-[260px] gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 shadow-md">
                <label className="text-[11px] text-[var(--st-text-secondary)]">From</label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => updateFilter('eff_from', e.target.value)}
                  className="h-8 text-[12.5px]"
                />
                <label className="text-[11px] text-[var(--st-text-secondary)]">To</label>
                <Input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => updateFilter('eff_to', e.target.value)}
                  className="h-8 text-[12.5px]"
                />
              </div>
            </details>
            <details className="relative">
              <summary className="list-none">
                <Button variant="outline" size="sm" className="h-9 text-[12.5px]">
                  <CalendarRange className="h-3.5 w-3.5" /> Expiry range
                </Button>
              </summary>
              <div className="absolute left-0 z-20 mt-2 grid w-[260px] gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 shadow-md">
                <label className="text-[11px] text-[var(--st-text-secondary)]">From</label>
                <Input
                  type="date"
                  value={expiryFrom}
                  onChange={(e) => updateFilter('exp_from', e.target.value)}
                  className="h-8 text-[12.5px]"
                />
                <label className="text-[11px] text-[var(--st-text-secondary)]">To</label>
                <Input
                  type="date"
                  value={expiryTo}
                  onChange={(e) => updateFilter('exp_to', e.target.value)}
                  className="h-8 text-[12.5px]"
                />
              </div>
            </details>
            <details className="relative">
              <summary className="list-none">
                <Button variant="outline" size="sm" className="h-9 text-[12.5px]">
                  Value range
                </Button>
              </summary>
              <div className="absolute left-0 z-20 mt-2 grid w-[220px] gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 shadow-md">
                <label className="text-[11px] text-[var(--st-text-secondary)]">Min value</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={valueMin}
                  onChange={(e) => updateFilter('val_min', e.target.value)}
                  placeholder="0"
                  className="h-8 text-[12.5px]"
                />
                <label className="text-[11px] text-[var(--st-text-secondary)]">Max value</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={valueMax}
                  onChange={(e) => updateFilter('val_max', e.target.value)}
                  placeholder="No limit"
                  className="h-8 text-[12.5px]"
                />
              </div>
            </details>
            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] text-[var(--st-text)]">
                {selected.size} selected
              </span>
              <Select onValueChange={(v) => bulkStatus(v as ContractStatusV2)}>
                <SelectTrigger className="h-8 w-[160px] text-[12px]">
                  <SelectValue placeholder="Change status…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending_signature">Pending signature</SelectItem>
                  <SelectItem value="renewed">Renewed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPendingBulkArchive(true)}
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
              <Button size="sm" variant="ghost" onClick={bulkExportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={bulkExportXlsx}>
                <Download className="h-3.5 w-3.5" /> Export XLSX
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setPendingBulkDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="h-3.5 w-3.5" /> Clear selection
              </Button>
            </div>
          ) : null
        }
        empty={
          filtered.length === 0 && !filtersActive && !query ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <FileSignature className="h-8 w-8 text-[var(--st-text-secondary)]" />
              <h3 className="text-base font-medium text-[var(--st-text)]">No contracts yet</h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                Draft your first contract to start tracking signatures and renewals.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/sales/contracts/new">
                  <Plus className="h-4 w-4" /> New contract
                </Link>
              </Button>
            </div>
          ) : null
        }
        pagination={
          <PaginationBar page={page} limit={limit} hasMore={hasMore} />
        }
      >
        <div className="flex flex-col gap-5">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kpiCards.map((card) => (
              <KpiCard
                key={card.key}
                label={card.label}
                value={card.value}
                tone={card.tone}
                active={statusFilter === card.key}
                onClick={() =>
                  updateFilter('status', statusFilter === card.key ? ALL : card.key)
                }
              />
            ))}
          </div>

          {error ? (
            <div className="rounded border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-3 py-2 text-[12.5px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
              {error}
            </div>
          ) : null}

          <Card className="overflow-hidden p-0">
            <Table>
              <THead>
                <Tr>
                  <Th className="w-[36px]">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </Th>
                  <Th>Title</Th>
                  <Th>Counter-party</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Effective</Th>
                  <Th>Expiry</Th>
                  <Th className="text-right">Value</Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.length === 0 ? (
                  <Tr>
                    <Td
                      colSpan={8}
                      className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      {filtersActive || query
                        ? 'No contracts match these filters.'
                        : 'No contracts yet — click "New contract" to add one.'}
                    </Td>
                  </Tr>
                ) : (
                  filtered.map((c) => {
                    const id = String(c._id);
                    const isSelected = selected.has(id);
                    return (
                      <Tr
                        key={id}
                        data-state={isSelected ? 'selected' : undefined}
                      >
                        <Td>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(id)}
                            aria-label={`Select ${c.title}`}
                          />
                        </Td>
                        <Td>
                          <EntityRowLink
                            href={`/dashboard/crm/sales/contracts/${id}`}
                            label={c.title || 'Untitled contract'}
                            subtitle={c.contractNo || undefined}
                          />
                        </Td>
                        <Td className="text-[12.5px] text-[var(--st-text)]">
                          {c.partyName || '—'}
                        </Td>
                        <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                          {c.type
                            ? c.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                            : '—'}
                        </Td>
                        <Td>
                          <StatusPill
                            label={c.status.replace(/_/g, ' ')}
                            tone={statusToTone(c.status)}
                          />
                        </Td>
                        <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                          {fmtDate(c.effectiveDate)}
                        </Td>
                        <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                          {fmtDate(c.expiryDate)}
                        </Td>
                        <Td className="text-right text-[12.5px] tabular-nums text-[var(--st-text)]">
                          {fmtMoney(c.value, c.currency)}
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </TBody>
            </Table>
          </Card>
        </div>
      </EntityListShell>

      {/* Single-row delete */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete contract?"
        description={
          pendingDelete
            ? `This permanently removes "${pendingDelete.title || 'Untitled contract'}". This action cannot be undone.`
            : 'This permanently removes the contract. This action cannot be undone.'
        }
        requireTyped="DELETE"
        confirmLabel="Delete permanently"
        onConfirm={async () => confirmSingleDelete()}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={pendingBulkDelete}
        onOpenChange={setPendingBulkDelete}
        title={`Delete ${selected.size} contract${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected contracts. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => bulkDelete()}
      />

      {/* Bulk archive */}
      <ConfirmDialog
        open={pendingBulkArchive}
        onOpenChange={setPendingBulkArchive}
        title={`Archive ${selected.size} contract${selected.size === 1 ? '' : 's'}?`}
        description="Sets the status of selected contracts to Terminated. They remain in the database."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulkArchive()}
      />

      {busy ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
