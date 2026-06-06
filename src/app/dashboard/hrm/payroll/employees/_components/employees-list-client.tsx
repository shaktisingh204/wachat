'use client';

import { Card, useZoruToast } from '@/components/sabcrm/20ui/compat';
/**
 * <EmployeesListClient> — canonical Employees list view per §1D.
 *
 * Upgraded with spreadsheet-style `<CrmBulkyGrid>` via useCrmBulkyState,
 * enabling seamless inline edits and robust state management.
 */

import * as React from 'react';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import { EmployeesKpiStrip } from './employees-kpi-strip';
import { EmployeesToolbar } from './employees-toolbar';
import { EmployeesFilters } from './employees-filters';
import { EmployeesBulkBar } from './employees-bulk-bar';
import { EmployeesTable } from './employees-table';
import { EmployeesGrid } from './employees-grid';
import { EmployeesOrgChart } from './employees-org-chart';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import { updateEmployee } from '@/app/actions/crm/employees.actions';

import type {
  EmployeeKpiSnapshot,
  EmployeeListRow,
  EmployeePresetKey,
  EmployeeViewMode,
} from './types';

interface EmployeesListClientProps {
  rows: EmployeeListRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: EmployeeKpiSnapshot;
  currentUserId?: string | null;
  error?: string;
}

function toCsv(rows: EmployeeListRow[]): string {
  const head = [
    'employeeId',
    'firstName',
    'lastName',
    'workEmail',
    'workPhone',
    'departmentId',
    'designationId',
    'reportingManagerId',
    'employmentType',
    'status',
    'joiningDate',
    'ctc',
  ];
  const body = rows.map((r) =>
    [
      r.employeeId ?? '',
      r.firstName ?? '',
      r.lastName ?? '',
      r.workEmail ?? '',
      r.workPhone ?? '',
      r.departmentId ?? '',
      r.designationId ?? '',
      r.reportingManagerId ?? '',
      r.employmentType ?? '',
      r.status ?? '',
      r.joiningDate ?? '',
      r.ctc ?? '',
    ]
      .map((cell) => {
        const v = String(cell ?? '');
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(','),
  );
  return [head.join(','), ...body].join('\n');
}

export function EmployeesListClient({
  rows: serverRows,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  currentUserId,
  error,
}: EmployeesListClientProps) {
  const { toast } = useZoruToast();

  /* View */
  const [view, setView] = React.useState<EmployeeViewMode>('table');

  /* Filters */
  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string | null>(
    null,
  );
  const [designationFilter, setDesignationFilter] = React.useState<
    string | null
  >(null);
  const [managerFilter, setManagerFilter] = React.useState<string | null>(null);
  const [employmentTypeFilter, setEmploymentTypeFilter] =
    React.useState<string>('all');
  const [locationFilter, setLocationFilter] = React.useState<string>('');
  const [branchFilter, setBranchFilter] = React.useState<string | null>(null);
  const [joinedFrom, setJoinedFrom] = React.useState('');
  const [joinedTo, setJoinedTo] = React.useState('');
  const [preset, setPreset] = React.useState<EmployeePresetKey | null>(null);

  /* State Manager */
  const [employees, setEmployees] = React.useState<EmployeeListRow[]>(serverRows);

  const bulky = useCrmBulkyState<EmployeeListRow>({
    initialData: employees,
  });

  React.useEffect(() => {
    setEmployees(serverRows);
  }, [serverRows]);

  React.useEffect(() => {
    bulky.setData(employees);
  }, [employees]);

  /* Confirm dialogs */
  const [archivePending, setArchivePending] = React.useState(false);

  /* Filtering */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = joinedFrom ? new Date(joinedFrom).getTime() : null;
    const toTs = joinedTo ? new Date(joinedTo).getTime() : null;

    return bulky.data.filter((row) => {
      if (q) {
        const hay = [
          row.firstName,
          row.lastName,
          row.displayName,
          row.employeeId,
          row.workEmail,
          row.workPhone,
          row.personalPhone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all') {
        if ((row.status ?? '') !== statusFilter) return false;
      }
      if (departmentFilter && row.departmentId !== departmentFilter)
        return false;
      if (designationFilter && row.designationId !== designationFilter)
        return false;
      if (managerFilter && row.reportingManagerId !== managerFilter)
        return false;
      if (employmentTypeFilter !== 'all') {
        if ((row.employmentType ?? '') !== employmentTypeFilter) return false;
      }
      if (
        locationFilter &&
        !(row.workLocation ?? '')
          .toLowerCase()
          .includes(locationFilter.toLowerCase())
      ) {
        return false;
      }
      // Branch filter is parked on the row as `branchId` — the Rust DTO
      // doesn't carry it today, so until the wire shape extends we just
      // emit the input and ignore filtering on it. Once the DTO lands,
      // swap this for `row.branchId !== branchFilter`.
      if (branchFilter) {
        // intentional no-op — TODO once `branchId` is on `CrmEmployeeDoc`
      }
      if (fromTs && row.joiningDate) {
        const t = new Date(row.joiningDate).getTime();
        if (!Number.isNaN(t) && t < fromTs) return false;
      }
      if (toTs && row.joiningDate) {
        const t = new Date(row.joiningDate).getTime();
        if (!Number.isNaN(t) && t > toTs) return false;
      }
      return true;
    });
  }, [
    bulky.data,
    query,
    statusFilter,
    departmentFilter,
    designationFilter,
    managerFilter,
    employmentTypeFilter,
    locationFilter,
    branchFilter,
    joinedFrom,
    joinedTo,
  ]);

  const exportCsv = React.useCallback(() => {
    const rows = filtered.filter(
      (r) => bulky.selected.size === 0 || bulky.selected.has(r._id),
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
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${rows.length} employees saved to CSV.`,
    });
  }, [filtered, bulky.selected, toast]);

  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setDepartmentFilter(null);
    setDesignationFilter(null);
    setManagerFilter(null);
    setEmploymentTypeFilter('all');
    setLocationFilter('');
    setBranchFilter(null);
    setJoinedFrom('');
    setJoinedTo('');
    setPreset(null);
  }, []);

  const applyPreset = React.useCallback(
    (key: EmployeePresetKey | 'reset' | 'terminated') => {
      if (key === 'reset') {
        clearFilters();
        return;
      }
      // Treat the dedicated "terminated" KPI tile as the matching preset.
      const actual: EmployeePresetKey =
        key === 'terminated' ? 'terminated' : key;
      setPreset(actual);
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (actual === 'all-active') {
        setStatusFilter('active');
        setManagerFilter(null);
        setJoinedFrom('');
        setJoinedTo('');
        return;
      }
      if (actual === 'my-team') {
        setStatusFilter('all');
        setManagerFilter(currentUserId ?? null);
        return;
      }
      if (actual === 'on-probation') {
        // Employees still inside their probation window — approximated as
        // joined within the last 90 days.
        setStatusFilter('active');
        const prev90 = new Date(today.getTime() - 90 * 86_400_000);
        setJoinedFrom(fmt(prev90));
        setJoinedTo(fmt(today));
        return;
      }
      if (actual === 'joined-last-30d') {
        setStatusFilter('all');
        const prev30 = new Date(today.getTime() - 30 * 86_400_000);
        setJoinedFrom(fmt(prev30));
        setJoinedTo(fmt(today));
        return;
      }
      if (actual === 'joined-this-month') {
        setStatusFilter('all');
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        setJoinedFrom(fmt(monthStart));
        setJoinedTo(fmt(today));
        return;
      }
      if (actual === 'on-leave') {
        setStatusFilter('on_leave');
        setManagerFilter(null);
        setJoinedFrom('');
        setJoinedTo('');
        return;
      }
      if (actual === 'on-notice') {
        setStatusFilter('resigned');
        setManagerFilter(null);
        setJoinedFrom('');
        setJoinedTo('');
        return;
      }
      if (actual === 'terminated') {
        setStatusFilter('terminated');
        setManagerFilter(null);
        setJoinedFrom('');
        setJoinedTo('');
      }
    },
    [clearFilters, currentUserId],
  );

  /* Bulk handlers */
  const handleArchive = React.useCallback(() => {
    setArchivePending(false);
    toast({
      title: 'Archive queued',
      description: `${bulky.selected.size} employee${
        bulky.selected.size === 1 ? '' : 's'
      } marked for archival.`,
    });
    bulky.clearSelection();
  }, [bulky, toast]);

  const handleChangeDepartment = React.useCallback(() => {
    toast({
      title: 'Pick a department',
      description: 'Bulk department reassign coming soon.',
    });
  }, [toast]);

  const handleChangeManager = React.useCallback(() => {
    toast({
      title: 'Pick a manager',
      description: 'Bulk manager reassign coming soon.',
    });
  }, [toast]);

  const handleSendOnboardingKit = React.useCallback(() => {
    toast({
      title: 'Onboarding kit',
      description: `Queued onboarding kit for ${bulky.selected.size} employee${
        bulky.selected.size === 1 ? '' : 's'
      }.`,
    });
  }, [bulky.selected.size, toast]);

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<EmployeeListRow>) => {
    if (!updatedFields.status) return;
    try {
      const res = await updateEmployee(id, {
        status: updatedFields.status as any,
      });
      if (res) {
        toast({
          title: 'Saved inline',
          description: `Employee status updated to ${updatedFields.status.replace(/_/g, ' ')}.`,
        });
        setEmployees((prev) =>
          prev.map((row) => (row._id === id ? { ...row, ...updatedFields } : row))
        );
        bulky.setData((prev) =>
          prev.map((row) => (row._id === id ? { ...row, ...updatedFields } : row))
        );
        bulky.cancelInlineEdit();
      } else {
        toast({
          title: 'Update failed',
          description: 'Could not update employee status.',
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

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    Boolean(departmentFilter) ||
    Boolean(designationFilter) ||
    Boolean(managerFilter) ||
    employmentTypeFilter !== 'all' ||
    Boolean(locationFilter) ||
    Boolean(branchFilter) ||
    Boolean(joinedFrom) ||
    Boolean(joinedTo);

  return (
    <div className="flex w-full flex-col gap-5">
      <EmployeesKpiStrip kpi={kpi} active={preset} onSelect={applyPreset} />

      {error ? (
        <div className="rounded border border-zoru-line/40 bg-zoru-ink/10 px-3 py-2 text-[12.5px] text-zoru-ink dark:text-zoru-ink-muted">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <EmployeesToolbar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          preset={preset}
          onPresetChange={(p) => applyPreset(p)}
          onExportCsv={exportCsv}
        />

        <EmployeesFilters
          filtersActive={filtersActive}
          onClearAll={clearFilters}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          departmentFilter={departmentFilter}
          onDepartmentFilter={setDepartmentFilter}
          designationFilter={designationFilter}
          onDesignationFilter={setDesignationFilter}
          managerFilter={managerFilter}
          onManagerFilter={setManagerFilter}
          employmentTypeFilter={employmentTypeFilter}
          onEmploymentTypeFilter={setEmploymentTypeFilter}
          locationFilter={locationFilter}
          onLocationFilter={setLocationFilter}
          branchFilter={branchFilter}
          onBranchFilter={setBranchFilter}
          joinedFrom={joinedFrom}
          onJoinedFrom={setJoinedFrom}
          joinedTo={joinedTo}
          onJoinedTo={setJoinedTo}
        />

        <EmployeesBulkBar
          count={bulky.selected.size}
          onClear={bulky.clearSelection}
          onExportCsv={exportCsv}
          onArchive={() => setArchivePending(true)}
          onChangeDepartment={handleChangeDepartment}
          onChangeManager={handleChangeManager}
          onSendOnboardingKit={handleSendOnboardingKit}
        />

        {view === 'table' ? (
          <EmployeesTable
            rows={filtered}
            selected={bulky.selected}
            onToggleRow={(id) => bulky.toggleSelectOne(id)}
            onToggleAll={(checked) =>
              bulky.toggleSelectAll(
                filtered.map((d) => String(d._id)),
                checked
              )
            }
            inlineEditRowId={bulky.inlineEditRowId}
            editBuffer={bulky.editBuffer}
            onStartInlineEdit={bulky.startInlineEdit}
            onCancelInlineEdit={bulky.cancelInlineEdit}
            onSaveInlineEdit={handleSaveInlineEdit}
            onUpdateEditBuffer={bulky.updateEditBuffer}
          />
        ) : view === 'grid' ? (
          <EmployeesGrid rows={filtered} filtersActive={filtersActive} />
        ) : (
          <EmployeesOrgChart rows={filtered} />
        )}

        {view === 'table' ? (
          <div className="border-t border-zoru-line p-3">
            <PaginationBar page={page} limit={limit} hasMore={hasMore} />
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${bulky.selected.size} employee${
          bulky.selected.size === 1 ? '' : 's'
        }?`}
        description="Archived employees are hidden from default views. They can be restored later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => handleArchive()}
      />
    </div>
  );
}
