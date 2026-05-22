'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  CalendarPlus,
  Plus } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * Leave Management — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (5 cards) — Pending · Approved · Rejected ·
 *       Available balance (current user) · Used this month.
 *     • Saved-view presets (All · My leaves · Team's pending · This month).
 *     • Filter row (status, leave-type, employee, department, approver, date range).
 *     • View switcher (Table / Calendar).
 *     • Bulk action bar (approve · reject · export CSV).
 *     • <LeaveTable> / <LeaveCalendarView>.
 *
 * Data source: legacy WorkSuite `WsLeave` collection. The canonical
 * `crm/leaves.actions` does not yet expose approve/reject workflow
 * endpoints, so we keep the live path on the WorkSuite actions where
 * those transitions already work. Detail/edit routes still navigate to
 * the existing pages.
 */

import * as React from 'react';
import Link from 'next/link';

import {
  approveLeave,
  getLeaveBalance,
  getLeaves,
  getLeaveTypes,
  rejectLeave,
} from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { getSession } from '@/app/actions/user.actions';
import type { WsLeave, WsLeaveType } from '@/lib/worksuite/leave-types';

import { LeaveBulkBar } from './_components/leave-bulk-bar';
import { LeaveCalendarView } from './_components/leave-calendar';
import { LeaveFiltersRow } from './_components/leave-filters';
import { LeaveHeaderActions } from './_components/leave-header-actions';
import { LeaveKpiStrip } from './_components/leave-kpi-strip';
import { LeaveTable } from './_components/leave-table';
import { LeaveViewSwitcher } from './_components/leave-view-switcher';
import {
  isInMonth,
  leaveRowsToCsv,
  toLeaveRow,
  type EmployeeLite,
} from './_components/leave-utils';
import type {
  LeaveKpiKey,
  LeaveKpiSnapshot,
  LeaveListRow,
  LeavePreset,
  LeaveStatusFilter,
  LeaveTypeOption,
  LeaveViewMode,
} from './_components/types';

const EMPTY_KPI: LeaveKpiSnapshot = {
  pending: 0,
  approved: 0,
  rejected: 0,
  availableBalance: null,
  usedThisMonth: 0,
};

export default function LeaveListPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  /* Data */
  const [rawLeaves, setRawLeaves] = React.useState<WsLeave[]>([]);
  const [types, setTypes] = React.useState<WsLeaveType[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [availableBalance, setAvailableBalance] = React.useState<
    number | null
  >(null);
  const [isPending, startTransition] = React.useTransition();

  /* Filters */
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] =
    React.useState<LeaveStatusFilter>('all');
  const [preset, setPreset] = React.useState<LeavePreset>('all');
  const [employeeFilter, setEmployeeFilter] = React.useState<string | null>(
    null,
  );
  const [leaveTypeFilter, setLeaveTypeFilter] = React.useState<string | null>(
    null,
  );
  const [departmentFilter, setDepartmentFilter] = React.useState<
    string | null
  >(null);
  const [approverFilter, setApproverFilter] = React.useState<string | null>(
    null,
  );
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  /* View + selection */
  const [view, setView] = React.useState<LeaveViewMode>('table');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Confirm dialogs */
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);

  const fetchAll = React.useCallback(() => {
    startTransition(async () => {
      const [leaves, leaveTypes, emps, session] = await Promise.all([
        getLeaves(),
        getLeaveTypes(),
        getCrmEmployees(),
        getSession(),
      ]);
      setRawLeaves(leaves);
      setTypes(leaveTypes);
      const empList: EmployeeLite[] = (
        emps as Array<Record<string, unknown>>
      ).map((e) => ({
        _id: String(e._id),
        firstName: e.firstName as string | undefined,
        lastName: e.lastName as string | undefined,
        departmentId:
          (e.departmentId as string | undefined) ??
          (e.department as string | undefined) ??
          null,
      }));
      setEmployees(empList);
      const sessionUserId = session?.user?._id
        ? String(session.user._id)
        : null;
      setCurrentUserId(sessionUserId);

      // Compute available balance for the current user by matching them
      // against the CRM employees roster.
      try {
        const myEmp = sessionUserId
          ? empList.find((e) => String(e._id) === sessionUserId)
          : null;
        if (myEmp) {
          const balanceRows = await getLeaveBalance(myEmp._id);
          const total = balanceRows.reduce(
            (sum, row) =>
              sum +
              row.rows.reduce((s, r) => s + (Number(r.remaining) || 0), 0),
            0,
          );
          setAvailableBalance(total);
        } else {
          setAvailableBalance(null);
        }
      } catch {
        setAvailableBalance(null);
      }
    });
  }, []);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* Maps */
  const typeMap = React.useMemo(() => {
    const m = new Map<string, WsLeaveType>();
    for (const t of types) m.set(String(t._id), t);
    return m;
  }, [types]);
  const empMap = React.useMemo(() => {
    const m = new Map<string, EmployeeLite>();
    for (const e of employees) m.set(e._id, e);
    return m;
  }, [employees]);
  const leaveTypeOptions: LeaveTypeOption[] = React.useMemo(
    () =>
      types.map((t) => ({
        _id: String(t._id),
        name: t.type_name,
        color: t.color,
        code: null,
      })),
    [types],
  );

  /* Rows */
  const rows: LeaveListRow[] = React.useMemo(
    () => rawLeaves.map((l) => toLeaveRow(l, typeMap, empMap)),
    [rawLeaves, typeMap, empMap],
  );

  /* KPI snapshot */
  const kpi: LeaveKpiSnapshot = React.useMemo(() => {
    if (rows.length === 0)
      return {
        ...EMPTY_KPI,
        availableBalance,
      };
    const today = new Date();
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let usedThisMonth = 0;
    for (const r of rows) {
      if (r.status === 'pending') pending++;
      else if (r.status === 'approved') approved++;
      else if (r.status === 'rejected' || r.status === 'cancelled') rejected++;
      if (r.status === 'approved' && isInMonth(r.from, today)) {
        usedThisMonth += r.days || 0;
      }
    }
    return {
      pending,
      approved,
      rejected,
      availableBalance,
      usedThisMonth,
    };
  }, [rows, availableBalance]);

  /* Filtering */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() : null;
    return rows.filter((row) => {
      if (q) {
        const hay =
          `${row.employeeName} ${row.leaveTypeName ?? ''} ${row.reason ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (employeeFilter && row.employeeId !== employeeFilter) return false;
      if (leaveTypeFilter && row.leaveTypeId !== leaveTypeFilter) return false;
      if (departmentFilter && row.departmentId !== departmentFilter)
        return false;
      if (approverFilter && row.approverId !== approverFilter) return false;
      if (fromTs && row.from) {
        const t = new Date(row.from).getTime();
        if (!Number.isNaN(t) && t < fromTs) return false;
      }
      if (toTs && row.to) {
        const t = new Date(row.to).getTime();
        if (!Number.isNaN(t) && t > toTs) return false;
      }
      return true;
    });
  }, [
    rows,
    search,
    statusFilter,
    employeeFilter,
    leaveTypeFilter,
    departmentFilter,
    approverFilter,
    fromDate,
    toDate,
  ]);

  /* KPI clicks */
  const onKpiSelect = React.useCallback((key: LeaveKpiKey) => {
    if (key === 'pending') {
      setStatusFilter('pending');
      setPreset('all');
    } else if (key === 'approved') {
      setStatusFilter('approved');
      setPreset('all');
    } else if (key === 'rejected') {
      setStatusFilter('rejected');
      setPreset('all');
    } else if (key === 'balance') {
      setPreset('my-leaves');
    } else if (key === 'used') {
      setStatusFilter('approved');
      setPreset('this-month');
    }
  }, []);

  /* Presets */
  const applyPreset = React.useCallback(
    (next: LeavePreset) => {
      setPreset(next);
      if (next === 'all') {
        setStatusFilter('all');
        setEmployeeFilter(null);
        setFromDate('');
        setToDate('');
        return;
      }
      if (next === 'my-leaves') {
        const myEmp = currentUserId
          ? employees.find((e) => e._id === currentUserId)
          : null;
        setEmployeeFilter(myEmp?._id ?? currentUserId);
        return;
      }
      if (next === 'team-pending') {
        setStatusFilter('pending');
        return;
      }
      if (next === 'this-month') {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setFromDate(first.toISOString().slice(0, 10));
        setToDate(last.toISOString().slice(0, 10));
        return;
      }
    },
    [currentUserId, employees],
  );

  /* Clear filters */
  const clearFilters = React.useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setEmployeeFilter(null);
    setLeaveTypeFilter(null);
    setDepartmentFilter(null);
    setApproverFilter(null);
    setFromDate('');
    setToDate('');
    setPreset('all');
  }, []);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    !!employeeFilter ||
    !!leaveTypeFilter ||
    !!departmentFilter ||
    !!approverFilter ||
    !!fromDate ||
    !!toDate ||
    preset !== 'all' ||
    !!search;

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

  /* Bulk handlers */
  const runBulkApprove = React.useCallback(async () => {
    const ids = Array.from(selected);
    let processed = 0;
    for (const id of ids) {
      const res = await approveLeave(id);
      if (res.success) processed++;
    }
    toast({
      title: 'Approve completed',
      description: `${processed} of ${ids.length} requests approved.`,
    });
    setSelected(new Set());
    fetchAll();
  }, [selected, toast, fetchAll]);

  const runBulkReject = React.useCallback(async () => {
    const ids = Array.from(selected);
    let processed = 0;
    for (const id of ids) {
      const res = await rejectLeave(id, 'Bulk rejected');
      if (res.success) processed++;
    }
    toast({
      title: 'Reject completed',
      description: `${processed} of ${ids.length} requests rejected.`,
      variant: 'destructive',
    });
    setSelected(new Set());
    fetchAll();
  }, [selected, toast, fetchAll]);

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
    const blob = new Blob([leaveRowsToCsv(out)], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaves-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${out.length} requests saved to CSV.`,
    });
  }, [filtered, selected, toast]);

  return (
    <>
      <EntityListShell
        title="Leave"
        subtitle="Approve requests, plan balances, and configure policies."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by employee, type, reason…',
        }}
        viewSwitcher={
          <LeaveViewSwitcher view={view} onChange={setView} />
        }
        primaryAction={<LeaveHeaderActions />}
        filters={
          <LeaveFiltersRow
            statusFilter={statusFilter}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setPreset('all');
            }}
            preset={preset}
            onPresetChange={applyPreset}
            employeeFilter={employeeFilter}
            onEmployeeChange={(v) => {
              setEmployeeFilter(v);
              setPreset('all');
            }}
            leaveTypeFilter={leaveTypeFilter}
            onLeaveTypeChange={(v) => {
              setLeaveTypeFilter(v);
              setPreset('all');
            }}
            departmentFilter={departmentFilter}
            onDepartmentChange={(v) => {
              setDepartmentFilter(v);
              setPreset('all');
            }}
            approverFilter={approverFilter}
            onApproverChange={(v) => {
              setApproverFilter(v);
              setPreset('all');
            }}
            fromDate={fromDate}
            onFromDate={(v) => {
              setFromDate(v);
              setPreset('all');
            }}
            toDate={toDate}
            onToDate={(v) => {
              setToDate(v);
              setPreset('all');
            }}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            leaveTypes={leaveTypeOptions}
          />
        }
        bulkBar={
          selected.size > 0 ? (
            <LeaveBulkBar
              count={selected.size}
              onClear={() => setSelected(new Set())}
              onApprove={() => setApproveOpen(true)}
              onReject={() => setRejectOpen(true)}
              onExport={exportCsv}
            />
          ) : null
        }
        loading={isPending && rows.length === 0}
        empty={
          !isPending && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <CalendarPlus className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">
                No leave requests yet
              </h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Apply for leave or wait for your team to submit requests.
              </p>
              <Button asChild>
                <Link href="/dashboard/hrm/payroll/leave/new">
                  <Plus className="h-4 w-4" /> Apply leave
                </Link>
              </Button>
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          <LeaveKpiStrip kpi={kpi} active={null} onSelect={onKpiSelect} />

          {view === 'calendar' ? (
            <LeaveCalendarView rows={filtered} />
          ) : (
            <LeaveTable
              rows={filtered}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAll={toggleAll}
              filtersActive={hasActiveFilters}
            />
          )}
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={`Approve ${selected.size} request${selected.size === 1 ? '' : 's'}?`}
        description="Approves the selected pending leave requests. Already-approved rows are skipped."
        confirmLabel="Approve"
        confirmTone="primary"
        onConfirm={async () => {
          await runBulkApprove();
          setApproveOpen(false);
        }}
      />

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject ${selected.size} request${selected.size === 1 ? '' : 's'}?`}
        description="Rejects the selected pending leave requests with a bulk reason. You can update individual reasons from the detail page."
        confirmLabel="Reject"
        onConfirm={async () => {
          await runBulkReject();
          setRejectOpen(false);
        }}
      />
    </>
  );
}
