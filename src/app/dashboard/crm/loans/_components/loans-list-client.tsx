'use client';

import {
  Button,
  Card,
  Checkbox,
  Input,
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
} from '@/components/sabcrm/20ui/compat';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  ListChecks,
  Pencil,
  Search,
  X } from 'lucide-react';

/**
 * Loans list client — §1D.1 upgrade. Adds KPI strip, filter chips, and
 * client-side bulk selection (CSV export) on top of the legacy server
 * Mongo read.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import {
  LoansKpiStrip,
  computeLoanKpis,
  type LoansKpiKey,
} from './loans-kpi-strip';
import type { LoanRow } from './loans-types';

interface LoansListClientProps {
  loans: LoanRow[];
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function fmtMoney(v?: number): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return inr.format(v);
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtType(t?: string): string {
  if (!t) return '—';
  return t
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function LoansListClient({ loans }: LoansListClientProps) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [typeFilter, setTypeFilter] = React.useState<'all' | string>('all');
  const [borrowerTypeFilter, setBorrowerTypeFilter] = React.useState<
    'all' | string
  >('all');
  const [dateFromFilter, setDateFromFilter] = React.useState('');
  const [dateToFilter, setDateToFilter] = React.useState('');
  const [kpiKey, setKpiKey] = React.useState<LoansKpiKey>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const statusOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of loans) if (r.status) s.add(r.status);
    return Array.from(s).sort();
  }, [loans]);

  const typeOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of loans) if (r.type) s.add(r.type);
    return Array.from(s).sort();
  }, [loans]);

  const kpis = React.useMemo(() => computeLoanKpis(loans), [loans]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    const from = dateFromFilter ? new Date(dateFromFilter).getTime() : NaN;
    const to = dateToFilter ? new Date(dateToFilter).getTime() : NaN;
    const now = Date.now();
    return loans.filter((r) => {
      if (needle) {
        const hay = [
          r.borrowerName ?? '',
          r.borrowerId ?? '',
          r.type ?? '',
          r.status ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (
        borrowerTypeFilter !== 'all' &&
        r.borrowerType !== borrowerTypeFilter
      ) {
        return false;
      }
      if (Number.isFinite(from) || Number.isFinite(to)) {
        const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
        if (!Number.isFinite(t)) return false;
        if (Number.isFinite(from) && t < from) return false;
        if (Number.isFinite(to) && t > to + 24 * 60 * 60 * 1000) return false;
      }
      switch (kpiKey) {
        case 'active':
          if ((r.status ?? '').toLowerCase() !== 'active') return false;
          break;
        case 'overdue':
          if (
            !r.npa &&
            (r.status ?? '').toLowerCase() !== 'overdue' &&
            (r.status ?? '').toLowerCase() !== 'npa'
          ) {
            return false;
          }
          break;
        case 'dueSoon':
          {
            const t = r.nextPaymentAt
              ? new Date(r.nextPaymentAt).getTime()
              : NaN;
            const seven = now + 7 * 24 * 60 * 60 * 1000;
            if (!Number.isFinite(t) || t < now || t > seven) return false;
          }
          break;
      }
      return true;
    });
  }, [
    loans,
    search,
    statusFilter,
    typeFilter,
    borrowerTypeFilter,
    dateFromFilter,
    dateToFilter,
    kpiKey,
  ]);

  const hasActiveFilters =
    !!search.trim() ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    borrowerTypeFilter !== 'all' ||
    !!dateFromFilter ||
    !!dateToFilter ||
    kpiKey !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setBorrowerTypeFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setKpiKey('all');
  };

  const headChecked =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(filtered.map((r) => r._id)) : new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () => {
    const subset =
      selected.size > 0
        ? filtered.filter((r) => selected.has(r._id))
        : filtered;
    const header = [
      'Type',
      'Borrower',
      'Borrower type',
      'Principal',
      'Interest %',
      'Tenure (m)',
      'EMI',
      'Outstanding',
      'Status',
      'Next payment',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      header.join(','),
      ...subset.map((r) =>
        [
          esc(r.type),
          esc(r.borrowerName ?? r.borrowerId),
          esc(r.borrowerType),
          esc(r.principal),
          esc(r.interestRate),
          esc(r.tenureMonths),
          esc(r.emi),
          esc(r.outstanding),
          esc(r.status),
          esc(r.nextPaymentAt),
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loans-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <LoansKpiStrip counts={kpis} active={kpiKey} onPick={setKpiKey} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search borrower, type, status…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
            <ZoruSelectValue placeholder="Status" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
            {statusOptions.map((s) => (
              <ZoruSelectItem key={s} value={s}>
                {s}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="Type" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All types</ZoruSelectItem>
            {typeOptions.map((t) => (
              <ZoruSelectItem key={t} value={t}>
                {fmtType(t)}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <EnumFilterField
          enumName="borrowerType"
          value={borrowerTypeFilter}
          onChange={setBorrowerTypeFilter}
          allLabel="All borrowers"
        />
        <Input
          type="date"
          value={dateFromFilter}
          onChange={(e) => setDateFromFilter(e.target.value)}
          className="h-9 w-[150px] text-[13px]"
          aria-label="From"
        />
        <Input
          type="date"
          value={dateToFilter}
          onChange={(e) => setDateToFilter(e.target.value)}
          className="h-9 w-[150px] text-[13px]"
          aria-label="To"
        />
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
            <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
            {selected.size} selected
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              Export CSV
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

      <Card className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                <ZoruTableHead className="w-8">
                  <Checkbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Type</ZoruTableHead>
                <ZoruTableHead>Borrower</ZoruTableHead>
                <ZoruTableHead>Principal</ZoruTableHead>
                <ZoruTableHead>Interest %</ZoruTableHead>
                <ZoruTableHead>Tenure (m)</ZoruTableHead>
                <ZoruTableHead>EMI</ZoruTableHead>
                <ZoruTableHead>Outstanding</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Next payment</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={11}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    {loans.length === 0
                      ? 'No loans yet. Disburse a new loan to start tracking EMIs.'
                      : 'No loans match these filters.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((r) => (
                  <ZoruTableRow key={r._id}>
                    <ZoruTableCell>
                      <Checkbox
                        checked={selected.has(r._id)}
                        onCheckedChange={() => toggleOne(r._id)}
                        aria-label={`Select loan`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>{fmtType(r.type)}</ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/loans/${r._id}`}
                        label={r.borrowerName || r.borrowerId || '—'}
                        subtitle={r.type ? fmtType(r.type) : undefined}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>{fmtMoney(r.principal)}</ZoruTableCell>
                    <ZoruTableCell>
                      {typeof r.interestRate === 'number'
                        ? `${r.interestRate}%`
                        : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {typeof r.tenureMonths === 'number'
                        ? r.tenureMonths
                        : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>{fmtMoney(r.emi)}</ZoruTableCell>
                    <ZoruTableCell>{fmtMoney(r.outstanding)}</ZoruTableCell>
                    <ZoruTableCell>
                      <StatusPill
                        label={r.status || 'draft'}
                        tone={statusToTone(r.status)}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>{fmtDate(r.nextPaymentAt)}</ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/loans/${r._id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
