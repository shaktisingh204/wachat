'use client';

import {
    Badge,
    Button,
    Card,
    Checkbox,
    Input,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Skeleton,
    StatCard,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    Clock,
    Download,
    ListChecks,
    Pencil,
    Search,
    Trash2,
    X,
} from 'lucide-react';

/**
 * Tasks list — `/dashboard/crm/tasks`.
 *
 * Full-featured client page: KPI strip, filters (status · priority ·
 * linked-kind · due-date range), bulk complete / delete, CSV export,
 * and per-row edit link.
 *
 * Data: fetched once on mount then re-fetched on mutation. Server
 * action `getCrmTasks` accepts filter params; `bulkCrmTaskAction`
 * handles bulk mutations.
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { AssignedToMeToggle } from '@/components/crm/assigned-to-me-toggle';
import { CreateTaskDialog } from '@/components/zoruui-domain/crm-create-task-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import { useT } from '@/lib/i18n/client';

import {
    bulkCrmTaskAction,
    getCrmTaskKpis,
    getCrmTasks,
    type CrmTaskKpis,
} from '@/app/actions/crm-tasks.actions';
import type { WithId, CrmTask } from '@/lib/definitions';

const TASKS_PER_PAGE = 20;

type StatusFilter = 'all' | 'To-Do' | 'In Progress' | 'Completed';
type PriorityFilter = 'all' | 'Low' | 'Medium' | 'High';

const STATUS_OPTIONS: StatusFilter[] = ['all', 'To-Do', 'In Progress', 'Completed'];
const PRIORITY_OPTIONS: PriorityFilter[] = ['all', 'Low', 'Medium', 'High'];

const EMPTY_KPIS: CrmTaskKpis = {
    total: 0,
    open: 0,
    overdue: 0,
    dueToday: 0,
    completedThisWeek: 0,
};

function priorityVariant(
    p: string | undefined | null,
): 'danger' | 'warning' | 'info' {
    if (p === 'High') return 'danger';
    if (p === 'Medium') return 'warning';
    return 'info';
}

function fmtDate(v: string | Date | undefined | null): string {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function isOverdue(task: WithId<CrmTask>): boolean {
    if (task.status === 'Completed') return false;
    if (!task.dueDate) return false;
    return new Date(task.dueDate as unknown as string).getTime() < Date.now();
}

function TasksPageSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                ))}
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

export default function TasksPage() {
    const { toast } = useZoruToast();
    const { t } = useT();

    /* ─── List state ────────────────────────────────────────── */
    const [tasks, setTasks] = React.useState<WithId<CrmTask>[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [kpis, setKpis] = React.useState<CrmTaskKpis>(EMPTY_KPIS);
    const [isLoading, startTransition] = React.useTransition();

    /* ─── Filters ────────────────────────────────────────────── */
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>('all');
    const [dueFrom, setDueFrom] = React.useState('');
    const [dueTo, setDueTo] = React.useState('');

    /* ─── Selection ──────────────────────────────────────────── */
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    /* ─── "Assigned to me" filter ────────────────────────────── */
    const [myEmployeeId, setMyEmployeeId] = React.useState<string | null>(null);

    const hasActiveFilters =
        !!search.trim() ||
        statusFilter !== 'all' ||
        priorityFilter !== 'all' ||
        !!dueFrom ||
        !!dueTo ||
        !!myEmployeeId;

    /* Filter the loaded page client-side when "assigned to me" is on.
     * (Acceptable per spec: no extra query.) */
    const visibleTasks = React.useMemo(() => {
        if (!myEmployeeId) return tasks;
        return tasks.filter(
            (t) => String((t as { assignedTo?: unknown }).assignedTo ?? '') === myEmployeeId,
        );
    }, [tasks, myEmployeeId]);

    /* ─── Fetch ──────────────────────────────────────────────── */
    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [pageRes, kpiRes] = await Promise.all([
                getCrmTasks(page, TASKS_PER_PAGE, search || undefined, {
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                    priority:
                        priorityFilter !== 'all' ? priorityFilter : undefined,
                    dueAfter: dueFrom || undefined,
                    dueBefore: dueTo || undefined,
                }),
                getCrmTaskKpis(),
            ]);
            setTasks(pageRes.tasks);
            setTotal(pageRes.total);
            setKpis(kpiRes);
        });
    }, [page, search, statusFilter, priorityFilter, dueFrom, dueTo]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((v: string) => {
        setSearch(v);
        setPage(1);
    }, 300);

    const clearFilters = React.useCallback(() => {
        setSearch('');
        setStatusFilter('all');
        setPriorityFilter('all');
        setDueFrom('');
        setDueTo('');
        setPage(1);
    }, []);

    /* ─── Selection helpers ──────────────────────────────────── */
    const headChecked =
        tasks.length > 0 && tasks.every((t) => selected.has(t._id.toString()));

    const toggleAll = (all: boolean) =>
        setSelected(
            all ? new Set(tasks.map((t) => t._id.toString())) : new Set(),
        );

    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    /* ─── Bulk actions ───────────────────────────────────────── */
    const runBulk = React.useCallback(
        async (op: 'complete' | 'delete') => {
            if (selected.size === 0) return;
            const ids = Array.from(selected);
            const res = await bulkCrmTaskAction(ids, op);
            if (res.success) {
                toast({
                    title: `${res.processed} task${res.processed === 1 ? '' : 's'} ${op === 'complete' ? 'completed' : 'deleted'}`,
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

    /* ─── Export ─────────────────────────────────────────────── */
    const exportCsv = React.useCallback(() => {
        const subset =
            selected.size > 0
                ? tasks.filter((t) => selected.has(t._id.toString()))
                : tasks;
        const headers = [
            'Title',
            'Status',
            'Priority',
            'Due date',
            'Type',
            'Created at',
        ];
        const rows = subset.map((task) => ({
            Title: task.title,
            Status: task.status ?? '',
            Priority: task.priority ?? '',
            'Due date': task.dueDate
                ? new Date(task.dueDate as unknown as string).toISOString()
                : '',
            Type: task.type ?? '',
            'Created at': task.createdAt
                ? new Date(task.createdAt as unknown as string).toISOString()
                : '',
        }));
        downloadCsv(`tasks-${dateStamp()}.csv`, headers, rows);
    }, [tasks, selected]);

    const totalPages = Math.max(1, Math.ceil(total / TASKS_PER_PAGE));

    if (isLoading && tasks.length === 0) return <TasksPageSkeleton />;

    return (
        <EntityListShell
            title={t('crm.tasks.list.title')}
            subtitle={t('crm.tasks.list.subtitle')}
            search={{
                value: search,
                onChange: handleSearch,
                placeholder: 'Search tasks…',
            }}
            primaryAction={<CreateTaskDialog onTaskCreated={fetchData} />}
            filters={
                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={statusFilter}
                        onValueChange={(v) => {
                            setStatusFilter(v as StatusFilter);
                            setPage(1);
                        }}
                    >
                        <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                            <ZoruSelectValue placeholder="Status" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {STATUS_OPTIONS.map((s) => (
                                <ZoruSelectItem key={s} value={s}>
                                    {s === 'all' ? 'All statuses' : s}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>

                    <Select
                        value={priorityFilter}
                        onValueChange={(v) => {
                            setPriorityFilter(v as PriorityFilter);
                            setPage(1);
                        }}
                    >
                        <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
                            <ZoruSelectValue placeholder="Priority" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {PRIORITY_OPTIONS.map((p) => (
                                <ZoruSelectItem key={p} value={p}>
                                    {p === 'all' ? 'All priorities' : p}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>

                    <Input
                        type="date"
                        value={dueFrom}
                        onChange={(e) => {
                            setDueFrom(e.target.value);
                            setPage(1);
                        }}
                        className="h-9 w-[150px] text-[13px]"
                        aria-label="Due from"
                    />
                    <Input
                        type="date"
                        value={dueTo}
                        onChange={(e) => {
                            setDueTo(e.target.value);
                            setPage(1);
                        }}
                        className="h-9 w-[150px] text-[13px]"
                        aria-label="Due to"
                    />

                    <AssignedToMeToggle
                        onToggle={(id) => {
                            setMyEmployeeId(id);
                            setPage(1);
                        }}
                        count={visibleTasks.length}
                    />

                    {hasActiveFilters ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                        >
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </Button>
                    ) : null}
                </div>
            }
            bulkBar={
                selected.size > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
                            <Badge variant="info">
                                {selected.size} selected
                            </Badge>
                            <button
                                type="button"
                                onClick={() => setSelected(new Set())}
                                className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void runBulk('complete')}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Mark
                                complete
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={exportCsv}
                            >
                                <Download className="h-3.5 w-3.5" /> Export CSV
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void runBulk('delete')}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                        </div>
                    </div>
                ) : null
            }
            loading={isLoading && tasks.length === 0}
            pagination={
                tasks.length > 0 ? (
                    <PaginationBar
                        page={page}
                        limit={TASKS_PER_PAGE}
                        hasMore={page < totalPages}
                        total={total}
                        controlled={{ onChange: (next) => setPage(next.page) }}
                    />
                ) : null
            }
        >
            <div className="flex flex-col gap-4">
                {/* KPI strip */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <StatCard
                        label="Total tasks"
                        value={kpis.total.toLocaleString()}
                        icon={<ListChecks className="h-4 w-4" />}
                    />
                    <StatCard
                        label="Open"
                        value={kpis.open.toLocaleString()}
                        icon={<Clock className="h-4 w-4" />}
                    />
                    <StatCard
                        label="Overdue"
                        value={kpis.overdue.toLocaleString()}
                        icon={<AlertCircle className="h-4 w-4" />}
                    />
                    <StatCard
                        label="Completed this week"
                        value={kpis.completedThisWeek.toLocaleString()}
                        icon={<CalendarClock className="h-4 w-4" />}
                    />
                </div>

                {/* Table */}
                <Card className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                                    <ZoruTableHead className="w-8">
                                        <Checkbox
                                            checked={headChecked}
                                            onCheckedChange={(c) =>
                                                toggleAll(Boolean(c))
                                            }
                                            aria-label="Select all tasks"
                                        />
                                    </ZoruTableHead>
                                    <ZoruTableHead>Title</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead>Priority</ZoruTableHead>
                                    <ZoruTableHead>Due date</ZoruTableHead>
                                    <ZoruTableHead>Type</ZoruTableHead>
                                    <ZoruTableHead className="text-right">
                                        Actions
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <ZoruTableRow
                                            key={i}
                                            className="border-[var(--st-border)]"
                                        >
                                            <ZoruTableCell colSpan={7}>
                                                <Skeleton className="h-10 w-full" />
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : visibleTasks.length === 0 ? (
                                    <ZoruTableRow className="border-[var(--st-border)]">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                                        >
                                            {hasActiveFilters
                                                ? 'No tasks match these filters.'
                                                : 'No tasks yet. Create one to start tracking work.'}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    visibleTasks.map((task) => {
                                        const id = task._id.toString();
                                        const overdue = isOverdue(task);
                                        return (
                                            <ZoruTableRow
                                                key={id}
                                                className="border-[var(--st-border)]"
                                            >
                                                <ZoruTableCell>
                                                    <Checkbox
                                                        checked={selected.has(
                                                            id,
                                                        )}
                                                        onCheckedChange={() =>
                                                            toggleOne(id)
                                                        }
                                                        aria-label={`Select ${task.title}`}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/sales-crm/tasks/${id}`}
                                                        label={task.title}
                                                        subtitle={
                                                            task.description
                                                                ? task.description.slice(
                                                                      0,
                                                                      60,
                                                                  )
                                                                : undefined
                                                        }
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge
                                                        variant={
                                                            task.status ===
                                                            'Completed'
                                                                ? 'success'
                                                                : task.status ===
                                                                    'In Progress'
                                                                  ? 'warning'
                                                                  : 'outline'
                                                        }
                                                    >
                                                        {task.status ?? 'To-Do'}
                                                    </Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    {task.priority ? (
                                                        <Badge
                                                            variant={priorityVariant(
                                                                task.priority,
                                                            )}
                                                        >
                                                            {task.priority}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                                                            —
                                                        </span>
                                                    )}
                                                </ZoruTableCell>
                                                <ZoruTableCell
                                                    className={
                                                        overdue
                                                            ? 'text-[13px] font-medium text-[var(--st-danger)]'
                                                            : 'text-[13px] text-[var(--st-text)]'
                                                    }
                                                >
                                                    {fmtDate(
                                                        task.dueDate as unknown as string,
                                                    )}
                                                    {overdue ? (
                                                        <span className="ml-1 text-[11px]">
                                                            overdue
                                                        </span>
                                                    ) : null}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                                                    {task.type || '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`/dashboard/crm/sales-crm/tasks/${id}/edit`}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Link>
                                                    </Button>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </EntityListShell>
    );
}
