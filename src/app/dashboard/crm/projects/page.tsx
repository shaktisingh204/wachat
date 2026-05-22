'use client';

import {
  Button,
  StatCard,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useDebouncedCallback } from 'use-debounce';
import {
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  LayoutGrid,
  List,
  GanttChart,
  Plus,
  } from 'lucide-react';

/**
 * Projects — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (5 clickable filter cards)
 *     • Filter row (status · priority · client · category · date range)
 *     • View switcher (Table / Kanban / Gantt)
 *     • <ProjectsTable> | <ProjectsKanban> | <ProjectsGantt>
 *
 * Detail page at /projects/[projectId] is preserved (already exists at
 * 1300+ lines). This file rebuilds only the list.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  getWsProjects,
  deleteWsProject,
  bulkArchiveProjects,
  bulkDeleteProjects,
} from '@/app/actions/worksuite/projects.actions';
import type { WsProject } from '@/lib/worksuite/project-types';

import {
  ProjectsTable,
  fmtMoney,
  isOverdue,
  type ProjectRow,
} from './_components/projects-table';
import { ProjectsKanban } from './_components/projects-kanban';
import { ProjectsGantt } from './_components/projects-gantt';

type ViewMode = 'table' | 'kanban' | 'gantt';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'not started', label: 'Not Started' },
  { value: 'in progress', label: 'In Progress' },
  { value: 'on hold', label: 'On Hold' },
  { value: 'finished', label: 'Finished' },
  { value: 'canceled', label: 'Canceled' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function ProjectsPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<ProjectRow[]>([]);
  const [loading, startLoading] = React.useTransition();

  // Filters
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [clientFilter, setClientFilter] = React.useState<string>('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('');

  // View + delete + bulk
  const [view, setView] = React.useState<ViewMode>('table');
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [bulkArchiveIds, setBulkArchiveIds] = React.useState<string[] | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = React.useState<string[] | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = (await getWsProjects()) as unknown as ProjectRow[];
        setRows(list ?? []);
      } catch (e) {
        toast({
          title: 'Failed to load projects',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearch = useDebouncedCallback((v: string) => setSearch(v), 300);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r: WsProject & { _id: string }) => {
      if (
        statusFilter !== 'all' &&
        (r.status || '').toLowerCase() !== statusFilter
      ) {
        return false;
      }
      if (
        priorityFilter !== 'all' &&
        (r.priority || '').toLowerCase() !== priorityFilter
      ) {
        return false;
      }
      if (clientFilter && String(r.clientId ?? '') !== clientFilter) return false;
      if (categoryFilter && String(r.categoryId ?? '') !== categoryFilter) return false;
      if (!q) return true;
      const hay = [
        r.name,
        r.projectName,
        r.projectShortCode,
        r.clientName,
        r.managerName,
        r.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter, priorityFilter, clientFilter, categoryFilter]);

  const kpis = React.useMemo(() => {
    const active = rows.filter((r) =>
      ['in progress', 'active'].includes((r.status || '').toLowerCase()),
    ).length;
    const completed = rows.filter((r) =>
      ['finished', 'completed'].includes((r.status || '').toLowerCase()),
    ).length;
    const atRisk = rows.filter(isOverdue).length;
    const billableHours = rows.reduce(
      (sum, r) => sum + (Number(r.hoursAllocated) || 0),
      0,
    );
    const totalBudget = rows.reduce(
      (sum, r) => sum + (Number(r.projectBudget ?? r.budget) || 0),
      0,
    );
    return { active, completed, atRisk, billableHours, totalBudget };
  }, [rows]);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    !!clientFilter ||
    !!categoryFilter;

  const clearFilters = React.useCallback(() => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setClientFilter('');
    setCategoryFilter('');
    setSearch('');
  }, []);

  const deleteTarget = React.useMemo(
    () => rows.find((r) => r._id === deleteTargetId) ?? null,
    [rows, deleteTargetId],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetId) return;
    const res = await deleteWsProject(deleteTargetId);
    if (res?.success) {
      toast({ title: 'Project deleted' });
      refresh();
    } else {
      toast({
        title: 'Delete failed',
        description: res?.error ?? 'Unknown error',
        variant: 'destructive',
      });
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, refresh, toast]);

  const handleBulkArchiveConfirm = React.useCallback(async () => {
    if (!bulkArchiveIds || bulkArchiveIds.length === 0) return;
    const res = await bulkArchiveProjects(bulkArchiveIds);
    if (res.error) {
      toast({ title: 'Bulk archive failed', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: `${res.updated} project${res.updated === 1 ? '' : 's'} archived` });
      refresh();
    }
    setBulkArchiveIds(null);
  }, [bulkArchiveIds, refresh, toast]);

  const handleBulkDeleteConfirm = React.useCallback(async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    const res = await bulkDeleteProjects(bulkDeleteIds);
    if (res.error) {
      toast({ title: 'Bulk delete failed', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: `${res.deleted} project${res.deleted === 1 ? '' : 's'} deleted` });
      refresh();
    }
    setBulkDeleteIds(null);
  }, [bulkDeleteIds, refresh, toast]);

  const KpiBtn = React.useCallback(
    (
      label: string,
      value: React.ReactNode,
      icon: React.ReactNode,
      active: boolean,
      onClick: () => void,
    ) => (
      <button
        type="button"
        onClick={onClick}
        className={[
          'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
          active ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]' : '',
        ].join(' ')}
      >
        <StatCard label={label} value={value} icon={icon} />
      </button>
    ),
    [],
  );

  const viewBtn = (mode: ViewMode, label: string, Icon: React.ElementType) => (
    <button
      key={mode}
      type="button"
      onClick={() => setView(mode)}
      aria-pressed={view === mode}
      className={[
        'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
        view === mode
          ? 'bg-zoru-surface text-zoru-ink'
          : 'text-zoru-ink-muted hover:text-zoru-ink',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <>
      <EntityListShell
        title="Projects"
        subtitle="Client projects, timelines, budgets, billable hours, and team delivery."
        viewSwitcher={
          <div className="inline-flex rounded-md border border-zoru-line p-0.5">
            {viewBtn('table', 'Table', List)}
            {viewBtn('kanban', 'Kanban', LayoutGrid)}
            {viewBtn('gantt', 'Gantt', GanttChart)}
          </div>
        }
        search={{
          value: search,
          onChange: handleSearch,
          placeholder: 'Search name, client, manager…',
        }}
        primaryAction={
          <Button asChild>
            <Link href="/dashboard/crm/projects/new">
              <Plus className="h-4 w-4" /> New project
            </Link>
          </Button>
        }
        filters={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                <ZoruSelectValue placeholder="Priority" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All priorities</ZoruSelectItem>
                {PRIORITY_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
            {/* TODO 1D.1: wire <EntityFormField> chips for client + category filters */}
            <input
              type="hidden"
              value={clientFilter}
              onChange={() => setClientFilter('')}
            />
            <input
              type="hidden"
              value={categoryFilter}
              onChange={() => setCategoryFilter('')}
            />
          </>
        }
        empty={
          !loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Briefcase className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">
                No projects yet
              </h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Spin up your first project to track tasks, milestones, billable
                hours, and team delivery.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/projects/new">
                  <Plus className="h-4 w-4" /> New project
                </Link>
              </Button>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {KpiBtn(
              'Active',
              kpis.active.toLocaleString(),
              <Clock className="h-4 w-4" />,
              statusFilter === 'in progress',
              () =>
                setStatusFilter((s) =>
                  s === 'in progress' ? 'all' : 'in progress',
                ),
            )}
            {KpiBtn(
              'Completed',
              kpis.completed.toLocaleString(),
              <CheckCircle2 className="h-4 w-4" />,
              statusFilter === 'finished',
              () =>
                setStatusFilter((s) => (s === 'finished' ? 'all' : 'finished')),
            )}
            {KpiBtn(
              'At risk',
              kpis.atRisk.toLocaleString(),
              <AlertTriangle className="h-4 w-4" />,
              false,
              () => undefined,
            )}
            {KpiBtn(
              'Billable hours',
              kpis.billableHours.toLocaleString(),
              <Clock className="h-4 w-4" />,
              false,
              () => undefined,
            )}
            {KpiBtn(
              'Total budget',
              fmtMoney(kpis.totalBudget, 'INR'),
              <DollarSign className="h-4 w-4" />,
              false,
              () => undefined,
            )}
          </div>

          {view === 'table' ? (
            <ProjectsTable
              rows={filtered}
              loading={loading}
              onDelete={(id) => setDeleteTargetId(id)}
              onBulkArchive={(ids) => setBulkArchiveIds(ids)}
              onBulkDelete={(ids) => setBulkDeleteIds(ids)}
            />
          ) : view === 'kanban' ? (
            <ProjectsKanban rows={filtered} />
          ) : (
            <ProjectsGantt rows={filtered} />
          )}
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this project?"
        description={`This permanently removes "${
          deleteTarget?.name ?? 'project'
        }" and may orphan tasks/milestones. This action cannot be undone.`}
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={!!bulkArchiveIds}
        onOpenChange={(o) => !o && setBulkArchiveIds(null)}
        title={`Archive ${bulkArchiveIds?.length ?? 0} project${(bulkArchiveIds?.length ?? 0) === 1 ? '' : 's'}?`}
        description="Archived projects are hidden from active views but can be restored."
        confirmLabel="Archive"
        onConfirm={handleBulkArchiveConfirm}
      />

      <ConfirmDialog
        open={!!bulkDeleteIds}
        onOpenChange={(o) => !o && setBulkDeleteIds(null)}
        title={`Delete ${bulkDeleteIds?.length ?? 0} project${(bulkDeleteIds?.length ?? 0) === 1 ? '' : 's'}?`}
        description="This permanently removes all selected projects and may orphan tasks and milestones. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDeleteConfirm}
      />
    </>
  );
}
