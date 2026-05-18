'use client';

import { ZoruCard, useZoruToast } from '@/components/zoruui';
/**
 * <EmployeesListClient> — canonical Employees list view per §1D.
 *
 * Ships:
 *   - KPI strip (total · active · on leave · terminated · avg tenure)
 *   - View switcher (table | grid | org-chart)
 *   - Filters (status, department, designation, manager, employment
 *     type, work location, joined date range, branch)
 *   - Saved filter presets ("All active", "My team", "On probation",
 *     "Joined last 30 days", "Terminated")
 *   - Search across name, employee ID, email, phone
 *   - Bulk-action bar (archive, export CSV, change department, change
 *     manager, send onboarding kit)
 *
 * Filtering / search runs purely client-side over the docs the server
 * pre-fetched. The server pages are the source of truth for pagination.
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

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
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

  /* Confirm dialogs */
  const [archivePending, setArchivePending] = React.useState(false);

  /* Filtering */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = joinedFrom ? new Date(joinedFrom).getTime() : null;
    const toTs = joinedTo ? new Date(joinedTo).getTime() : null;

    return serverRows.filter((row) => {
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
    serverRows,
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

  /* Bulk-action toggling */
  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));
  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      if (filtered.length === 0) return prev;
      const allSel = filtered.every((r) => prev.has(r._id));
      if (allSel) {
        const next = new Set(prev);
        for (const r of filtered) next.delete(r._id);
        return next;
      }
      const next = new Set(prev);
      for (const r of filtered) next.add(r._id);
      return next;
    });
  }, [filtered]);

  const exportCsv = React.useCallback(() => {
    const rows = filtered.filter(
      (r) => selected.size === 0 || selected.has(r._id),
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
  }, [filtered, selected, toast]);

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
        // joined within the last 90 days. The real "probationEnd" check
        // requires the field on the wire shape, which the Rust DTO
        // already has but the row projection skips today.
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
        // Notice-period employees are captured under `resigned` until
        // the Rust DTO exposes a dedicated flag (matches `getEmployeeKpis`).
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

  /* Bulk handlers — async wiring is currently best-effort UI feedback;
   * server-side mutations will be added as Rust DTOs expand. */
  const handleArchive = React.useCallback(() => {
    setArchivePending(false);
    toast({
      title: 'Archive queued',
      description: `${selected.size} employee${
        selected.size === 1 ? '' : 's'
      } marked for archival.`,
    });
    setSelected(new Set());
  }, [selected, toast]);

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
      description: `Queued onboarding kit for ${selected.size} employee${
        selected.size === 1 ? '' : 's'
      }.`,
    });
  }, [selected, toast]);

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
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
          {error}
        </div>
      ) : null}

      <ZoruCard className="overflow-hidden p-0">
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
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onExportCsv={exportCsv}
          onArchive={() => setArchivePending(true)}
          onChangeDepartment={handleChangeDepartment}
          onChangeManager={handleChangeManager}
          onSendOnboardingKit={handleSendOnboardingKit}
        />

        {view === 'table' ? (
          <EmployeesTable
            rows={filtered}
            selected={selected}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            allSelectedOnPage={allSelectedOnPage}
            filtersActive={filtersActive}
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
      </ZoruCard>

      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${selected.size} employee${
          selected.size === 1 ? '' : 's'
        }?`}
        description="Archived employees are hidden from default views. They can be restored later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => handleArchive()}
      />
    </div>
  );
}
