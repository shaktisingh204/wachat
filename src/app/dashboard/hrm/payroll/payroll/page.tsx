'use client';

/**
 * Payroll Runs — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (5 cards) — Drafts · Processing · Approved ·
 *       Disbursed · Total payout (sum across periods).
 *     • Filter row (status, period month, period year, department,
 *       employee).
 *     • Bulk action bar (approve · disburse · export CSV).
 *     • <PayrollRunsTable> — 10 columns (select · Period · Pay date ·
 *       Employees count · Gross total · Net total · Status · Approvals ·
 *       Disbursed at · Actions).
 *
 * Data source: canonical Rust BFF via `crm/payroll-runs.actions`. Per
 * §1D the create flow is the existing `<PayrollRunForm>` at /new — it
 * is a single-step form because the underlying Rust DTO does not yet
 * expose employee-inclusion controls or earnings/deductions preview at
 * create-time. Compute / approve / disburse happen post-creation via
 * row-level actions in this list and the form footer.
 */

import * as React from 'react';
import Link from 'next/link';
import { Plus, Wallet } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { ZoruButton, useZoruToast } from '@/components/zoruui';

import {
  approvePayrollRunAction,
  computePayrollRunAction,
  deletePayrollRunAction,
  disbursePayrollRunAction,
  listPayrollRuns,
} from '@/app/actions/crm/payroll-runs.actions';
import { getSession } from '@/app/actions/user.actions';
import type {
  CrmPayrollRunDoc,
  CrmPayrollRunStatus,
} from '@/lib/rust-client/crm-payroll-runs';

import {
  PayrollRunsKpiStrip,
  type PayrollRunsKpiKey,
  type PayrollRunsKpiSnapshot,
} from './_components/payroll-runs-kpi-strip';
import {
  PayrollRunsFiltersRow,
  type PayrollStatusFilter,
} from './_components/payroll-runs-filters';
import { PayrollRunsTable, periodLabel } from './_components/payroll-runs-table';
import { PayrollRunsBulkBar } from './_components/payroll-runs-bulk-bar';

const EMPTY_KPI: PayrollRunsKpiSnapshot = {
  drafts: 0,
  processing: 0,
  approved: 0,
  disbursed: 0,
  totalNetPayout: 0,
  currency: 'INR',
};

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: CrmPayrollRunDoc[]): string {
  const head = [
    'periodFrom',
    'periodTo',
    'payDate',
    'lockDate',
    'employeeCount',
    'gross',
    'net',
    'status',
    'bankFileFormat',
    'createdAt',
  ];
  const body = rows.map((r) =>
    [
      csvCell(r.periodFrom ?? ''),
      csvCell(r.periodTo ?? ''),
      csvCell(r.payDate ?? ''),
      csvCell(r.lockDate ?? ''),
      csvCell(r.totals?.employeeCount ?? r.employees?.length ?? 0),
      csvCell(r.totals?.gross ?? 0),
      csvCell(r.totals?.net ?? 0),
      csvCell(r.status ?? ''),
      csvCell(r.bankFileFormat ?? ''),
      csvCell(r.createdAt ?? ''),
    ].join(','),
  );
  return [head.join(','), ...body].join('\n');
}

export default function PayrollRunsPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  /* Data */
  const [runs, setRuns] = React.useState<CrmPayrollRunDoc[]>([]);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [actionBusy, startAction] = React.useTransition();

  /* Filters */
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] =
    React.useState<PayrollStatusFilter>('all');
  const [monthFilter, setMonthFilter] = React.useState<string>('all');
  const [yearFilter, setYearFilter] = React.useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<
    string | null
  >(null);
  const [employeeFilter, setEmployeeFilter] = React.useState<string | null>(
    null,
  );

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Confirm dialogs */
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [disburseOpen, setDisburseOpen] = React.useState(false);
  const [singleDeleteId, setSingleDeleteId] = React.useState<string | null>(
    null,
  );

  const fetchAll = React.useCallback(() => {
    startTransition(async () => {
      const [{ runs: rows, error: listErr }, session] = await Promise.all([
        listPayrollRuns({ page: 1, limit: 100 }),
        getSession(),
      ]);
      setRuns(rows);
      setError(listErr);
      setCurrentUserId(session?.user?._id ? String(session.user._id) : null);
    });
  }, []);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* Year options */
  const yearOptions = React.useMemo(() => {
    const years = new Set<number>();
    for (const r of runs) {
      if (!r.periodFrom) continue;
      const d = new Date(r.periodFrom);
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear());
    }
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [runs]);

  /* KPI snapshot */
  const kpi: PayrollRunsKpiSnapshot = React.useMemo(() => {
    if (runs.length === 0) return EMPTY_KPI;
    let drafts = 0;
    let processing = 0;
    let approved = 0;
    let disbursed = 0;
    let totalNet = 0;
    for (const r of runs) {
      const s = (r.status ?? 'draft') as CrmPayrollRunStatus;
      if (s === 'draft') drafts++;
      else if (s === 'processing') processing++;
      else if (s === 'approved') approved++;
      else if (s === 'disbursed' || s === 'closed') disbursed++;
      totalNet += r.totals?.net ?? 0;
    }
    return {
      drafts,
      processing,
      approved,
      disbursed,
      totalNetPayout: totalNet,
      currency: 'INR',
    };
  }, [runs]);

  /* Filtering — client-side for now since BFF only filters by status. */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return runs.filter((r) => {
      if (q) {
        const hay = `${periodLabel(r)} ${r.status ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && (r.status ?? 'draft') !== statusFilter)
        return false;
      if (r.periodFrom) {
        const d = new Date(r.periodFrom);
        if (
          monthFilter !== 'all' &&
          !Number.isNaN(d.getTime()) &&
          d.getMonth() + 1 !== Number(monthFilter)
        ) {
          return false;
        }
        if (
          yearFilter !== 'all' &&
          !Number.isNaN(d.getTime()) &&
          d.getFullYear() !== Number(yearFilter)
        ) {
          return false;
        }
      }
      if (employeeFilter) {
        const hit = r.employees?.some((e) => e.employeeId === employeeFilter);
        if (!hit) return false;
      }
      // departmentFilter is best-effort — the run doc doesn't carry the
      // employee→department mapping, so we surface it for future use.
      if (departmentFilter) {
        // no-op
      }
      return true;
    });
  }, [
    runs,
    search,
    statusFilter,
    monthFilter,
    yearFilter,
    employeeFilter,
    departmentFilter,
  ]);

  /* KPI clicks */
  const onKpiSelect = React.useCallback((key: PayrollRunsKpiKey) => {
    if (key === 'drafts') setStatusFilter('draft');
    else if (key === 'processing') setStatusFilter('processing');
    else if (key === 'approved') setStatusFilter('approved');
    else if (key === 'disbursed') setStatusFilter('disbursed');
    else setStatusFilter('all');
  }, []);

  /* Clear */
  const clearFilters = React.useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setMonthFilter('all');
    setYearFilter('all');
    setDepartmentFilter(null);
    setEmployeeFilter(null);
  }, []);

  const hasActiveFilters =
    !!search ||
    statusFilter !== 'all' ||
    monthFilter !== 'all' ||
    yearFilter !== 'all' ||
    !!departmentFilter ||
    !!employeeFilter;

  /* Selection */
  const toggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleAll = React.useCallback(
    (all: boolean) => {
      setSelected(all ? new Set(filtered.map((r) => r._id)) : new Set());
    },
    [filtered],
  );

  /* Row-level lifecycle handlers */
  const runCompute = React.useCallback(
    (id: string) => {
      startAction(async () => {
        const res = await computePayrollRunAction(id);
        if (res.success) {
          toast({ title: 'Computed', description: res.message });
          fetchAll();
        } else {
          toast({
            title: 'Compute failed',
            description: res.error,
            variant: 'destructive',
          });
        }
      });
    },
    [toast, fetchAll],
  );

  const runApprove = React.useCallback(
    (id: string) => {
      if (!currentUserId) {
        toast({
          title: 'Sign-in required',
          description: 'Could not resolve your user id.',
          variant: 'destructive',
        });
        return;
      }
      startAction(async () => {
        const res = await approvePayrollRunAction(id, {
          approverId: currentUserId,
        });
        if (res.success) {
          toast({ title: 'Approved', description: res.message });
          fetchAll();
        } else {
          toast({
            title: 'Approve failed',
            description: res.error,
            variant: 'destructive',
          });
        }
      });
    },
    [currentUserId, toast, fetchAll],
  );

  const runDisburse = React.useCallback(
    (id: string) => {
      startAction(async () => {
        const res = await disbursePayrollRunAction(id);
        if (res.success) {
          toast({ title: 'Disbursed', description: res.message });
          fetchAll();
        } else {
          toast({
            title: 'Disburse failed',
            description: res.error,
            variant: 'destructive',
          });
        }
      });
    },
    [toast, fetchAll],
  );

  const runSingleDelete = React.useCallback(
    async (id: string) => {
      const res = await deletePayrollRunAction(id);
      if (res.success) {
        toast({ title: 'Deleted' });
        fetchAll();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [toast, fetchAll],
  );

  /* Bulk handlers */
  const runBulkApprove = React.useCallback(async () => {
    if (!currentUserId) {
      toast({
        title: 'Sign-in required',
        description: 'Could not resolve your user id for approval.',
        variant: 'destructive',
      });
      return;
    }
    const ids = Array.from(selected);
    let processed = 0;
    for (const id of ids) {
      const res = await approvePayrollRunAction(id, {
        approverId: currentUserId,
      });
      if (res.success) processed++;
    }
    toast({
      title: 'Bulk approve completed',
      description: `${processed} of ${ids.length} runs approved.`,
    });
    setSelected(new Set());
    fetchAll();
  }, [selected, currentUserId, toast, fetchAll]);

  const runBulkDisburse = React.useCallback(async () => {
    const ids = Array.from(selected);
    let processed = 0;
    for (const id of ids) {
      const res = await disbursePayrollRunAction(id);
      if (res.success) processed++;
    }
    toast({
      title: 'Bulk disburse completed',
      description: `${processed} of ${ids.length} runs disbursed.`,
    });
    setSelected(new Set());
    fetchAll();
  }, [selected, toast, fetchAll]);

  /* Export */
  const exportCsv = React.useCallback(() => {
    const out =
      selected.size > 0
        ? filtered.filter((r) => selected.has(r._id))
        : filtered;
    if (out.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'No rows match the current filters / selection.',
      });
      return;
    }
    const blob = new Blob([toCsv(out)], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-runs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${out.length} runs saved to CSV.`,
    });
  }, [filtered, selected, toast]);

  return (
    <>
      <EntityListShell
        title="Payroll runs"
        subtitle="Define, compute, approve and disburse monthly payroll periods."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by period or status…',
        }}
        primaryAction={
          <ZoruButton size="sm" asChild>
            <Link href="/dashboard/hrm/payroll/payroll/new">
              <Plus className="h-3.5 w-3.5" /> New payroll run
            </Link>
          </ZoruButton>
        }
        filters={
          <PayrollRunsFiltersRow
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            monthFilter={monthFilter}
            onMonthChange={setMonthFilter}
            yearFilter={yearFilter}
            onYearChange={setYearFilter}
            yearOptions={yearOptions}
            departmentFilter={departmentFilter}
            onDepartmentChange={setDepartmentFilter}
            employeeFilter={employeeFilter}
            onEmployeeChange={setEmployeeFilter}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            onRefresh={fetchAll}
            refreshing={isPending}
          />
        }
        bulkBar={
          selected.size > 0 ? (
            <PayrollRunsBulkBar
              count={selected.size}
              onClear={() => setSelected(new Set())}
              onApprove={() => setApproveOpen(true)}
              onDisburse={() => setDisburseOpen(true)}
              onExport={exportCsv}
            />
          ) : null
        }
        loading={isPending && runs.length === 0}
        empty={
          !isPending && runs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Wallet className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">
                No payroll runs yet
              </h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Start by creating a payroll run for the current pay
                period. You can compute, approve, and disburse it once
                the draft is saved.
              </p>
              <ZoruButton asChild>
                <Link href="/dashboard/hrm/payroll/payroll/new">
                  <Plus className="h-4 w-4" /> New payroll run
                </Link>
              </ZoruButton>
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          <PayrollRunsKpiStrip kpi={kpi} active={null} onSelect={onKpiSelect} />

          {error ? (
            <div className="rounded-[var(--zoru-radius)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
              {error}
            </div>
          ) : null}

          <PayrollRunsTable
            rows={filtered}
            selected={selected}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
            onCompute={runCompute}
            onApprove={runApprove}
            onDisburse={runDisburse}
            onDelete={setSingleDeleteId}
            actionBusy={actionBusy}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={`Approve ${selected.size} payroll run${selected.size === 1 ? '' : 's'}?`}
        description="Appends an approval step to each selected run. Only `processing` runs flip status."
        confirmLabel="Approve"
        confirmTone="primary"
        onConfirm={async () => {
          await runBulkApprove();
          setApproveOpen(false);
        }}
      />

      <ConfirmDialog
        open={disburseOpen}
        onOpenChange={setDisburseOpen}
        title={`Disburse ${selected.size} payroll run${selected.size === 1 ? '' : 's'}?`}
        description="Stub-generates the bank file and flips status → disbursed. Legal only for `approved` runs."
        confirmLabel="Disburse"
        confirmTone="primary"
        onConfirm={async () => {
          await runBulkDisburse();
          setDisburseOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!singleDeleteId}
        onOpenChange={(o) => !o && setSingleDeleteId(null)}
        title="Delete this payroll run?"
        description="This permanently removes the run from the collection. Disbursed runs cannot be deleted."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => {
          if (singleDeleteId) await runSingleDelete(singleDeleteId);
          setSingleDeleteId(null);
        }}
      />
    </>
  );
}
