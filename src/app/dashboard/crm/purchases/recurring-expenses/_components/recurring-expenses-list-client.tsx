'use client';

import {
  Button,
  Card,
  Input,
  Label,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';
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
  stopRecurringExpense,
} from '@/app/actions/worksuite/billing.actions';
import {
  dateStamp,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';

import { RecurringExpensesKpiStrip } from './kpi-strip';
import type { RecurringExpenseKpiSnapshot, RecurringExpenseRow } from './types';

interface ListClientProps {
  rows: RecurringExpenseRow[];
  kpi: RecurringExpenseKpiSnapshot;
  defaultCurrency: string;
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

  const [deletePending, setDeletePending] = React.useState(false);

  const bulky = useCrmBulkyState<RecurringExpenseRow>({
    initialData: serverRows,
  });

  React.useEffect(() => {
    bulky.setData(serverRows);
  }, [serverRows]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = nextFrom ? new Date(nextFrom).getTime() : null;
    const toTs = nextTo ? new Date(nextTo).getTime() : null;
    return bulky.data.filter((row) => {
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
  }, [bulky.data, query, statusFilter, frequencyFilter, nextFrom, nextTo]);

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<RecurringExpenseRow>) => {
    if (!updatedFields.status) return;
    try {
      let res;
      if (updatedFields.status === 'paused') {
        res = await pauseRecurringExpense(id);
      } else if (updatedFields.status === 'active') {
        res = await resumeRecurringExpense(id);
      } else if (updatedFields.status === 'stopped') {
        res = await stopRecurringExpense(id);
      } else {
        return;
      }

      if (res && !res.error) {
        toast({
          title: 'Saved inline',
          description: `Schedule status updated to ${updatedFields.status}.`,
        });
        bulky.cancelInlineEdit();
        router.refresh();
      } else {
        toast({
          title: 'Update failed',
          description: res?.error || 'Unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const columns = React.useMemo<ColumnDef<RecurringExpenseRow>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/purchases/recurring-expenses/${row._id}`}
          label={row.name || '—'}
          subtitle={row.vendor || undefined}
        />
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      sortable: true,
      render: (row) => (
        <span className="text-zoru-ink-muted">{row.vendor || '—'}</span>
      ),
    },
    {
      key: 'frequency',
      header: 'Frequency',
      sortable: true,
      render: (row) => (
        <span className="text-zoru-ink-muted">
          Every {row.frequency_count} {row.frequency}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-zoru-ink text-right block w-full">
          {fmtMoney(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'next_run_date',
      header: 'Next run',
      sortable: true,
      render: (row) => (
        <span className="text-zoru-ink-muted">{fmtDate(row.next_run_date)}</span>
      ),
    },
    {
      key: 'until_date',
      header: 'End date',
      sortable: true,
      render: (row) => (
        <span className="text-zoru-ink-muted">{fmtDate(row.until_date)}</span>
      ),
    },
    {
      key: 'last_run_date',
      header: 'Last run',
      sortable: true,
      render: (row) => (
        <span className="text-zoru-ink-muted">{fmtDate(row.last_run_date)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <StatusPill
          label={row.status}
          tone={statusToTone(row.status)}
        />
      ),
      editRender: (row, value, onChange) => (
        <select
          className="bg-zoru-surface-2 border border-zoru-line rounded px-1.5 py-0.5 text-xs text-zoru-ink focus:outline-none"
          value={value || 'active'}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="stopped">Stopped</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/dashboard/crm/purchases/recurring-expenses/${row._id}`}>
            Open
          </Link>
        </Button>
      ),
    },
  ], []);

  const exportXlsx = React.useCallback(async () => {
    const rows = filtered.filter(
      (d) => bulky.selected.size === 0 || bulky.selected.has(d._id),
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
  }, [filtered, bulky.selected, toast]);

  const exportCsv = React.useCallback(() => {
    const rows = filtered.filter(
      (d) => bulky.selected.size === 0 || bulky.selected.has(d._id),
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
  }, [filtered, bulky.selected, toast]);

  const bulkPause = React.useCallback(() => {
    const ids = Array.from(bulky.selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await pauseRecurringExpense(id);
        if (!res.error) ok += 1;
      }
      toast({ title: `${ok} schedule${ok === 1 ? '' : 's'} paused` });
      bulky.clearSelection();
      router.refresh();
    });
  }, [bulky, router, toast]);

  const bulkResume = React.useCallback(() => {
    const ids = Array.from(bulky.selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await resumeRecurringExpense(id);
        if (!res.error) ok += 1;
      }
      toast({ title: `${ok} schedule${ok === 1 ? '' : 's'} resumed` });
      bulky.clearSelection();
      router.refresh();
    });
  }, [bulky, router, toast]);

  const bulkDelete = React.useCallback(() => {
    const ids = Array.from(bulky.selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await deleteRecurringExpense(id);
        if (res.success) ok += 1;
      }
      toast({ title: `${ok} schedule${ok === 1 ? '' : 's'} deleted` });
      bulky.clearSelection();
      setDeletePending(false);
      router.refresh();
    });
  }, [bulky, router, toast]);

  return (
    <div className="flex w-full flex-col gap-5">
      <RecurringExpensesKpiStrip kpi={kpi} currency={defaultCurrency} />

      <Card className="overflow-hidden p-0 border border-zoru-line">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or vendor…"
              className="h-9 pl-9 text-[13px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportXlsx}>
              <Download className="h-3.5 w-3.5" /> XLSX
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/crm/purchases/recurring-expenses/new">
                <Plus className="h-3.5 w-3.5" /> New schedule
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <details className="border-b border-zoru-line bg-zoru-surface-2/40" open>
          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Filters
          </summary>
          <div className="grid gap-3 px-3 pb-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label>Status</Label>
              <EnumFilterField
                enumName="recurringExpenseStatus"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                placeholder="All statuses"
              />
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <EnumFilterField
                enumName="recurringFrequency"
                value={frequencyFilter}
                onChange={(v) => setFrequencyFilter(v)}
                placeholder="All frequencies"
              />
            </div>
            <div className="space-y-1">
              <Label>Next run — from</Label>
              <Input
                type="date"
                value={nextFrom}
                onChange={(e) => setNextFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Next run — to</Label>
              <Input
                type="date"
                value={nextTo}
                onChange={(e) => setNextTo(e.target.value)}
              />
            </div>
          </div>
        </details>

        {/* Bulk bar */}
        {bulky.selected.size > 0 ? (
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
              <ListChecks className="h-4 w-4 text-zoru-primary" />
              {bulky.selected.size} selected
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={bulkPause}
                disabled={pending}
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={bulkResume}
                disabled={pending}
              >
                <Play className="h-3.5 w-3.5" /> Resume
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
                onClick={() => setDeletePending(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={bulky.clearSelection}
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* Bulky Grid Table */}
        <CrmBulkyGrid<RecurringExpenseRow>
          columns={columns}
          data={filtered}
          selectedIds={bulky.selected}
          onSelectOne={bulky.toggleSelectOne}
          onSelectAll={(checked) =>
            bulky.toggleSelectAll(
              filtered.map((d) => d._id),
              checked
            )
          }
          density="comfortable"
          inlineEditRowId={bulky.inlineEditRowId}
          editBuffer={bulky.editBuffer}
          onStartInlineEdit={bulky.startInlineEdit}
          onCancelInlineEdit={bulky.cancelInlineEdit}
          onSaveInlineEdit={handleSaveInlineEdit}
          onUpdateEditBuffer={bulky.updateEditBuffer}
          isLoading={pending}
        />

        <div className="border-t border-zoru-line p-3">
          <PaginationBar page={page} limit={limit} hasMore={hasMore} />
        </div>
      </Card>

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${bulky.selected.size} schedule${
          bulky.selected.size === 1 ? '' : 's'
        }?`}
        description="This permanently removes the selected schedules. Already-generated expenses are not affected."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => bulkDelete()}
      />

      {pending ? <span className="sr-only">Working…</span> : null}
    </div>
  );
}
