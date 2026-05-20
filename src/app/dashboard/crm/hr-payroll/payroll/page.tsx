'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCheckbox,
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
  useZoruToast,
} from '@/components/zoruui';
import {
  BadgeIndianRupee,
  Download,
  Edit,
  ListChecks,
  LoaderCircle,
  Plus,
  Receipt,
  ReceiptText,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';

/**
 * Payroll Runs — list page.
 *
 * Adds KPI strip (total runs, processed this month, gross this month, net
 * this month), bulk delete of draft runs with confirm, and CSV export.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  deletePayrollRun,
  listPayrollRuns,
} from '@/app/actions/crm-payroll-runs.actions';
import type {
  CrmPayrollRunDoc,
  CrmPayrollRunStatus,
} from '@/app/actions/crm-payroll-runs.actions';

const BASE = '/dashboard/crm/hr-payroll/payroll';

const STATUS_OPTIONS: ReadonlyArray<{
  value: CrmPayrollRunStatus | 'all';
  label: string;
}> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'processed', label: 'Processed' },
  { value: 'paid', label: 'Paid' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmPayrollRunStatus, StatusTone> = {
  draft: 'amber',
  in_progress: 'blue',
  processed: 'green',
  paid: 'green',
  archived: 'neutral',
};

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function periodLabel(r: CrmPayrollRunDoc): string {
  const m = MONTH_LABELS[(r.period_month ?? 1) - 1] ?? '—';
  return `${m} ${r.period_year ?? ''}`.trim();
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ');
}

interface PayrollKpi {
  total: number;
  processedThisMonth: number;
  grossThisMonth: number;
  netThisMonth: number;
}

function computeKpi(runs: CrmPayrollRunDoc[]): PayrollKpi {
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const thisMonth = runs.filter(
    (r) => r.period_month === curMonth && r.period_year === curYear,
  );
  const processedThisMonth = thisMonth.filter(
    (r) => r.status === 'processed' || r.status === 'paid',
  ).length;
  const grossThisMonth = thisMonth.reduce(
    (s, r) => s + (r.total_gross ?? 0),
    0,
  );
  const netThisMonth = thisMonth.reduce(
    (s, r) => s + (r.total_net ?? 0),
    0,
  );
  return { total: runs.length, processedThisMonth, grossThisMonth, netThisMonth };
}

interface KpiPillProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function KpiPill({ icon, label, value }: KpiPillProps) {
  return (
    <ZoruCard>
      <ZoruCardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink-muted">
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            {label}
          </p>
          <p className="text-[18px] font-semibold leading-tight text-zoru-ink">
            {value}
          </p>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

export default function PayrollRunsListPage() {
  const [rows, setRows] = React.useState<CrmPayrollRunDoc[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmPayrollRunStatus | 'all'>(
    'all',
  );
  const [yearFilter, setYearFilter] = React.useState<string>('all');
  const [pendingDelete, setPendingDelete] =
    React.useState<CrmPayrollRunDoc | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();

  // Bulk state
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);
  const [bulkDeleting, startBulkDelete] = React.useTransition();

  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listPayrollRuns({
        status: statusFilter === 'all' ? undefined : statusFilter,
        year: yearFilter === 'all' ? undefined : Number(yearFilter),
        limit: 200,
      });
      setRows(res);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, yearFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  // Clear selection when rows reload
  React.useEffect(() => {
    setSelected(new Set());
  }, [rows]);

  const yearOptions = React.useMemo(() => {
    const ys = new Set<number>();
    for (const r of rows) if (r.period_year) ys.add(r.period_year);
    if (ys.size === 0) ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        periodLabel(r).toLowerCase().includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const kpi = React.useMemo(() => computeKpi(rows), [rows]);

  /* ── Selection ── */
  // Only draft runs can be bulk-deleted
  const draftFiltered = filtered.filter((r) => r.status === 'draft');
  const headChecked =
    draftFiltered.length > 0 &&
    draftFiltered.every((r) => selected.has(r._id));

  const toggleAll = (all: boolean) =>
    setSelected(
      all ? new Set(draftFiltered.map((r) => r._id)) : new Set(),
    );

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ── Single delete ── */
  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startDeleteTransition(async () => {
      const result = await deletePayrollRun(id);
      if (result.success) {
        toast({ title: 'Payroll run deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Could not delete run.',
          variant: 'destructive',
        });
      }
    });
  };

  /* ── Bulk delete (draft only) ── */
  const runBulkDelete = () => {
    if (selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    startBulkDelete(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await deletePayrollRun(id);
        if (res.success) ok += 1;
        else failed += 1;
      }
      toast({
        title:
          failed === 0
            ? `${ok} run${ok === 1 ? '' : 's'} deleted`
            : `${ok} deleted · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      setSelected(new Set());
      await refresh();
    });
  };

  /* ── Export CSV ── */
  const handleExportCsv = () => {
    const headers = [
      'Period',
      'Run date',
      'Employees',
      'Gross',
      'Deductions',
      'Net',
      'Status',
    ];
    const exportRows = filtered.map((r) => ({
      Period: periodLabel(r),
      'Run date': fmtDate(r.run_date),
      Employees: r.total_employees ?? 0,
      Gross: r.total_gross ?? 0,
      Deductions: r.total_deductions ?? 0,
      Net: r.total_net ?? 0,
      Status: statusLabel(r.status ?? 'draft'),
    }));
    downloadCsv(`payroll-runs-${dateStamp()}.csv`, headers, exportRows);
  };

  return (
    <>
      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill
          icon={<Receipt className="h-4 w-4" />}
          label="Total runs"
          value={kpi.total}
        />
        <KpiPill
          icon={<TrendingUp className="h-4 w-4" />}
          label="Processed this month"
          value={kpi.processedThisMonth}
        />
        <KpiPill
          icon={<ReceiptText className="h-4 w-4" />}
          label="Gross this month"
          value={inr.format(kpi.grossThisMonth)}
        />
        <KpiPill
          icon={<BadgeIndianRupee className="h-4 w-4" />}
          label="Net this month"
          value={inr.format(kpi.netThisMonth)}
        />
      </div>

      <EntityListShell
        title="Payroll runs"
        subtitle="One run per pay period — generate, finalize, and archive."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New payroll run
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by period…',
        }}
        filters={
          <>
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as CrmPayrollRunStatus | 'all')
              }
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={yearFilter} onValueChange={setYearFilter}>
              <ZoruSelectTrigger className="h-9 w-[140px]">
                <ZoruSelectValue placeholder="Year" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All years</ZoruSelectItem>
                {yearOptions.map((y) => (
                  <ZoruSelectItem key={y} value={String(y)}>
                    {y}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <ListChecks className="h-4 w-4 text-zoru-primary" />
                {selected.size} draft run{selected.size === 1 ? '' : 's'} selected
              </div>
              <div className="flex items-center gap-1">
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkConfirmOpen(true)}
                  disabled={bulkDeleting}
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
          ) : null
        }
        loading={isLoading && rows.length === 0}
      >
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-8">
                  <ZoruCheckbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all draft runs"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Run date</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Employees</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Gross</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Deductions</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Net</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={9} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : filtered.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={9} className="h-24 text-center text-zoru-ink-muted">
                    No payroll runs match this filter.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((r) => {
                  const status = (r.status ?? 'draft') as CrmPayrollRunStatus;
                  const tone = STATUS_TONE[status] ?? 'neutral';
                  const isDraft = status === 'draft';
                  const checked = selected.has(r._id);
                  return (
                    <ZoruTableRow key={r._id} className="border-zoru-line">
                      <ZoruTableCell>
                        {isDraft ? (
                          <ZoruCheckbox
                            checked={checked}
                            onCheckedChange={() => toggleOne(r._id)}
                            aria-label={`Select ${periodLabel(r)}`}
                          />
                        ) : (
                          <span className="inline-block h-4 w-4" />
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink
                          href={`${BASE}/${r._id}`}
                          label={periodLabel(r)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {fmtDate(r.run_date)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right font-mono text-zoru-ink">
                        {r.total_employees ?? 0}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right font-mono text-zoru-ink">
                        {inr.format(r.total_gross ?? 0)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right font-mono text-zoru-ink">
                        {inr.format(r.total_deductions ?? 0)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right font-mono text-zoru-ink">
                        {inr.format(r.total_net ?? 0)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill label={statusLabel(status)} tone={tone} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton variant="ghost" size="icon" asChild>
                          <Link href={`${BASE}/${r._id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete(r)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </ZoruButton>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </EntityListShell>

      {/* Single delete confirm */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete payroll run?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Deleting the {pendingDelete ? periodLabel(pendingDelete) : ''} run
              removes its metadata. Generated payslips remain in the payslips
              collection.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk delete confirm */}
      <ZoruAlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} draft run{selected.size === 1 ? '' : 's'}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Only draft runs can be bulk-deleted. Their metadata will be removed;
              any generated payslips remain.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={runBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Deleting…' : 'Delete all'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
