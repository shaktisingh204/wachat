'use client';

import {
  Button,
  Card,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  Download,
  ListChecks,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * <RecurringExpensesListClient> — canonical list view per §1D thin slice.
 *
 * KPI strip (4 cards) · filters (status, vendor, frequency, next-run
 * range) · bulk bar (pause / resume / delete / export) · 10-column
 * table.
 *
 * Recurring expenses live on Mongo (`crm_recurring_expenses`) via the
 * worksuite billing actions — no Rust BFF parity yet, so this view does
 * its own client-side filtering on a single fetched page.
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  deleteRecurringExpense,
  pauseRecurringExpense,
  resumeRecurringExpense,
} from '@/app/actions/worksuite/billing.actions';
import {
  dateStamp,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

import { RecurringExpensesKpiStrip } from './kpi-strip';
import type { RecurringExpenseKpiSnapshot, RecurringExpenseRow } from './types';

interface ListClientProps {
  rows: RecurringExpenseRow[];
  kpi: RecurringExpenseKpiSnapshot;
  defaultCurrency: string;
  /** Pagination state — defaults preserve the pre-pagination call sites. */
  page?: number;
  limit?: number;
  hasMore?: boolean;
  initialQuery?: string;
}

function fmtMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function toCsv(rows: RecurringExpenseRow[]): string {
  const head = [
    'name',
    'vendor',
    'frequency',
    'frequency_count',
    'amount',
    'currency',
    'next_run',
    'until',
    'last_run',
    'status',
  ];
  const body = rows.map((r) =>
    [
      r.name,
      r.vendor ?? '',
      r.frequency,
      r.frequency_count,
      r.amount,
      r.currency,
      r.next_run_date ?? '',
      r.until_date ?? '',
      r.last_run_date ?? '',
      r.status,
    ]
      .map((cell) => {
        const v = String(cell ?? '');
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(','),
  );
  return [head.join(','), ...body].join('\n');
}

export function RecurringExpensesListClient({
  rows: serverRows,
  kpi,
  defaultCurrency,
  page = 1,
  limit = 25,
  hasMore = false,
  initialQuery = '',
}: ListClientProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [pending, startTransition] = React.useTransition();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [frequencyFilter, setFrequencyFilter] = React.useState('all');
  const [nextFrom, setNextFrom] = React.useState('');
  const [nextTo, setNextTo] = React.useState('');

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deletePending, setDeletePending] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = nextFrom ? new Date(nextFrom).getTime() : null;
    const toTs = nextTo ? new Date(nextTo).getTime() : null;
    return serverRows.filter((row) => {
      if (q) {
        const hay = `${row.name ?? ''} ${row.vendor ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (frequencyFilter !== 'all' && row.frequency !== frequencyFilter)
        return false;
      if (fromTs && row.next_run_date) {
        const t = new Date(row.next_run_date).getTime();
        if (!Number.isNaN(t) && t < fromTs) return false;
      }
      if (toTs && row.next_run_date) {
        const t = new Date(row.next_run_date).getTime();
        if (!Number.isNaN(t) && t > toTs) return false;
      }
      return true;
    });
  }, [serverRows, query, statusFilter, frequencyFilter, nextFrom, nextTo]);

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
    const headers = [
      'name',
      'vendor',
      'frequency',
      'frequency_count',
      'amount',
      'currency',
      'next_run',
      'until',
      'last_run',
      'status',
    ];
    const out: ExportRow[] = rows.map((r) => ({
      name: r.name,
      vendor: r.vendor ?? '',
      frequency: r.frequency,
      frequency_count: r.frequency_count,
      amount: r.amount,
      currency: r.currency,
      next_run: r.next_run_date ?? '',
      until: r.until_date ?? '',
      last_run: r.last_run_date ?? '',
      status: r.status,
    }));
    await downloadXlsx(
      `recurring-expenses-${dateStamp()}.xlsx`,
      headers,
      out,
      'Schedules',
    );
    toast({
      title: 'Exported',
      description: `${rows.length} schedules saved to XLSX.`,
    });
  }, [filtered, selected, toast]);

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
    a.download = `recurring-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${rows.length} schedules saved to CSV.`,
    });
  }, [filtered, selected, toast]);

  const bulkPause = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await pauseRecurringExpense(id);
        if (!res.error) ok += 1;
      }
      toast({ title: `${ok} schedule${ok === 1 ? '' : 's'} paused` });
      setSelected(new Set());
      router.refresh();
    });
  }, [selected, router, toast]);

  const bulkResume = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await resumeRecurringExpense(id);
        if (!res.error) ok += 1;
      }
      toast({ title: `${ok} schedule${ok === 1 ? '' : 's'} resumed` });
      setSelected(new Set());
      router.refresh();
    });
  }, [selected, router, toast]);

  const bulkDelete = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await deleteRecurringExpense(id);
        if (res.success) ok += 1;
      }
      toast({ title: `${ok} schedule${ok === 1 ? '' : 's'} deleted` });
      setSelected(new Set());
      setDeletePending(false);
      router.refresh();
    });
  }, [selected, router, toast]);

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    frequencyFilter !== 'all' ||
    Boolean(nextFrom) ||
    Boolean(nextTo);

  return (
    <div className="flex w-full flex-col gap-5">
      <RecurringExpensesKpiStrip kpi={kpi} currency={defaultCurrency} />

      <ZoruCard className="overflow-hidden p-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <ZoruInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or vendor…"
              className="h-9 pl-9 text-[13px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={exportXlsx}>
              <Download className="h-3.5 w-3.5" /> XLSX
            </ZoruButton>
            <ZoruButton size="sm" asChild>
              <Link href="/dashboard/crm/purchases/recurring-expenses/new">
                <Plus className="h-3.5 w-3.5" /> New schedule
              </Link>
            </ZoruButton>
          </div>
        </div>

        {/* Filters */}
        <details className="border-b border-zoru-line bg-zoru-surface-2/40" open>
          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Filters
          </summary>
          <div className="grid gap-3 px-3 pb-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <ZoruLabel>Status</ZoruLabel>
              <EnumFilterField
                enumName="recurringExpenseStatus"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                placeholder="All statuses"
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Frequency</ZoruLabel>
              <EnumFilterField
                enumName="recurringFrequency"
                value={frequencyFilter}
                onChange={(v) => setFrequencyFilter(v)}
                placeholder="All frequencies"
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Next run — from</ZoruLabel>
              <ZoruInput
                type="date"
                value={nextFrom}
                onChange={(e) => setNextFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel>Next run — to</ZoruLabel>
              <ZoruInput
                type="date"
                value={nextTo}
                onChange={(e) => setNextTo(e.target.value)}
              />
            </div>
          </div>
        </details>

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
                onClick={bulkPause}
                disabled={pending}
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="outline"
                onClick={bulkResume}
                disabled={pending}
              >
                <Play className="h-3.5 w-3.5" /> Resume
              </ZoruButton>
              <ZoruButton size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> CSV
              </ZoruButton>
              <ZoruButton size="sm" variant="outline" onClick={exportXlsx}>
                <Download className="h-3.5 w-3.5" /> XLSX
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="destructive"
                onClick={() => setDeletePending(true)}
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
          <table className="w-full text-[12.5px]">
            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
              <tr>
                <th className="p-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleAll}
                    aria-label="Select all visible schedules"
                  />
                </th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Vendor</th>
                <th className="p-2 text-left">Frequency</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-left">Next run</th>
                <th className="p-2 text-left">End date</th>
                <th className="p-2 text-left">Last run</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    {filtersActive
                      ? 'No schedules match the filters.'
                      : 'No recurring expenses yet — click "New schedule".'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row._id}
                    className="border-t border-zoru-line hover:bg-zoru-surface-2/60"
                  >
                    <td className="p-2 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(row._id)}
                        onChange={() => toggleRow(row._id)}
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    <td className="p-2 align-middle">
                      <EntityRowLink
                        href={`/dashboard/crm/purchases/recurring-expenses/${row._id}`}
                        label={row.name || '—'}
                        subtitle={row.vendor || undefined}
                      />
                    </td>
                    <td className="p-2 align-middle text-zoru-ink-muted">
                      {row.vendor || '—'}
                    </td>
                    <td className="p-2 align-middle text-zoru-ink-muted">
                      Every {row.frequency_count} {row.frequency}
                    </td>
                    <td className="p-2 text-right align-middle font-mono tabular-nums text-zoru-ink">
                      {fmtMoney(row.amount, row.currency)}
                    </td>
                    <td className="p-2 align-middle text-zoru-ink-muted">
                      {fmtDate(row.next_run_date)}
                    </td>
                    <td className="p-2 align-middle text-zoru-ink-muted">
                      {fmtDate(row.until_date)}
                    </td>
                    <td className="p-2 align-middle text-zoru-ink-muted">
                      {fmtDate(row.last_run_date)}
                    </td>
                    <td className="p-2 align-middle">
                      <StatusPill
                        label={row.status}
                        tone={statusToTone(row.status)}
                      />
                    </td>
                    <td className="p-2 text-right align-middle">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link
                          href={`/dashboard/crm/purchases/recurring-expenses/${row._id}`}
                        >
                          Open
                        </Link>
                      </ZoruButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-zoru-line p-3">
          <PaginationBar page={page} limit={limit} hasMore={hasMore} />
        </div>
      </ZoruCard>

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} schedule${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected schedules. Already-generated expenses are not affected."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => bulkDelete()}
      />

      {pending ? <span className="sr-only">Working…</span> : null}
    </div>
  );
}
