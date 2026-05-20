'use client';

/**
 * Employee Leave Quotas — deepened list per Deep template (ref
 * src/app/dashboard/crm/hr-payroll/employees/teams/page.tsx).
 *
 * Composition:
 *   <EntityListShell>
 *     - KPI strip (total quotas, by leave type, over-quota employees, expiring)
 *     - Filter row (search + department + status + date range)
 *     - Bulk action bar (bulk delete + bulk archive + bulk export)
 *     - CSV / XLSX export (all or selection) via src/lib/crm-list-export.ts
 *     - Pagination via <PaginationBar>
 *     - <EntityRowLink> on primary cell linking to the employee
 *     - <ConfirmDialog> for single + bulk delete
 *
 * Multi-tenant via getSession() inside the underlying server actions.
 */

import * as React from 'react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  Archive,
  CalendarClock,
  Download,
  Gauge,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  deleteEmployeeLeaveQuota,
  getEmployeeLeaveQuotas,
  saveEmployeeLeaveQuota,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getLeaveTypes } from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmployeeLeaveQuota } from '@/lib/worksuite/hr-ext-types';
import type { WsLeaveType } from '@/lib/worksuite/leave-types';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

type QuotaRow = WsEmployeeLeaveQuota & { _id: string };
type EmployeeLite = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentName?: string;
  status?: string;
};
type LeaveTypeLite = {
  _id: string;
  name: string;
  maxDays?: number;
  status: 'active' | 'inactive';
};
type StatusFilter = 'all' | 'within' | 'over-quota' | 'expiring';

type FormState = {
  _id: string;
  user_id: string;
  leave_type_id: string;
  no_of_leaves: string;
};

const EMPTY_FORM: FormState = {
  _id: '',
  user_id: '',
  leave_type_id: '',
  no_of_leaves: '',
};
const ROWS_PER_PAGE = 20;

// A quota "is expiring" when the linked leave type carries a year-end
// expiry within 90 days — approximated to end-of-year (Dec 31) of the
// current calendar year.
function daysToYearEnd(): number {
  const now = new Date();
  const eoy = new Date(now.getFullYear(), 11, 31);
  return Math.ceil((eoy.getTime() - now.getTime()) / 86_400_000);
}

function toDate(v: any): Date | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default function EmployeeLeaveQuotasPage() {
  const { toast } = useZoruToast();

  const [quotas, setQuotas] = React.useState<QuotaRow[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveTypeLite[]>([]);

  const [isLoading, startLoad] = React.useTransition();
  const [isSaving, startSave] = React.useTransition();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = React.useState(false);

  const load = React.useCallback(() => {
    startLoad(async () => {
      const [qs, lts, es] = await Promise.all([
        getEmployeeLeaveQuotas(),
        getLeaveTypes(),
        getCrmEmployees(),
      ]);
      setQuotas(qs as QuotaRow[]);
      setLeaveTypes(
        (lts as WsLeaveType[]).map((lt) => ({
          _id: String(lt._id),
          name: lt.type_name,
          maxDays: (lt as any).max_days_per_year ?? (lt as any).no_of_leaves ?? undefined,
          status: lt.status ?? 'active',
        })),
      );
      setEmployees(
        (es as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          departmentName: e.departmentName,
          status: e.status,
        })),
      );
      setSelected(new Set());
    });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const employeeMap = React.useMemo(() => {
    const m = new Map<string, EmployeeLite>();
    for (const e of employees) m.set(e._id, e);
    return m;
  }, [employees]);

  const leaveTypeMap = React.useMemo(() => {
    const m = new Map<string, LeaveTypeLite>();
    for (const lt of leaveTypes) m.set(lt._id, lt);
    return m;
  }, [leaveTypes]);

  const empName = React.useCallback(
    (id?: string) => {
      if (!id) return '';
      const e = employeeMap.get(String(id));
      if (!e) return String(id);
      return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email || 'Unnamed';
    },
    [employeeMap],
  );

  const debouncedSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.departmentName) set.add(e.departmentName);
    return Array.from(set).sort();
  }, [employees]);

  const isOverQuota = React.useCallback(
    (q: QuotaRow): boolean => {
      const lt = leaveTypeMap.get(String(q.leave_type_id));
      if (!lt?.maxDays) return false;
      return Number(q.no_of_leaves) > lt.maxDays;
    },
    [leaveTypeMap],
  );

  const expiringSoon = daysToYearEnd() <= 90;

  const filteredQuotas = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 - 1 : null;
    return quotas.filter((row) => {
      const emp = employeeMap.get(String(row.user_id));
      const lt = leaveTypeMap.get(String(row.leave_type_id));
      if (q) {
        const haystack = [empName(row.user_id), lt?.name, emp?.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (departmentFilter !== 'all' && emp?.departmentName !== departmentFilter) return false;
      if (leaveTypeFilter !== 'all' && String(row.leave_type_id) !== leaveTypeFilter) return false;
      switch (statusFilter) {
        case 'within':
          if (isOverQuota(row)) return false;
          break;
        case 'over-quota':
          if (!isOverQuota(row)) return false;
          break;
        case 'expiring':
          if (!expiringSoon) return false;
          break;
      }
      const created = toDate((row as any).createdAt);
      if (created) {
        if (fromTs && created.getTime() < fromTs) return false;
        if (toTs && created.getTime() > toTs) return false;
      } else if (fromTs || toTs) {
        return false;
      }
      return true;
    });
  }, [
    quotas,
    search,
    departmentFilter,
    leaveTypeFilter,
    statusFilter,
    dateFrom,
    dateTo,
    employeeMap,
    leaveTypeMap,
    empName,
    isOverQuota,
    expiringSoon,
  ]);

  const total = filteredQuotas.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const pageRows = React.useMemo(
    () => filteredQuotas.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filteredQuotas, page],
  );

  // KPIs over the filtered set.
  const kpis = React.useMemo(() => {
    const totalQuotas = filteredQuotas.length;
    const byType = new Map<string, number>();
    let overQuotaEmployees = 0;
    const overQuotaSet = new Set<string>();
    for (const q of filteredQuotas) {
      const lt = leaveTypeMap.get(String(q.leave_type_id));
      const name = lt?.name ?? 'Unknown';
      byType.set(name, (byType.get(name) ?? 0) + 1);
      if (isOverQuota(q)) {
        if (!overQuotaSet.has(String(q.user_id))) {
          overQuotaSet.add(String(q.user_id));
          overQuotaEmployees += 1;
        }
      }
    }
    let topType: { name: string; count: number } | null = null;
    for (const [name, count] of byType) {
      if (!topType || count > topType.count) topType = { name, count };
    }
    const expiringCount = expiringSoon ? totalQuotas : 0;
    return {
      totalQuotas,
      topType,
      typeCount: byType.size,
      overQuotaEmployees,
      expiringCount,
    };
  }, [filteredQuotas, leaveTypeMap, isOverQuota, expiringSoon]);

  // ── Form helpers ───────────────────────────────────────────────────
  const openAdd = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((q: QuotaRow) => {
    setForm({
      _id: String(q._id),
      user_id: String(q.user_id),
      leave_type_id: String(q.leave_type_id),
      no_of_leaves: String(q.no_of_leaves),
    });
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(() => {
    if (!form.user_id || !form.leave_type_id) {
      toast({ title: 'Select employee and leave type', variant: 'destructive' });
      return;
    }
    if (!form.no_of_leaves || Number.isNaN(Number(form.no_of_leaves))) {
      toast({ title: 'Enter a valid number of leaves', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('leave_type_id', form.leave_type_id);
      fd.append('no_of_leaves', form.no_of_leaves);
      const res = await saveEmployeeLeaveQuota(null, fd);
      if (res?.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: form._id ? 'Updated' : 'Created' });
      setDialogOpen(false);
      load();
    });
  }, [form, load, toast]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      const res = await deleteEmployeeLeaveQuota(id);
      if ((res as any)?.error) {
        toast({
          title: 'Delete failed',
          description: (res as any).error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Quota deleted' });
      load();
    },
    [load, toast],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetId) return;
    await handleDelete(deleteTargetId);
    setDeleteTargetId(null);
  }, [deleteTargetId, handleDelete]);

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0;
    for (const id of ids) {
      const res = await deleteEmployeeLeaveQuota(id);
      if (!(res as any)?.error) ok += 1;
    }
    toast({ title: `${ok} quota${ok === 1 ? '' : 's'} deleted` });
    setBulkDeleteOpen(false);
    setSelected(new Set());
    load();
  }, [selected, load, toast]);

  // Archive = set no_of_leaves to 0 (effectively withdraws the quota
  // without losing history). Non-destructive — keeps the record so the
  // employee's leave history references remain valid.
  const handleBulkArchive = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0;
    for (const id of ids) {
      const q = quotas.find((x) => String(x._id) === id);
      if (!q) continue;
      const fd = new FormData();
      fd.append('_id', id);
      fd.append('user_id', String(q.user_id));
      fd.append('leave_type_id', String(q.leave_type_id));
      fd.append('no_of_leaves', '0');
      const res = await saveEmployeeLeaveQuota(null, fd);
      if (!res?.error) ok += 1;
    }
    toast({ title: `${ok} quota${ok === 1 ? '' : 's'} archived (set to 0)` });
    setBulkArchiveOpen(false);
    setSelected(new Set());
    load();
  }, [selected, quotas, load, toast]);

  // ── Selection ─────────────────────────────────────────────────────
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
      setSelected(all ? new Set(pageRows.map((r) => r._id)) : new Set());
    },
    [pageRows],
  );

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  // ── Export ─────────────────────────────────────────────────────────
  const buildExportRows = React.useCallback((): {
    headers: string[];
    rows: ExportRow[];
  } => {
    const source =
      selected.size > 0
        ? filteredQuotas.filter((q) => selected.has(q._id))
        : filteredQuotas;
    const headers = [
      'Employee',
      'Department',
      'Leave Type',
      'Quota (days)',
      'Type Max',
      'Over Quota',
    ];
    const rows = source.map((q) => {
      const emp = employeeMap.get(String(q.user_id));
      const lt = leaveTypeMap.get(String(q.leave_type_id));
      return {
        Employee: empName(q.user_id),
        Department: emp?.departmentName ?? '',
        'Leave Type': lt?.name ?? String(q.leave_type_id),
        'Quota (days)': q.no_of_leaves,
        'Type Max': lt?.maxDays ?? '',
        'Over Quota': isOverQuota(q) ? 'Yes' : 'No',
      } satisfies ExportRow;
    });
    return { headers, rows };
  }, [selected, filteredQuotas, employeeMap, leaveTypeMap, empName, isOverQuota]);

  const exportCsv = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    downloadCsv(`leave-quotas-${dateStamp()}.csv`, headers, rows);
  }, [buildExportRows]);

  const exportXlsx = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    void downloadXlsx(
      `leave-quotas-${dateStamp()}.xlsx`,
      headers,
      rows,
      'Leave Quotas',
    );
  }, [buildExportRows]);

  const hasActiveFilters =
    !!search ||
    departmentFilter !== 'all' ||
    leaveTypeFilter !== 'all' ||
    statusFilter !== 'all' ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSearchInput('');
    setDepartmentFilter('all');
    setLeaveTypeFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <EntityListShell
        title="Leave Quotas"
        subtitle="Allocate annual leave quotas per employee and leave type."
        search={{
          value: searchInput,
          onChange: (v) => {
            setSearchInput(v);
            debouncedSearch(v);
          },
          placeholder: 'Search employee or leave type…',
        }}
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={exportXlsx}>
              <Download className="h-4 w-4" /> XLSX
            </ZoruButton>
            <ZoruButton onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Quota
            </ZoruButton>
          </div>
        }
        filters={
          <>
            <ZoruSelect
              value={departmentFilter}
              onValueChange={(v) => {
                setDepartmentFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-48 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Department" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All departments</ZoruSelectItem>
                {departments.map((d) => (
                  <ZoruSelectItem key={d} value={d}>
                    {d}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={leaveTypeFilter}
              onValueChange={(v) => {
                setLeaveTypeFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-48 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Leave Type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All leave types</ZoruSelectItem>
                {leaveTypes.map((lt) => (
                  <ZoruSelectItem key={lt._id} value={lt._id}>
                    {lt.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-44 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="within">Within quota</ZoruSelectItem>
                <ZoruSelectItem value="over-quota">Over quota</ZoruSelectItem>
                <ZoruSelectItem value="expiring">Expiring soon</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <div className="flex items-center gap-1.5">
              <ZoruInput
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[140px] rounded-full border-zoru-line bg-zoru-bg text-[12.5px]"
                aria-label="Created from"
              />
              <span className="text-[12px] text-zoru-ink-muted">to</span>
              <ZoruInput
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[140px] rounded-full border-zoru-line bg-zoru-bg text-[12.5px]"
                aria-label="Created to"
              />
            </div>
            {hasActiveFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </ZoruButton>
            ) : null}
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-zoru-ink">
                {selected.size} quota{selected.size === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Export CSV
                </ZoruButton>
                <ZoruButton variant="outline" size="sm" onClick={exportXlsx}>
                  <Download className="h-4 w-4" /> Export XLSX
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkArchiveOpen(true)}
                >
                  <Archive className="h-4 w-4" /> Archive
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="text-zoru-danger-ink"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear selection
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        pagination={
          total > 0 ? (
            <PaginationBar
              page={page}
              limit={ROWS_PER_PAGE}
              hasMore={page < totalPages}
              total={total}
              controlled={{ onChange: (next) => setPage(next.page) }}
            />
          ) : null
        }
        loading={isLoading && quotas.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<ListChecks className="h-4 w-4" />}
              label="Total quotas"
              value={kpis.totalQuotas.toLocaleString('en-IN')}
              hint="Visible after filters"
            />
            <KpiCard
              icon={<Gauge className="h-4 w-4" />}
              label="Top leave type"
              value={kpis.topType ? kpis.topType.name : '—'}
              hint={
                kpis.topType
                  ? `${kpis.topType.count.toLocaleString('en-IN')} of ${kpis.typeCount} types`
                  : 'No data'
              }
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Over quota"
              value={kpis.overQuotaEmployees.toLocaleString('en-IN')}
              hint="Employees over the type's annual max"
            />
            <KpiCard
              icon={<CalendarClock className="h-4 w-4" />}
              label="Expiring soon"
              value={kpis.expiringCount.toLocaleString('en-IN')}
              hint="Year-end < 90 days away"
            />
          </div>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[16px] text-zoru-ink">Quotas</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                One row per employee + leave type.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-zoru-line bg-zoru-surface-2">
                    <th className="w-10 px-3 py-2.5">
                      <ZoruCheckbox
                        checked={allOnPageSelected}
                        onCheckedChange={(c) => toggleAll(Boolean(c))}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Employee
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Leave Type
                    </th>
                    <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                      Quota (days)
                    </th>
                    <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                      Type Max
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {hasActiveFilters
                          ? 'No quotas match the current filters.'
                          : 'No leave quotas found.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((q) => {
                      const id = String(q._id);
                      const isSelected = selected.has(id);
                      const emp = employeeMap.get(String(q.user_id));
                      const empHref = `/dashboard/crm/hr-payroll/employees/${String(q.user_id)}`;
                      const lt = leaveTypeMap.get(String(q.leave_type_id));
                      const over = isOverQuota(q);
                      return (
                        <tr
                          key={id}
                          className="border-t border-zoru-line hover:bg-zoru-surface-2/50"
                        >
                          <td className="px-3 py-2.5">
                            <ZoruCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(id)}
                              aria-label={`Select quota for ${empName(q.user_id)}`}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <EntityRowLink
                              href={empHref}
                              label={empName(q.user_id) || 'Unnamed'}
                              subtitle={emp?.departmentName ?? emp?.email ?? '—'}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink">
                            {lt?.name ?? String(q.leave_type_id)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-zoru-surface-2 px-2 font-mono text-[13px] text-zoru-ink">
                              {Number(q.no_of_leaves).toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-zoru-ink-muted">
                            {lt?.maxDays != null ? lt.maxDays : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            {over ? (
                              <ZoruBadge variant="danger">Over quota</ZoruBadge>
                            ) : (
                              <ZoruBadge variant="success">Within</ZoruBadge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(q)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </ZoruButton>
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTargetId(id)}
                                disabled={isSaving}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                              </ZoruButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </ZoruCard>
        </div>

        <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <ZoruDialogContent className="sm:max-w-[480px]">
            <ZoruDialogHeader>
              <ZoruDialogTitle>
                {form._id ? 'Edit Leave Quota' : 'Add Leave Quota'}
              </ZoruDialogTitle>
            </ZoruDialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Employee <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruSelect
                  value={form.user_id || '__none__'}
                  onValueChange={(v) => set('user_id', v === '__none__' ? '' : v)}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue placeholder="Select employee" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="__none__">— Select employee —</ZoruSelectItem>
                    {employees.map((e) => (
                      <ZoruSelectItem key={e._id} value={e._id}>
                        {[e.firstName, e.lastName].filter(Boolean).join(' ') ||
                          e.email ||
                          'Unnamed'}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Leave Type <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruSelect
                  value={form.leave_type_id || '__none__'}
                  onValueChange={(v) =>
                    set('leave_type_id', v === '__none__' ? '' : v)
                  }
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue placeholder="Select leave type" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="__none__">— Select leave type —</ZoruSelectItem>
                    {leaveTypes.map((lt) => (
                      <ZoruSelectItem key={lt._id} value={lt._id}>
                        {lt.name}
                        {lt.maxDays != null ? ` (max ${lt.maxDays})` : ''}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Number of Leaves <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  type="number"
                  min="0"
                  value={form.no_of_leaves}
                  onChange={(e) => set('no_of_leaves', e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
            <ZoruDialogFooter>
              <ZoruButton variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {form._id ? 'Update' : 'Add'}
              </ZoruButton>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </ZoruDialog>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this leave quota?"
        description="This permanently removes the quota entry. History records are not deleted."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} quota${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected quotas."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title={`Archive ${selected.size} quota${selected.size === 1 ? '' : 's'}?`}
        description="Sets the quota to 0 days without deleting the record. Keep this when the employee should no longer accrue leave under that type but you want to preserve history."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={handleBulkArchive}
      />
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ZoruCard className="p-5">
      <div className="flex items-center gap-2 text-zoru-ink-muted">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className="mt-2 truncate text-2xl text-zoru-ink">{value}</div>
      {hint ? (
        <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{hint}</p>
      ) : null}
    </ZoruCard>
  );
}
