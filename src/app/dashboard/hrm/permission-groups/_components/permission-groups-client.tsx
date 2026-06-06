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
  FileText,
  Pencil,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Badge, Button, Card, Checkbox, Input, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  deletePermissionGroup,
  getPermissionGroupKpis,
  getPermissionGroups,
  getHrmEmployeeList,
  getEmployeesInGroup,
} from '@/app/actions/hrm-permission-groups.actions';
import dynamic from 'next/dynamic';
import { usePermissionGroupWebsocket } from './use-permission-websocket';
import { useVirtualizer } from '@tanstack/react-virtual';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import type { HrmPermissionGroup } from '@/app/actions/hrm-permission-groups.actions.types';

const NewGroupSheet = dynamic(() => import('./new-group-sheet').then(m => m.NewGroupSheet), {
  ssr: false,
});
const AssignGroupSheet = dynamic(() => import('./assign-group-sheet').then(m => m.AssignGroupSheet), {
  ssr: false,
});

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

export default function PermissionGroupsClient({
  initialGroups,
  initialKpis,
  initialEmployees,
  initialAssignments,
}: {
  initialGroups: HrmPermissionGroup[];
  initialKpis: Kpi[];
  initialEmployees: Employee[];
  initialAssignments: Assignment[];
}): React.JSX.Element {
  const { toast } = useToast();

  const { groups, setGroups } = usePermissionGroupWebsocket(initialGroups);
  const [kpis, setKpis] = React.useState<Kpi[]>(initialKpis);
  const [employees, setEmployees] = React.useState<Employee[]>(initialEmployees);
  const [assignments, setAssignments] = React.useState<Assignment[]>(initialAssignments);

  React.useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  React.useEffect(() => {
    setKpis(initialKpis);
  }, [initialKpis]);

  React.useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<HrmPermissionGroup | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState(false);
  const [deleting, startDeleteTransition] = React.useTransition();
  const [bulkDeleting, startBulkTransition] = React.useTransition();
  const [minModules, setMinModules] = React.useState<number | ''>('');
  const [hasEmployees, setHasEmployees] = React.useState<string>('all'); // 'all', 'yes', 'no'

  const refresh = React.useCallback(async () => {
    // Only refresh KPIs, the Server Component and WebSocket handle the rest, but 
    // revalidatePath from server actions will trigger a full refetch anyway.
    try {
      const kpiList = await getPermissionGroupKpis();
      setKpis(kpiList);
    } catch (e) {
      console.error(e);
    }
  }, []);

  /* ── Filtering ─────────────────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let res = groups;
    
    if (q) {
      res = res.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.description ?? '').toLowerCase().includes(q),
      );
    }
    
    if (minModules !== '') {
      res = res.filter(g => moduleCount(g) >= minModules);
    }
    
    if (hasEmployees !== 'all') {
      res = res.filter(g => {
        const count = assignments.filter(a => a.groupId === g._id).length;
        if (hasEmployees === 'yes') return count > 0;
        if (hasEmployees === 'no') return count === 0;
        return true;
      });
    }
    
    return res;
  }, [groups, search, minModules, hasEmployees, assignments]);

  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 5,
  });

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
    const idToDelete = pendingDelete._id;
    
    // Optimistic Update
    setGroups(prev => prev.filter(g => g._id !== idToDelete));
    setPendingDelete(null);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(idToDelete);
      return next;
    });
    
    startDeleteTransition(async () => {
      const res = await deletePermissionGroup(idToDelete);
      if (res.success) {
        toast({ title: 'Group deleted' });
        await refresh();
      } else {
        // Revert Optimistic Update
        setGroups(prev => [...prev, pendingDelete]);
        toast({ title: res.error ?? 'Delete failed', variant: 'destructive' });
      }
    });
  }, [pendingDelete, toast, refresh, setGroups]);

  const handleBulkDelete = React.useCallback(() => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    
    const groupsToRestore = groups.filter(g => ids.includes(g._id));
    
    // Optimistic Update
    setGroups(prev => prev.filter(g => !ids.includes(g._id)));
    setSelected(new Set());
    setPendingBulk(false);

    startBulkTransition(async () => {
      let ok = 0;
      let failed = false;
      for (const id of ids) {
        const res = await deletePermissionGroup(id);
        if (res.success) {
          ok += 1;
        } else {
          failed = true;
        }
      }
      
      if (failed) {
        toast({ title: 'Some deletions failed, refreshing...', variant: 'destructive' });
        // Instead of exact revert, rely on server action revalidatePath or full refresh
      } else {
        toast({ title: `${ok} group${ok === 1 ? '' : 's'} deleted` });
      }
      await refresh();
    });
  }, [selected, groups, toast, refresh, setGroups]);

  /* ── CSV/PDF export ────────────────────────────────────────────────────────── */

  const handleExport = React.useCallback(() => {
    const src = selected.size > 0 ? filtered.filter((g) => selected.has(g._id)) : filtered;
    if (!src.length) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    downloadCsv(
      `permission-groups-${dateStamp()}.csv`,
      CSV_HEADERS,
      csvRows(src),
    );
    toast({ title: `Exported ${src.length} rows to CSV` });
  }, [filtered, selected, toast]);
  
  const handleExportPdf = React.useCallback(() => {
    const src = selected.size > 0 ? filtered.filter((g) => selected.has(g._id)) : filtered;
    if (!src.length) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    
    const doc = new jsPDF();
    doc.text('Permission Groups', 14, 15);
    
    const tableData = src.map(g => [
      g.name,
      g.description ?? '',
      String(moduleCount(g)),
      g.createdAt.slice(0, 10),
      g.updatedAt.slice(0, 10)
    ]);
    
    autoTable(doc, {
      head: [CSV_HEADERS],
      body: tableData,
      startY: 20,
    });
    
    doc.save(`permission-groups-${dateStamp()}.pdf`);
    toast({ title: `Exported ${src.length} rows to PDF` });
  }, [filtered, selected, toast]);

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-[var(--st-text)]">
              Permission Groups
            </h1>
            <p className="text-[13px] text-[var(--st-text-secondary)]">
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
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <NewGroupSheet onCreated={() => void refresh()} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={String(k.value)} />
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-2">
          <div className="flex items-center gap-2">
            <Badge variant="default">{selected.size} selected</Badge>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[12px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <FileDown className="h-3.5 w-3.5 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              PDF
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPendingBulk(true)}
              disabled={bulkDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {selected.size}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Input
          type="number"
          placeholder="Min modules (e.g. 2)"
          value={minModules}
          onChange={(e) => setMinModules(e.target.value === '' ? '' : Number(e.target.value))}
          className="max-w-[150px]"
        />
        <select
          value={hasEmployees}
          onChange={(e) => setHasEmployees(e.target.value)}
          className="h-9 rounded-md border border-[var(--st-border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--st-text)]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="all">All Assignments</option>
          <option value="yes">Has Employees</option>
          <option value="no">No Employees</option>
        </select>
        {(search || minModules !== '' || hasEmployees !== 'all') && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { setSearch(''); setMinModules(''); setHasEmployees('all'); }}
            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="p-0">
        <div 
          ref={parentRef}
          className="overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] max-h-[600px]"
        >
          <Table className="relative">
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Select all"
                  />
                </Th>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th className="text-center">Modules</Th>
                <Th className="text-center">Employees</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>

            <TBody 
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {filtered.length === 0
                  ? (
                    <Tr>
                      <Td
                        colSpan={6}
                        className="h-28 text-center text-[13px] text-[var(--st-text-secondary)]"
                      >
                        {search || minModules !== ''
                          ? 'No groups match your search.'
                          : 'No permission groups yet. Create one to get started.'}
                      </Td>
                    </Tr>
                  )
                  : rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const g = filtered[virtualItem.index];
                    const empCount = assignments.filter(
                      (a) => a.groupId === g._id,
                    ).length;
                    return (
                      <Tr 
                        key={g._id} 
                        className="border-[var(--st-border)] absolute top-0 left-0 w-full"
                        style={{
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <Td>
                          <Checkbox
                            checked={selected.has(g._id)}
                            onCheckedChange={() => toggleOne(g._id)}
                            aria-label={`Select ${g.name}`}
                          />
                        </Td>
                        <Td className="font-medium text-[var(--st-text)]">
                          <Link
                            href={`/dashboard/hrm/permission-groups/${g._id}`}
                            className="hover:underline"
                          >
                            {g.name}
                          </Link>
                        </Td>
                        <Td className="text-[13px] text-[var(--st-text-secondary)]">
                          {g.description ?? '—'}
                        </Td>
                        <Td className="text-center text-[13px]">
                          <Badge variant="secondary">
                            {moduleCount(g)}
                          </Badge>
                        </Td>
                        <Td className="text-center text-[13px]">
                          {empCount > 0 ? (
                            <Badge variant="default">{empCount}</Badge>
                          ) : (
                            <span className="text-[var(--st-text-secondary)]">0</span>
                          )}
                        </Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                href={`/dashboard/hrm/permission-groups/${g._id}`}
                                aria-label="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Delete"
                              onClick={() => setPendingDelete(g)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
            </TBody>
          </Table>
        </div>
      </Card>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete permission group?"
        description={pendingDelete
          ? `Deleting "${pendingDelete.name}" will also remove all employee assignments for this group. This cannot be undone.`
          : 'This action cannot be undone.'}
        onConfirm={handleDeleteOne}
        isDeleting={deleting}
      />

      <ConfirmDeleteDialog
        open={pendingBulk}
        onOpenChange={(o) => !o && setPendingBulk(false)}
        title={`Delete ${selected.size} group${selected.size === 1 ? '' : 's'}?`}
        description="All selected groups and their employee assignments will be permanently removed."
        onConfirm={handleBulkDelete}
        isDeleting={bulkDeleting}
      />
    </div>
  );
}
