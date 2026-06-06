'use client';

import { Button, StatCard, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import {
    AlarmClock,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  LayoutGrid,
  List,
  ListChecks,
  Plus,
  } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

/**
 * Tasks — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (clickable filter cards)
 *     • Filter row (status · priority · type · assignee · linked-kind · due range)
 *     • View switcher (Table / Kanban / Calendar)
 *     • Bulk action bar when rows are selected
 *     • <TasksTable> / <TasksKanban> / <TasksCalendar>
 *     • Pagination
 */

import * as React from 'react';
import Link from 'next/link';

import {
    bulkCrmTaskAction,
    completeCrmTask,
    deleteCrmTask,
    getCrmTaskKpis,
    getCrmTasks,
    snoozeCrmTask,
    type CrmTaskKpis,
    type CrmTaskListFilters,
    type TaskLinkedKind,
} from '@/app/actions/crm-tasks.actions';
import type { CrmTask } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { TasksTable } from './_components/tasks-table';
import { TasksKanban } from './_components/tasks-kanban';
import { TasksCalendar } from './_components/tasks-calendar';
import {
    TasksBulkBar,
    TasksFiltersRow,
    type TaskPriorityFilter,
    type TaskStatusFilter,
    type TaskTypeFilter,
} from './_components/tasks-filters';

type ViewMode = 'table' | 'kanban' | 'calendar';

const TASKS_PER_PAGE = 20;
const EMPTY_KPIS: CrmTaskKpis = {
    total: 0,
    open: 0,
    overdue: 0,
    dueToday: 0,
    completedThisWeek: 0,
};

export default function CrmTasksPage() {
    const router = useRouter();
    const { toast } = useZoruToast();

    // List state
    const [tasks, setTasks] = React.useState<WithId<CrmTask>[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<CrmTaskKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<TaskStatusFilter>('all');
    const [priorityFilter, setPriorityFilter] = React.useState<TaskPriorityFilter>('');
    const [typeFilter, setTypeFilter] = React.useState<TaskTypeFilter>('');
    const [assigneeFilter, setAssigneeFilter] = React.useState('');
    const [linkedKindFilter, setLinkedKindFilter] = React.useState<TaskLinkedKind | ''>('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

    // View + selection
    const [view, setView] = React.useState<ViewMode>('table');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const filters: CrmTaskListFilters = React.useMemo(() => {
        const f: CrmTaskListFilters = {};
        if (statusFilter !== 'all') f.status = statusFilter;
        if (priorityFilter) f.priority = priorityFilter;
        if (typeFilter) f.type = typeFilter;
        if (assigneeFilter) f.assignedTo = assigneeFilter;
        if (linkedKindFilter) f.linkedKind = linkedKindFilter;
        if (dateRange?.from) f.dueAfter = dateRange.from;
        if (dateRange?.to) f.dueBefore = dateRange.to;
        return f;
    }, [
        statusFilter,
        priorityFilter,
        typeFilter,
        assigneeFilter,
        linkedKindFilter,
        dateRange,
    ]);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [list, kpiData] = await Promise.all([
                getCrmTasks(page, TASKS_PER_PAGE, search, filters),
                getCrmTaskKpis(),
            ]);
            setTasks(list.tasks);
            setTotal(list.total);
            setKpis(kpiData ?? EMPTY_KPIS);
        });
    }, [page, search, filters]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setPriorityFilter('');
        setTypeFilter('');
        setAssigneeFilter('');
        setLinkedKindFilter('');
        setDateRange(undefined);
        setSearch('');
        setPage(1);
    }, []);

    const hasActiveFilters =
        statusFilter !== 'all' ||
        !!priorityFilter ||
        !!typeFilter ||
        !!assigneeFilter ||
        !!linkedKindFilter ||
        !!dateRange?.from ||
        !!dateRange?.to;

    // ─── Row actions ────────────────────────────────────────────────────
    const handleToggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleToggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(all ? new Set(tasks.map((t) => String(t._id))) : new Set());
        },
        [tasks],
    );

    const handleComplete = React.useCallback(
        async (id: string) => {
            const res = await completeCrmTask(id);
            if (res.success) {
                toast({ title: 'Task marked complete' });
                fetchData();
            } else {
                toast({
                    title: 'Could not complete',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [fetchData, toast],
    );

    const handleSnooze = React.useCallback(
        async (id: string, hours: number) => {
            const res = await snoozeCrmTask(id, hours);
            if (res.success) {
                toast({ title: `Task snoozed by ${hours}h` });
                fetchData();
            } else {
                toast({
                    title: 'Could not snooze',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [fetchData, toast],
    );

    const deleteTarget = React.useMemo(
        () => tasks.find((t) => String(t._id) === deleteTargetId) ?? null,
        [tasks, deleteTargetId],
    );

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmTask(deleteTargetId);
        if (res.success) {
            toast({ title: 'Task deleted' });
            fetchData();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, fetchData, toast]);

    // ─── Bulk actions ───────────────────────────────────────────────────
    const runBulk = React.useCallback(
        async (
            op: 'complete' | 'delete' | 'snooze_day' | 'snooze_week' | 'assign',
            payload?: string,
        ) => {
            if (selected.size === 0) return;
            const ids = Array.from(selected);
            const res = await bulkCrmTaskAction(ids, op, payload);
            if (res.success) {
                toast({
                    title: `${res.processed} task${res.processed === 1 ? '' : 's'} updated`,
                });
                setSelected(new Set());
                fetchData();
            } else {
                toast({
                    title: 'Bulk action failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [selected, fetchData, toast],
    );

    const exportCsv = React.useCallback(() => {
        const rows =
            selected.size > 0
                ? tasks.filter((t) => selected.has(String(t._id)))
                : tasks;
        const header = [
            'Title',
            'Type',
            'Priority',
            'Status',
            'Assignee',
            'Linked Kind',
            'Linked Id',
            'Due Date',
            'Created',
        ];
        const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...rows.map((t) =>
                [
                    escape(t.title),
                    escape(t.type),
                    escape(t.priority),
                    escape(t.status),
                    escape(t.assignedTo ?? ''),
                    escape((t as any).linkedKind ?? ''),
                    escape((t as any).linkedId ?? ''),
                    escape(t.dueDate ? new Date(t.dueDate).toISOString() : ''),
                    escape(t.createdAt ? new Date(t.createdAt).toISOString() : ''),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [tasks, selected]);

    const setFilterFromKpi = React.useCallback((next: TaskStatusFilter) => {
        setStatusFilter((prev) => (prev === next ? 'all' : next));
        setPage(1);
    }, []);

    const kpiCard = (
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
    );

    const totalPages = Math.max(1, Math.ceil(total / TASKS_PER_PAGE));

    return (
        <>
            <EntityListShell
                title="Tasks"
                subtitle="Calls, meetings, follow-ups, and to-dos across your CRM."
                viewSwitcher={
                    <div className="inline-flex rounded-md border border-zoru-line p-0.5">
                        <button
                            type="button"
                            onClick={() => setView('table')}
                            aria-pressed={view === 'table'}
                            className={[
                                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                view === 'table'
                                    ? 'bg-zoru-surface text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:text-zoru-ink',
                            ].join(' ')}
                        >
                            <List className="h-3.5 w-3.5" /> Table
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('kanban')}
                            aria-pressed={view === 'kanban'}
                            className={[
                                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                view === 'kanban'
                                    ? 'bg-zoru-surface text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:text-zoru-ink',
                            ].join(' ')}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('calendar')}
                            aria-pressed={view === 'calendar'}
                            className={[
                                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
                                view === 'calendar'
                                    ? 'bg-zoru-surface text-zoru-ink'
                                    : 'text-zoru-ink-muted hover:text-zoru-ink',
                            ].join(' ')}
                        >
                            <CalendarDays className="h-3.5 w-3.5" /> Calendar
                        </button>
                    </div>
                }
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search title or description…',
                }}
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/sales-crm/tasks/new">
                            <Plus className="h-4 w-4" /> New Task
                        </Link>
                    </Button>
                }
                filters={
                    <TasksFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        priorityFilter={priorityFilter}
                        onPriorityChange={(v) => {
                            setPriorityFilter(v);
                            setPage(1);
                        }}
                        typeFilter={typeFilter}
                        onTypeChange={(v) => {
                            setTypeFilter(v);
                            setPage(1);
                        }}
                        assigneeFilter={assigneeFilter}
                        onAssigneeChange={(v) => {
                            setAssigneeFilter(v);
                            setPage(1);
                        }}
                        linkedKindFilter={linkedKindFilter}
                        onLinkedKindChange={(v) => {
                            setLinkedKindFilter(v);
                            setPage(1);
                        }}
                        dateRange={dateRange}
                        onDateRangeChange={(r) => {
                            setDateRange(r);
                            setPage(1);
                        }}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <TasksBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onComplete={() => runBulk('complete')}
                            onSnoozeDay={() => runBulk('snooze_day')}
                            onSnoozeWeek={() => runBulk('snooze_week')}
                            onAssignTo={(userId) => runBulk('assign', userId)}
                            onDelete={() => setBulkDeleteOpen(true)}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && tasks.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <ListChecks className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No tasks yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Track calls, meetings, follow-ups, and to-dos linked to leads,
                                deals, clients, tickets, and invoices.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/sales-crm/tasks/new">
                                    <Plus className="h-4 w-4" /> Add your first task
                                </Link>
                            </Button>
                        </div>
                    ) : null
                }
                loading={isPending && tasks.length === 0}
                pagination={
                    tasks.length > 0 && view === 'table' ? (
                        <PaginationBar
                            page={page}
                            limit={TASKS_PER_PAGE}
                            hasMore={page < totalPages}
                            total={total}
                            controlled={{
                                onChange: (next) => setPage(next.page),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        {kpiCard(
                            'Total',
                            kpis.total.toLocaleString(),
                            <CheckSquare className="h-4 w-4" />,
                            statusFilter === 'all' && !hasActiveFilters,
                            () => clearFilters(),
                        )}
                        {kpiCard(
                            'Open',
                            kpis.open.toLocaleString(),
                            <ListChecks className="h-4 w-4" />,
                            statusFilter === 'To-Do',
                            () => setFilterFromKpi('To-Do'),
                        )}
                        {kpiCard(
                            'Overdue',
                            kpis.overdue.toLocaleString(),
                            <AlertTriangle className="h-4 w-4" />,
                            false,
                            () => {
                                setStatusFilter('To-Do');
                                setDateRange({ from: undefined, to: new Date() });
                                setPage(1);
                            },
                        )}
                        {kpiCard(
                            'Due today',
                            kpis.dueToday.toLocaleString(),
                            <AlarmClock className="h-4 w-4" />,
                            false,
                            () => {
                                const today = new Date();
                                const startOfToday = new Date(
                                    today.getFullYear(),
                                    today.getMonth(),
                                    today.getDate(),
                                );
                                const endOfToday = new Date(
                                    startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1,
                                );
                                setDateRange({ from: startOfToday, to: endOfToday });
                                setPage(1);
                            },
                        )}
                        {kpiCard(
                            'Completed (week)',
                            kpis.completedThisWeek.toLocaleString(),
                            <CheckCircle2 className="h-4 w-4" />,
                            statusFilter === 'Completed',
                            () => setFilterFromKpi('Completed'),
                        )}
                    </div>

                    {view === 'table' ? (
                        <TasksTable
                            tasks={tasks}
                            loading={isPending}
                            selectedIds={selected}
                            onToggleOne={handleToggleOne}
                            onToggleAll={handleToggleAll}
                            onComplete={handleComplete}
                            onSnooze={handleSnooze}
                            onDelete={(id) => setDeleteTargetId(id)}
                        />
                    ) : view === 'kanban' ? (
                        <TasksKanban tasks={tasks} />
                    ) : (
                        <TasksCalendar tasks={tasks} />
                    )}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this task permanently?"
                description={`This permanently removes "${
                    deleteTarget?.title ?? 'task'
                }". This action cannot be undone.`}
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Delete ${selected.size} task${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected tasks. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={async () => {
                    await runBulk('delete');
                    setBulkDeleteOpen(false);
                }}
            />
        </>
    );
}
