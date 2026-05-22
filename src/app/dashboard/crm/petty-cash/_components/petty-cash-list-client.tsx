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
} from '@/components/zoruui';
import {
  ListChecks,
  Search,
  X } from 'lucide-react';

/**
 * Petty cash list client — §1D.1 upgrade. Adds KPI strip, filter
 * chips, and client-side bulk selection (CSV export).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import {
  PettyCashKpiStrip,
  computePettyCashKpis,
  type PettyCashKpiKey,
} from './petty-cash-kpi-strip';
import type { PettyCashRow } from './petty-cash-types';

interface PettyCashListClientProps {
  floats: PettyCashRow[];
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

export function PettyCashListClient({ floats }: PettyCashListClientProps) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [branchFilter, setBranchFilter] = React.useState<'all' | string>('all');
  const [custodianFilter, setCustodianFilter] = React.useState<'all' | string>(
    'all',
  );
  const [kpiKey, setKpiKey] = React.useState<PettyCashKpiKey>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const branchOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of floats) {
      const id = r.branchId ?? r.branchName;
      if (!id) continue;
      m.set(id, r.branchName || id);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [floats]);

  const custodianOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of floats) {
      const id = r.custodianId ?? r.custodianName;
      if (!id) continue;
      m.set(id, r.custodianName || id);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [floats]);

  const statusOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of floats) if (r.status) s.add(r.status);
    return Array.from(s).sort();
  }, [floats]);

  const kpis = React.useMemo(() => computePettyCashKpis(floats), [floats]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    return floats.filter((r) => {
      if (needle) {
        const hay = [
          r.branchName ?? '',
          r.custodianName ?? '',
          r.status ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (
        branchFilter !== 'all' &&
        (r.branchId ?? r.branchName) !== branchFilter
      )
        return false;
      if (
        custodianFilter !== 'all' &&
        (r.custodianId ?? r.custodianName) !== custodianFilter
      )
        return false;
      switch (kpiKey) {
        case 'active':
          if ((r.status ?? '').toLowerCase() !== 'active') return false;
          break;
        case 'topUpDue':
          {
            const due = r.topUpDueAt ? new Date(r.topUpDueAt).getTime() : NaN;
            if (
              !(Number.isFinite(due) && due <= now) &&
              !(typeof r.balance === 'number' && r.balance <= 0)
            )
              return false;
          }
          break;
        case 'ious':
          if (!r.pendingIous || r.pendingIous <= 0) return false;
          break;
      }
      return true;
    });
  }, [floats, search, statusFilter, branchFilter, custodianFilter, kpiKey]);

  const hasActiveFilters =
    !!search.trim() ||
    statusFilter !== 'all' ||
    branchFilter !== 'all' ||
    custodianFilter !== 'all' ||
    kpiKey !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setBranchFilter('all');
    setCustodianFilter('all');
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
      'Branch',
      'Custodian',
      'Opening',
      'Top-ups',
      'Spent',
      'Balance',
      'Last reconciled',
      'Status',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      header.join(','),
      ...subset.map((r) =>
        [
          esc(r.branchName ?? r.branchId),
          esc(r.custodianName ?? r.custodianId),
          esc(r.openingBalance),
          esc(r.totalTopUps),
          esc(r.totalSpent),
          esc(r.balance),
          esc(r.lastReconciledAt),
          esc(r.status),
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `petty-cash-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <PettyCashKpiStrip counts={kpis} active={kpiKey} onPick={setKpiKey} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branch, custodian, status…"
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
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="Branch" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All branches</ZoruSelectItem>
            {branchOptions.map((b) => (
              <ZoruSelectItem key={b.id} value={b.id}>
                {b.name}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Select value={custodianFilter} onValueChange={setCustodianFilter}>
          <ZoruSelectTrigger className="h-9 w-[180px] text-[13px]">
            <ZoruSelectValue placeholder="Custodian" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All custodians</ZoruSelectItem>
            {custodianOptions.map((c) => (
              <ZoruSelectItem key={c.id} value={c.id}>
                {c.name}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
          <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
            <ListChecks className="h-4 w-4 text-zoru-primary" />
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
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-8">
                  <Checkbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Branch</ZoruTableHead>
                <ZoruTableHead>Custodian</ZoruTableHead>
                <ZoruTableHead>Opening</ZoruTableHead>
                <ZoruTableHead>Current</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Last topped-up</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    {floats.length === 0
                      ? 'No petty cash floats yet. Open a branch or employee float to start tracking.'
                      : 'No floats match these filters.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((r) => (
                  <ZoruTableRow key={r._id}>
                    <ZoruTableCell>
                      <Checkbox
                        checked={selected.has(r._id)}
                        onCheckedChange={() => toggleOne(r._id)}
                        aria-label="Select"
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/petty-cash/${r._id}`}
                        label={r.branchName || r.branchId || '—'}
                        subtitle={r.custodianName || r.custodianId || undefined}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {r.custodianName || r.custodianId || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {fmtMoney(r.openingBalance)}
                    </ZoruTableCell>
                    <ZoruTableCell>{fmtMoney(r.balance)}</ZoruTableCell>
                    <ZoruTableCell>
                      <StatusPill
                        label={r.status || 'active'}
                        tone={statusToTone(r.status)}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {fmtDate(r.lastToppedUpAt ?? r.lastReconciledAt)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/petty-cash/${r._id}/edit`}>
                          Edit
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
