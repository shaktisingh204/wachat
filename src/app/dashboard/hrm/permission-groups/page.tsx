'use client';

/**
 * /dashboard/hrm/permission-groups
 *
 * List + manage HRM permission groups. Features:
 *   - 4-card KPI strip
 *   - Table: Name | Description | Modules | Employees Assigned | Actions
 *   - "New Group" slide-over drawer with <PermissionMatrix />
 *   - "Manage Assignments" slide-over to link employees ↔ groups
 *   - Bulk delete with confirmation
 *   - CSV export
 */

import * as React from 'react';
import Link from 'next/link';
import {
  FileDown,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  deletePermissionGroup,
  getPermissionGroupKpis,
  getPermissionGroups,
  getHrmEmployeeList,
  getEmployeesInGroup,
} from '@/app/actions/hrm-permission-groups.actions';
import type {
  HrmPermissionGroup,
} from '@/app/actions/hrm-permission-groups.actions';
import { NewGroupSheet } from './_components/new-group-sheet';
import { AssignGroupSheet } from './_components/assign-group-sheet';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Kpi {
  label: string;
  value: number;
}

interface Employee {
  _id: string;
  name: string;
  email?: string;
}

interface Assignment {
  employeeId: string;
  groupId: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function moduleCount(g: HrmPermissionGroup): number {
  return g.permissions.filter((p) => p.actions.length > 0).length;
}

function csvRows(groups: HrmPermissionGroup[]): Record<string, string>[] {
  return groups.map((g) => ({
    Name: g.name,
    Description: g.description ?? '',
    'Modules Covered': String(moduleCount(g)),
    Created: g.createdAt.slice(0, 10),
    Updated: g.updatedAt.slice(0, 10),
  }));
}

const CSV_HEADERS = ['Name', 'Description', 'Modules Covered', 'Created', 'Updated'];

/* ─── Page component ─────────────────────────────────────────────────────── */

export default function PermissionGroupsPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [groups, setGroups] = React.useState<HrmPermissionGroup[]>([]);
  const [kpis, setKpis] = React.useState<Kpi[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<HrmPermissionGroup | null>(
    null,
  );
  const [pendingBulk, setPendingBulk] = React.useState(false);
  const [deleting, startDeleteTransition] = React.useTransition();
  const [bulkDeleting, startBulkTransition] = React.useTransition();

  /* ── Data loading ──────────────────────────────────────────────────────── */

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [groupList, kpiList, empList] = await Promise.all([
        getPermissionGroups(),
        getPermissionGroupKpis(),
        getHrmEmployeeList(),
      ]);
      setGroups(groupList);
      setKpis(kpiList);
      setEmployees(empList);

      // Load all assignments in one pass
      const allAssignments: Assignment[] = [];
      await Promise.all(
        groupList.map(async (g) => {
          const emps = await getEmployeesInGroup(g._id);
          for (const e of emps) {
            allAssignments.push({ employeeId: e.employeeId, groupId: g._id });
          }
        }),
      );
      setAssignments(allAssignments);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  /* ── Filtering ─────────────────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description ?? '').toLowerCase().includes(q),
    );
  }, [groups, search]);

  /* ── Selection ─────────────────────────────────────────────────────────── */

  const toggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(
    (checked: boolean) => {
      setSelected(checked ? new Set(filtered.map((g) => g._id)) : new Set());
    },
    [filtered],
  );

  const allSelected =
    filtered.length > 0 && filtered.every((g) => selected.has(g._id));
  const someSelected = !allSelected && filtered.some((g) => selected.has(g._id));

  /* ── Delete handlers ───────────────────────────────────────────────────── */

  const handleDeleteOne = React.useCallback(() => {
    if (!pendingDelete) return;
    startDeleteTransition(async () => {
      const res = await deletePermissionGroup(pendingDelete._id);
      if (res.success) {
        toast({ title: 'Group deleted' });
        setPendingDelete(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(pendingDelete._id);
          return next;
        });
        await refresh();
      } else {
        toast({ title: res.error ?? 'Delete failed', variant: 'destructive' });
      }
    });
  }, [pendingDelete, toast, refresh]);

  const handleBulkDelete = React.useCallback(() => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    startBulkTransition(async () => {
      let ok = 0;
      for (const id of ids) {
        const res = await deletePermissionGroup(id);
        if (res.success) ok += 1;
      }
      toast({ title: `${ok} group${ok === 1 ? '' : 's'} deleted` });
      setSelected(new Set());
      setPendingBulk(false);
      await refresh();
    });
  }, [selected, toast, refresh]);

  /* ── CSV export ────────────────────────────────────────────────────────── */

  const handleExport = React.useCallback(() => {
    const src = selected.size > 0 ? filtered.filter((g) => selected.has(g._id)) : filtered;
    if (!src.length) {
      toast({ title: 'Nothing to export' });
      return;
    }
    downloadCsv(
      `permission-groups-${dateStamp()}.csv`,
      CSV_HEADERS,
      csvRows(src),
    );
    toast({ title: `Exported ${src.length} rows` });
  }, [filtered, selected, toast]);

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-zoru-ink-muted" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-zoru-ink">
              Permission Groups
            </h1>
            <p className="text-[13px] text-zoru-ink-muted">
              Define role-based access sets and assign them to employees
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AssignGroupSheet
            groups={groups}
            employees={employees}
            currentAssignments={assignments}
            onChanged={() => void refresh()}
          />
          <ZoruButton variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="h-4 w-4" />
            CSV
          </ZoruButton>
          <NewGroupSheet onCreated={() => void refresh()} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <ZoruSkeleton key={i} className="h-20 w-full rounded-[var(--zoru-radius)]" />
            ))
          : kpis.map((k) => (
              <ZoruStatCard key={k.label} label={k.label} value={String(k.value)} />
            ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-zoru-line bg-zoru-surface-2 px-4 py-2">
          <div className="flex items-center gap-2">
            <ZoruBadge variant="default">{selected.size} selected</ZoruBadge>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[12px] text-zoru-ink-muted hover:text-zoru-ink"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExport}>
              <FileDown className="h-3.5 w-3.5" />
              Export
            </ZoruButton>
            <ZoruButton
              variant="destructive"
              size="sm"
              onClick={() => setPendingBulk(true)}
              disabled={bulkDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {selected.size}
            </ZoruButton>
          </div>
        </div>
      ) : null}

      {/* Search */}
      <ZoruInput
        placeholder="Search groups…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {/* Table */}
      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10">
                  <ZoruCheckbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Description</ZoruTableHead>
                <ZoruTableHead className="text-center">Modules</ZoruTableHead>
                <ZoruTableHead className="text-center">Employees</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>

            <ZoruTableBody>
              {loading && groups.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <ZoruTableRow key={i}>
                      <ZoruTableCell colSpan={6}>
                        <ZoruSkeleton className="h-8 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                : filtered.length === 0
                  ? (
                    <ZoruTableRow>
                      <ZoruTableCell
                        colSpan={6}
                        className="h-28 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {search
                          ? 'No groups match your search.'
                          : 'No permission groups yet. Create one to get started.'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  )
                  : filtered.map((g) => {
                    const empCount = assignments.filter(
                      (a) => a.groupId === g._id,
                    ).length;
                    return (
                      <ZoruTableRow key={g._id} className="border-zoru-line">
                        <ZoruTableCell>
                          <ZoruCheckbox
                            checked={selected.has(g._id)}
                            onCheckedChange={() => toggleOne(g._id)}
                            aria-label={`Select ${g.name}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-medium text-zoru-ink">
                          <Link
                            href={`/dashboard/hrm/permission-groups/${g._id}`}
                            className="hover:underline"
                          >
                            {g.name}
                          </Link>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                          {g.description ?? '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-center text-[13px]">
                          <ZoruBadge variant="secondary">
                            {moduleCount(g)}
                          </ZoruBadge>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-center text-[13px]">
                          {empCount > 0 ? (
                            <ZoruBadge variant="default">{empCount}</ZoruBadge>
                          ) : (
                            <span className="text-zoru-ink-muted">0</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <ZoruButton variant="ghost" size="sm" asChild>
                              <Link
                                href={`/dashboard/hrm/permission-groups/${g._id}`}
                                aria-label="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              aria-label="Delete"
                              onClick={() => setPendingDelete(g)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            </ZoruButton>
                          </div>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

      {/* Single delete confirm */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete permission group?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {pendingDelete
                ? `Deleting "${pendingDelete.name}" will also remove all employee assignments for this group. This cannot be undone.`
                : 'This action cannot be undone.'}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDeleteOne} disabled={deleting}>
              {deleting ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk delete confirm */}
      <ZoruAlertDialog
        open={pendingBulk}
        onOpenChange={(o) => !o && setPendingBulk(false)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} group{selected.size === 1 ? '' : 's'}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              All selected groups and their employee assignments will be
              permanently removed.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
