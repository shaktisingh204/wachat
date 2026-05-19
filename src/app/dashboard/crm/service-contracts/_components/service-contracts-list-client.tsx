'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  ListChecks,
  Plus,
  Search,
  Wrench,
  X } from 'lucide-react';

/**
 * Service Contracts (AMC) list — §1D.1 upgrade adding KPI strip,
 * filter chips, and bulk select to the original server-driven table.
 *
 * Note: the underlying data still flows through the legacy Mongo read
 * path in `<ServiceContractsPage>` — this client takes the
 * pre-serialised rows and layers KPI + filter behaviour on top. Bulk
 * actions are scoped to client-side ops (CSV export); destructive
 * server-side bulk actions are deferred until the Rust list endpoint
 * exposes a bulk handler.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

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

function formatPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s === '—' && e === '—') return '—';
  return `${s} → ${e}`;
}

function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function ServiceContractsListClient({
  contracts,
}: ServiceContractsListClientProps) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [customerFilter, setCustomerFilter] = React.useState<'all' | string>(
    'all',
  );
  const [technicianFilter, setTechnicianFilter] = React.useState<'all' | string>(
    'all',
  );
  const [expiryFilter, setExpiryFilter] = React.useState<
    'all' | '30d' | '60d' | '90d'
  >('all');
  const [kpiKey, setKpiKey] = React.useState<ServiceContractsKpiKey>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

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

  const kpis = React.useMemo(
    () => computeServiceContractKpis(contracts),
    [contracts],
  );

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
      if (technicianFilter !== 'all' && c.technicianId !== technicianFilter)
        return false;
      if (expiryFilter !== 'all') {
        const horizon =
          expiryFilter === '30d'
            ? 30
            : expiryFilter === '60d'
              ? 60
              : 90;
        const end = c.periodEnd ? new Date(c.periodEnd).getTime() : NaN;
        if (!Number.isFinite(end)) return false;
        const diff = daysBetween(now, end);
        if (diff < 0 || diff > horizon) return false;
      }
      switch (kpiKey) {
        case 'active':
          if ((c.status ?? '').toLowerCase() !== 'active') return false;
          break;
        case 'expiring30':
          {
            const end = c.periodEnd ? new Date(c.periodEnd).getTime() : NaN;
            if (!Number.isFinite(end)) return false;
            const diff = daysBetween(now, end);
            if (diff < 0 || diff > 30) return false;
          }
          break;
        case 'renewals':
          if (!c.renewalDue) return false;
          break;
      }
      return true;
    });
  }, [
    contracts,
    search,
    statusFilter,
    customerFilter,
    technicianFilter,
    expiryFilter,
    kpiKey,
  ]);

  const hasActiveFilters =
    !!search.trim() ||
    statusFilter !== 'all' ||
    customerFilter !== 'all' ||
    technicianFilter !== 'all' ||
    expiryFilter !== 'all' ||
    kpiKey !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCustomerFilter('all');
    setTechnicianFilter('all');
    setExpiryFilter('all');
    setKpiKey('all');
  };

  const headChecked =
    filtered.length > 0 &&
    filtered.every((c) => selected.has(c._id));

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(filtered.map((c) => c._id)) : new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () => {
    const rows =
      selected.size > 0
        ? filtered.filter((c) => selected.has(c._id))
        : filtered;
    const header = [
      'Contract no',
      'Customer',
      'Coverage',
      'Start',
      'End',
      'Technician',
      'Status',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      header.join(','),
      ...rows.map((c) =>
        [
          esc(c.contractNo),
          esc(c.customerName ?? c.customerId),
          esc(c.coverage),
          esc(c.periodStart),
          esc(c.periodEnd),
          esc(c.technicianName ?? c.technicianId),
          esc(c.status),
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-contracts-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <ServiceContractsKpiStrip
        counts={kpis}
        active={kpiKey}
        onPick={setKpiKey}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
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
          onChange={(v) => setExpiryFilter(v as 'all' | '30d' | '60d' | '90d')}
          placeholder="Expiry"
          options={[
            { value: 'all', label: 'Any expiry' },
            { value: '30d', label: 'Expiring 30d' },
            { value: '60d', label: 'Expiring 60d' },
            { value: '90d', label: 'Expiring 90d' },
          ]}
        />
        {hasActiveFilters ? (
          <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </ZoruButton>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
          <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
            <ListChecks className="h-4 w-4 text-zoru-primary" />
            {selected.size} selected
          </div>
          <div className="flex items-center gap-1">
            <ZoruButton size="sm" variant="outline" onClick={exportCsv}>
              Export CSV
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

      <ZoruCard className="p-0">
        <div className="overflow-x-auto">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-8">
                  <ZoruCheckbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Contract no.</ZoruTableHead>
                <ZoruTableHead>Customer</ZoruTableHead>
                <ZoruTableHead>Coverage</ZoruTableHead>
                <ZoruTableHead>Start</ZoruTableHead>
                <ZoruTableHead>End</ZoruTableHead>
                <ZoruTableHead>Technician</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    {contracts.length === 0 ? (
                      <span className="inline-flex items-center gap-2">
                        <Wrench className="h-4 w-4" /> No service contracts
                        yet. Create an AMC to start scheduling visits.
                      </span>
                    ) : (
                      'No contracts match these filters.'
                    )}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((c) => {
                  const checked = selected.has(c._id);
                  return (
                    <ZoruTableRow key={c._id}>
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(c._id)}
                          aria-label={`Select ${c.contractNo}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        <EntityRowLink
                          href={`/dashboard/crm/service-contracts/${c._id}`}
                          label={c.contractNo || '—'}
                          subtitle={c.customerName || undefined}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {c.customerName || c.customerId || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {c.coverage || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(c.periodStart)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {formatDate(c.periodEnd)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {c.technicianName || c.technicianId || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill
                          label={c.status || 'draft'}
                          tone={statusToTone(c.status)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton size="sm" variant="ghost" asChild>
                          <Link
                            href={`/dashboard/crm/service-contracts/${c._id}/edit`}
                          >
                            Edit
                          </Link>
                        </ZoruButton>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
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
    <ZoruSelect value={value} onValueChange={onChange}>
      <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
        <ZoruSelectValue placeholder={placeholder} />
      </ZoruSelectTrigger>
      <ZoruSelectContent>
        {options.map((opt) => (
          <ZoruSelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </ZoruSelectItem>
        ))}
      </ZoruSelectContent>
    </ZoruSelect>
  );
}

// Re-export Plus icon so the parent shell can use the same icon set
export { Plus };
