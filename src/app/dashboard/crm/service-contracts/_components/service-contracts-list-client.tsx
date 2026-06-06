'use client';

import { Button, Card, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Download,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';

/**
 * Service Contracts (AMC) list — §1D full upgrade.
 *
 * Layers over pre-serialised rows from the server page:
 *   - KPI strip (active, expiring 30d, renewals due, total billed, avg coverage)
 *   - Filters (search, status, customer, technician, expiry horizon)
 *   - Checkbox selection with bulk bar (renew / terminate / delete / export)
 *   - Export CSV + XLSX
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

import { bulkServiceContractAction } from '@/app/actions/crm-service-contracts.actions';

import {
  ServiceContractsKpiStrip,
  computeServiceContractKpis,
  type ServiceContractsKpiKey,
} from './service-contracts-kpi-strip';
import type { ServiceContractRow } from './service-contracts-types';

interface ServiceContractsListClientProps {
  contracts: ServiceContractRow[];
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

const EXPORT_HEADERS = [
  'contract_no',
  'customer',
  'coverage',
  'frequency',
  'start',
  'end',
  'technician',
  'status',
  'value',
];

function toExportRow(c: ServiceContractRow): ExportRow {
  return {
    contract_no: c.contractNo ?? '',
    customer: c.customerName ?? c.customerId ?? '',
    coverage: c.coverage ?? '',
    frequency: c.frequency ?? '',
    start: c.periodStart ?? '',
    end: c.periodEnd ?? '',
    technician: c.technicianName ?? c.technicianId ?? '',
    status: c.status ?? '',
    value: c.value ?? c.billedAmount ?? '',
  };
}

export function ServiceContractsListClient({
  contracts,
}: ServiceContractsListClientProps) {
  const { toast } = useToast();

  /* Filters */
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [customerFilter, setCustomerFilter] = React.useState<'all' | string>('all');
  const [technicianFilter, setTechnicianFilter] = React.useState<'all' | string>('all');
  const [expiryFilter, setExpiryFilter] = React.useState<'all' | '30d' | '60d' | '90d'>('all');
  const [kpiKey, setKpiKey] = React.useState<ServiceContractsKpiKey>('all');

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Bulk confirm dialogs */
  const [bulkOp, setBulkOp] = React.useState<'renew' | 'terminate' | 'delete' | null>(null);
  const [bulkPending, startBulkTransition] = React.useTransition();

  /* Derived options */
  const statusOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of contracts) if (c.status) set.add(c.status);
    return Array.from(set).sort();
  }, [contracts]);

  const customerOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contracts) {
      if (!c.customerId) continue;
      map.set(c.customerId, c.customerName || c.customerId);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [contracts]);

  const technicianOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contracts) {
      if (!c.technicianId) continue;
      map.set(c.technicianId, c.technicianName || c.technicianId);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [contracts]);

  /* KPIs */
  const kpis = React.useMemo(
    () => computeServiceContractKpis(contracts),
    [contracts],
  );

  /* Filtered rows */
  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    return contracts.filter((c) => {
      if (needle) {
        const hay = [
          c.contractNo ?? '',
          c.customerName ?? '',
          c.technicianName ?? '',
          c.coverage ?? '',
          c.status ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (customerFilter !== 'all' && c.customerId !== customerFilter) return false;
      if (technicianFilter !== 'all' && c.technicianId !== technicianFilter) return false;
      if (expiryFilter !== 'all') {
        const horizon =
          expiryFilter === '30d' ? 30 : expiryFilter === '60d' ? 60 : 90;
        const end = c.periodEnd ? new Date(c.periodEnd).getTime() : NaN;
        if (!Number.isFinite(end)) return false;
        const diff = daysBetween(now, end);
        if (diff < 0 || diff > horizon) return false;
      }
      switch (kpiKey) {
        case 'active':
          if ((c.status ?? '').toLowerCase() !== 'active') return false;
          break;
        case 'expiring30': {
          const end = c.periodEnd ? new Date(c.periodEnd).getTime() : NaN;
          if (!Number.isFinite(end)) return false;
          const diff = daysBetween(now, end);
          if (diff < 0 || diff > 30) return false;
          break;
        }
        case 'renewals':
          if (!c.renewalDue) return false;
          break;
      }
      return true;
    });
  }, [contracts, search, statusFilter, customerFilter, technicianFilter, expiryFilter, kpiKey]);

  /* Selection helpers */
  const headChecked =
    filtered.length > 0 && filtered.every((c) => selected.has(c._id));

  const toggleAll = React.useCallback(
    (all: boolean) =>
      setSelected(all ? new Set(filtered.map((c) => c._id)) : new Set()),
    [filtered],
  );

  const toggleOne = React.useCallback(
    (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  const hasActiveFilters =
    !!search.trim() ||
    statusFilter !== 'all' ||
    customerFilter !== 'all' ||
    technicianFilter !== 'all' ||
    expiryFilter !== 'all' ||
    kpiKey !== 'all';

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setCustomerFilter('all');
    setTechnicianFilter('all');
    setExpiryFilter('all');
    setKpiKey('all');
  }, []);

  /* Export */
  const exportCsv = React.useCallback(() => {
    const rows =
      selected.size > 0
        ? filtered.filter((c) => selected.has(c._id))
        : filtered;
    if (rows.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    downloadCsv(
      `service-contracts-${dateStamp()}.csv`,
      EXPORT_HEADERS,
      rows.map(toExportRow),
    );
    toast({ title: 'Exported', description: `${rows.length} contracts saved to CSV.` });
  }, [filtered, selected, toast]);

  const exportXlsx = React.useCallback(async () => {
    const rows =
      selected.size > 0
        ? filtered.filter((c) => selected.has(c._id))
        : filtered;
    if (rows.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    await downloadXlsx(
      `service-contracts-${dateStamp()}.xlsx`,
      EXPORT_HEADERS,
      rows.map(toExportRow),
      'Service Contracts',
    );
    toast({ title: 'Exported', description: `${rows.length} contracts saved to XLSX.` });
  }, [filtered, selected, toast]);

  /* Bulk confirm handler */
  const handleBulkConfirm = React.useCallback(() => {
    if (!bulkOp || selected.size === 0) return;
    const ids = Array.from(selected);
    startBulkTransition(async () => {
      const res = await bulkServiceContractAction(ids, bulkOp);
      if (res.success) {
        toast({
          title: `${res.processed} contract${res.processed === 1 ? '' : 's'} ${
            bulkOp === 'delete'
              ? 'deleted'
              : bulkOp === 'renew'
                ? 'renewed'
                : 'terminated'
          }`,
        });
        setSelected(new Set());
      } else {
        toast({
          title: 'Bulk action failed',
          description: res.error,
          variant: 'destructive',
        });
      }
      setBulkOp(null);
    });
  }, [bulkOp, selected, toast]);

  return (
    <div className="flex flex-col gap-4">
      <ServiceContractsKpiStrip counts={kpis} active={kpiKey} onPick={setKpiKey} />

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contract no, customer, coverage…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="Status"
          options={[
            { value: 'all', label: 'All statuses' },
            ...statusOptions.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterSelect
          value={customerFilter}
          onChange={setCustomerFilter}
          placeholder="Customer"
          options={[
            { value: 'all', label: 'All customers' },
            ...customerOptions.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterSelect
          value={technicianFilter}
          onChange={setTechnicianFilter}
          placeholder="Technician"
          options={[
            { value: 'all', label: 'All technicians' },
            ...technicianOptions.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        <FilterSelect
          value={expiryFilter}
          onChange={(v) =>
            setExpiryFilter(v as 'all' | '30d' | '60d' | '90d')
          }
          placeholder="Expiry"
          options={[
            { value: 'all', label: 'Any expiry' },
            { value: '30d', label: 'Expiring 30d' },
            { value: '60d', label: 'Expiring 60d' },
            { value: '90d', label: 'Expiring 90d' },
          ]}
        />
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
            <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
            {selected.size} selected
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkOp('renew')}
              disabled={bulkPending}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Renew
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkOp('terminate')}
              disabled={bulkPending}
            >
              <XCircle className="h-3.5 w-3.5" /> Terminate
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportXlsx}>
              <Download className="h-3.5 w-3.5" /> XLSX
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkOp('delete')}
              disabled={bulkPending}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Export row (no selection) */}
      {selected.size === 0 && filtered.length > 0 ? (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={exportXlsx}>
            <Download className="h-3.5 w-3.5" /> Export XLSX
          </Button>
        </div>
      ) : null}

      {/* Table */}
      <Card className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th className="w-8">
                  <Checkbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </Th>
                <Th>Contract no.</Th>
                <Th>Customer</Th>
                <Th>Coverage</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Technician</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    {contracts.length === 0 ? (
                      <span className="inline-flex items-center gap-2">
                        <Wrench className="h-4 w-4" /> No service contracts yet.
                        Create an AMC to start scheduling visits.
                      </span>
                    ) : (
                      'No contracts match these filters.'
                    )}
                  </Td>
                </Tr>
              ) : (
                filtered.map((c) => {
                  const checked = selected.has(c._id);
                  return (
                    <Tr key={c._id}>
                      <Td>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(c._id)}
                          aria-label={`Select ${c.contractNo ?? c._id}`}
                        />
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        <EntityRowLink
                          href={`/dashboard/crm/service-contracts/${c._id}`}
                          label={c.contractNo || '—'}
                          subtitle={c.customerName || undefined}
                        />
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {c.customerName || c.customerId || '—'}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {c.coverage || '—'}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {formatDate(c.periodStart)}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {formatDate(c.periodEnd)}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {c.technicianName || c.technicianId || '—'}
                      </Td>
                      <Td>
                        <StatusPill
                          label={c.status || 'draft'}
                          tone={statusToTone(c.status)}
                        />
                      </Td>
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            href={`/dashboard/crm/service-contracts/${c._id}/edit`}
                          >
                            Edit
                          </Link>
                        </Button>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      {/* Bulk confirm dialogs */}
      <ConfirmDialog
        open={bulkOp === 'renew'}
        onOpenChange={(o) => !o && setBulkOp(null)}
        title={`Renew ${selected.size} contract${selected.size === 1 ? '' : 's'}?`}
        description="Each contract will be set to active and its period extended by the original duration (minimum 1 year)."
        confirmLabel="Renew"
        confirmTone="primary"
        onConfirm={handleBulkConfirm}
      />

      <ConfirmDialog
        open={bulkOp === 'terminate'}
        onOpenChange={(o) => !o && setBulkOp(null)}
        title={`Terminate ${selected.size} contract${selected.size === 1 ? '' : 's'}?`}
        description="Selected contracts will be set to closed. This cannot be automatically reversed."
        confirmLabel="Terminate"
        confirmTone="primary"
        onConfirm={handleBulkConfirm}
      />

      <ConfirmDialog
        open={bulkOp === 'delete'}
        onOpenChange={(o) => !o && setBulkOp(null)}
        title={`Delete ${selected.size} contract${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected service contracts. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkConfirm}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[160px] text-[13px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Re-export Plus icon so the parent shell can use the same icon set
export { Plus };
