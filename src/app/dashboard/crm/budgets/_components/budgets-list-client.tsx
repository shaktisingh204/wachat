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
 * Budgets list client — §1D.1 upgrade. Adds KPI strip, filter chips,
 * and client-side bulk selection (CSV export). Source data still
 * flows from the legacy Mongo read on the server page.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import {
  BudgetsKpiStrip,
  computeBudgetKpis,
  type BudgetsKpiKey,
} from './budgets-kpi-strip';
import type { BudgetRow } from './budgets-types';

interface BudgetsListClientProps {
  budgets: BudgetRow[];
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

export function BudgetsListClient({ budgets }: BudgetsListClientProps) {
  const [mounted, setMounted] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [headTypeFilter, setHeadTypeFilter] = React.useState<'all' | string>(
    'all',
  );
  const [periodFilter, setPeriodFilter] = React.useState<'all' | string>('all');
  const [ownerFilter, setOwnerFilter] = React.useState<'all' | string>('all');
  const [scenarioFilter, setScenarioFilter] = React.useState<'all' | string>(
    'all',
  );
  const [kpiKey, setKpiKey] = React.useState<BudgetsKpiKey>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const headTypeOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of budgets) if (r.headType) s.add(r.headType);
    return Array.from(s).sort();
  }, [budgets]);

  const periodOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of budgets) if (r.period) s.add(r.period);
    return Array.from(s).sort();
  }, [budgets]);

  const ownerOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of budgets) {
      const id = r.ownerId ?? r.ownerName;
      if (!id) continue;
      m.set(id, r.ownerName || id);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [budgets]);

  const scenarioOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of budgets) if (r.scenario) s.add(r.scenario);
    return Array.from(s).sort();
  }, [budgets]);

  const statusOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of budgets) if (r.status) s.add(r.status);
    return Array.from(s).sort();
  }, [budgets]);

  const kpis = React.useMemo(() => computeBudgetKpis(budgets), [budgets]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return budgets.filter((r) => {
      if (needle) {
        const hay = [
          r.budgetHead ?? '',
          r.ownerName ?? '',
          r.period ?? '',
          r.status ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (headTypeFilter !== 'all' && r.headType !== headTypeFilter)
        return false;
      if (periodFilter !== 'all' && r.period !== periodFilter) return false;
      if (
        ownerFilter !== 'all' &&
        (r.ownerId ?? r.ownerName) !== ownerFilter
      )
        return false;
      if (scenarioFilter !== 'all' && r.scenario !== scenarioFilter)
        return false;
      switch (kpiKey) {
        case 'active':
          {
            const s = (r.status ?? '').toLowerCase();
            if (s === 'archived' || s === 'rejected') return false;
          }
          break;
        case 'over':
          if (
            typeof r.actual !== 'number' ||
            typeof r.planAmount !== 'number' ||
            r.planAmount <= 0 ||
            r.actual <= r.planAmount
          )
            return false;
          break;
        case 'under':
          if (
            typeof r.actual !== 'number' ||
            typeof r.planAmount !== 'number' ||
            r.planAmount <= 0 ||
            r.actual > r.planAmount
          )
            return false;
          break;
      }
      return true;
    });
  }, [
    budgets,
    search,
    statusFilter,
    headTypeFilter,
    periodFilter,
    ownerFilter,
    scenarioFilter,
    kpiKey,
  ]);

  const hasActiveFilters =
    !!search.trim() ||
    statusFilter !== 'all' ||
    headTypeFilter !== 'all' ||
    periodFilter !== 'all' ||
    ownerFilter !== 'all' ||
    scenarioFilter !== 'all' ||
    kpiKey !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setHeadTypeFilter('all');
    setPeriodFilter('all');
    setOwnerFilter('all');
    setScenarioFilter('all');
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
      'Head',
      'Period',
      'Planned',
      'Actual',
      'Variance',
      'Owner',
      'Approver',
      'Scenario',
      'Status',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      header.join(','),
      ...subset.map((r) =>
        [
          esc(r.budgetHead),
          esc(r.period),
          esc(r.planAmount),
          esc(r.actual),
          esc(r.variance),
          esc(r.ownerName ?? r.ownerId),
          esc(r.approverName ?? r.approverId),
          esc(r.scenario),
          esc(r.status),
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budgets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!mounted) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-lg border border-zoru-line border-dashed bg-zoru-surface/50">
        <span className="text-sm text-zoru-ink-muted">Loading budgets...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BudgetsKpiStrip counts={kpis} active={kpiKey} onPick={setKpiKey} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search head, period, owner…"
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
        <Select value={headTypeFilter} onValueChange={setHeadTypeFilter}>
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="Head type" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All head types</ZoruSelectItem>
            {headTypeOptions.map((t) => (
              <ZoruSelectItem key={t} value={t}>
                {t}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
            <ZoruSelectValue placeholder="Period" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All periods</ZoruSelectItem>
            {periodOptions.map((p) => (
              <ZoruSelectItem key={p} value={p}>
                {p}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="Owner" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All owners</ZoruSelectItem>
            {ownerOptions.map((o) => (
              <ZoruSelectItem key={o.id} value={o.id}>
                {o.name}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Select value={scenarioFilter} onValueChange={setScenarioFilter}>
          <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
            <ZoruSelectValue placeholder="Scenario" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All scenarios</ZoruSelectItem>
            {scenarioOptions.map((s) => (
              <ZoruSelectItem key={s} value={s}>
                {s}
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
                <ZoruTableHead>Head</ZoruTableHead>
                <ZoruTableHead>Period</ZoruTableHead>
                <ZoruTableHead>Planned</ZoruTableHead>
                <ZoruTableHead>Actual</ZoruTableHead>
                <ZoruTableHead>Variance</ZoruTableHead>
                <ZoruTableHead>Owner</ZoruTableHead>
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
                    {budgets.length === 0
                      ? 'No budgets yet. Create a budget to start tracking actuals against plan.'
                      : 'No budgets match these filters.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((r) => {
                  const variance =
                    typeof r.variance === 'number' ? r.variance : undefined;
                  const varianceCls =
                    variance === undefined
                      ? ''
                      : variance < 0
                        ? 'text-zoru-ink'
                        : 'text-zoru-ink';
                  return (
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
                          href={`/dashboard/crm/budgets/${r._id}`}
                          label={r.budgetHead || '—'}
                          subtitle={r.headType || r.period || undefined}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>{r.period || '—'}</ZoruTableCell>
                      <ZoruTableCell>{fmtMoney(r.planAmount)}</ZoruTableCell>
                      <ZoruTableCell>{fmtMoney(r.actual)}</ZoruTableCell>
                      <ZoruTableCell className={varianceCls}>
                        {fmtMoney(variance)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {r.ownerName || r.ownerId || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill
                          label={r.status || 'draft'}
                          tone={statusToTone(r.status)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/crm/budgets/${r._id}/edit`}>
                            Edit
                          </Link>
                        </Button>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
