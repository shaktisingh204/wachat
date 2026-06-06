'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Textarea,
  useZoruToast,
  type ZoruBadgeProps,
} from '@/components/sabcrm/20ui/compat';
import {
  Calendar,
  Check,
  ChevronDown,
  Flag,
  Loader,
  Plus,
  Search,
  Trash2,
  UserPlus,
  } from 'lucide-react';

import * as React from 'react';

import {
    createTeamTask,
    deleteTeamTask,
    getAssignableTeamMembers,
    getTeamTasks,
    updateTeamTask,
    updateTeamTaskStatus,
    type TeamTaskView,
} from '@/app/actions/team-tasks.actions';
import { useCan, useProject } from '@/context/project-context';
import type { TeamTask } from '@/lib/definitions';

type Status = TeamTask['status'];
type Priority = TeamTask['priority'];

const STATUSES: Status[] = ['To-Do', 'In Progress', 'Completed'];

type Assignee = { _id: string; name: string; email: string };

export default function TeamTasksPage() {
    const { toast } = useZoruToast();
    const { activeProjectId, sessionUser } = useProject();
    const canCreate = useCan('team_tasks', 'create');
    const canEdit = useCan('team_tasks', 'edit');
    const canDelete = useCan('team_tasks', 'delete');

    const [tasks, setTasks] = React.useState<TeamTaskView[]>([]);
    const [assignees, setAssignees] = React.useState<Assignee[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [assigneeFilter, setAssigneeFilter] = React.useState('all');
    const [priorityFilter, setPriorityFilter] = React.useState<'all' | Priority>('all');

    const fetchAll = React.useCallback(async () => {
        setLoading(true);
        const [t, a] = await Promise.all([
            getTeamTasks(undefined, activeProjectId || undefined),
            getAssignableTeamMembers(activeProjectId || null),
        ]);
        setTasks(t);
        setAssignees(a);
        setLoading(false);
    }, [activeProjectId]);

    React.useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const visible = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        return tasks.filter((t) => {
            if (q && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) return false;
            if (assigneeFilter !== 'all') {
                if (assigneeFilter === '__unassigned') {
                    if (t.assignedTo) return false;
                } else if (t.assignedTo?.toString() !== assigneeFilter) {
                    return false;
                }
            }
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
            return true;
        });
    }, [tasks, query, assigneeFilter, priorityFilter]);

    const byStatus = React.useMemo(() => {
        const map: Record<Status, TeamTaskView[]> = {
            'To-Do': [],
            'In Progress': [],
            Completed: [],
        };
        for (const t of visible) map[t.status].push(t);
        return map;
    }, [visible]);

    const onMove = React.useCallback(
        (taskId: string, next: Status) => {
            setTasks((prev) => prev.map((t) => (t._id.toString() === taskId ? { ...t, status: next } : t)));
            (async () => {
                const res = await updateTeamTaskStatus(taskId, next);
                if (!res.success) {
                    toast({ title: 'Move failed', description: res.error, variant: 'destructive' });
                    fetchAll();
                }
            })();
        },
        [toast, fetchAll],
    );

    const onDelete = React.useCallback(
        (taskId: string) => {
            (async () => {
                const res = await deleteTeamTask(taskId);
                if (res.success) {
                    setTasks((prev) => prev.filter((t) => t._id.toString() !== taskId));
                    toast({ title: 'Task deleted' });
                } else {
                    toast({ title: 'Error', description: res.error, variant: 'destructive' });
                }
            })();
        },
        [toast],
    );

    const onReassign = React.useCallback(
        (taskId: string, assignedTo: string | null) => {
            (async () => {
                const res = await updateTeamTask(taskId, { assignedTo: assignedTo as any });
                if (res.success) {
                    fetchAll();
                } else {
                    toast({ title: 'Error', description: res.error, variant: 'destructive' });
                }
            })();
        },
        [fetchAll, toast],
    );

    const meId = sessionUser?._id;
    const myTaskCount = tasks.filter((t) => t.assignedTo?.toString() === meId).length;
    const overdueCount = tasks.filter(
        (t) => t.dueDate && t.status !== 'Completed' && new Date(t.dueDate as any).getTime() < Date.now(),
    ).length;

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/team/manage-users">Team</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Tasks</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Team tasks</ZoruPageTitle>
                    <ZoruPageDescription>
                        Plan work, assign it to teammates, and track what&apos;s in flight.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                {canCreate ? (
                    <CreateTaskDialog
                        open={createOpen}
                        onOpenChange={setCreateOpen}
                        assignees={assignees}
                        projectId={activeProjectId}
                        onCreated={() => {
                            setCreateOpen(false);
                            fetchAll();
                        }}
                        toast={toast}
                    />
                ) : null}
            </PageHeader>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Total" value={tasks.length} />
                <StatTile label="Assigned to me" value={myTaskCount} />
                <StatTile label="In progress" value={byStatus['In Progress'].length} />
                <StatTile label="Overdue" value={overdueCount} tone={overdueCount > 0 ? 'red' : 'neutral'} />
            </div>

            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                    <Input
                        className="max-w-[300px] flex-1"
                        leadingSlot={<Search className="h-3.5 w-3.5" strokeWidth={2} />}
                        placeholder="Search tasks"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="w-[180px]">
                        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All assignees</ZoruSelectItem>
                                <ZoruSelectItem value="__unassigned">Unassigned</ZoruSelectItem>
                                {assignees.map((a) => (
                                    <ZoruSelectItem key={a._id} value={a._id}>
                                        {a.name}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="w-[140px]">
                        <Select
                            value={priorityFilter}
                            onValueChange={(v) => setPriorityFilter(v as 'all' | Priority)}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All priorities</ZoruSelectItem>
                                <ZoruSelectItem value="High">High</ZoruSelectItem>
                                <ZoruSelectItem value="Medium">Medium</ZoruSelectItem>
                                <ZoruSelectItem value="Low">Low</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            {loading ? (
                <KanbanSkeleton />
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {STATUSES.map((status) => (
                        <Column
                            key={status}
                            status={status}
                            tasks={byStatus[status]}
                            assignees={assignees}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            meId={meId}
                            onMove={onMove}
                            onReassign={onReassign}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────── STATS ─────────────────────────────────── */

function StatTile({
    label,
    value,
    tone = 'neutral',
}: {
    label: string;
    value: number;
    tone?: 'red' | 'neutral';
}) {
    return (
        <Card className="flex items-center gap-3 p-4">
            <div>
                <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--st-text-secondary)]">{label}</div>
                <div className="flex items-center gap-2">
                    <div className="text-[22px] tracking-[-0.01em] text-[var(--st-text)]">{value}</div>
                    {tone === 'red' && value > 0 ? <Badge variant="danger">Attention</Badge> : null}
                </div>
            </div>
        </Card>
    );
}

/* ─────────────────────────────────────── COLUMN ────────────────────────────────── */

function Column({
    status,
    tasks,
    assignees,
    canEdit,
    canDelete,
    meId,
    onMove,
    onReassign,
    onDelete,
}: {
    status: Status;
    tasks: TeamTaskView[];
    assignees: Assignee[];
    canEdit: boolean;
    canDelete: boolean;
    meId?: string;
    onMove: (id: string, to: Status) => void;
    onReassign: (id: string, assignee: string | null) => void;
    onDelete: (id: string) => void;
}) {
    const [dropActive, setDropActive] = React.useState(false);
    const variant: Record<Status, NonNullable<ZoruBadgeProps['variant']>> = {
        'To-Do': 'ghost',
        'In Progress': 'warning',
        Completed: 'success',
    };

    return (
        <div
            onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
                setDropActive(false);
                if (!canEdit) return;
                const taskId = e.dataTransfer.getData('text/taskId');
                if (taskId) onMove(taskId, status);
            }}
            className={
                'flex min-h-[300px] flex-col gap-3 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)] p-4 transition-colors ' +
                (dropActive ? 'border-[var(--st-text)] bg-[var(--st-bg-muted)]/40' : '')
            }
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Badge variant={variant[status]}>{status}</Badge>
                    <span className="text-[12px] text-[var(--st-text-secondary)]">{tasks.length}</span>
                </div>
            </div>

            {tasks.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--st-border)] p-6 text-[12.5px] text-[var(--st-text-secondary)]">
                    Drop tasks here
                </div>
            ) : (
                tasks.map((t) => (
                    <TaskCard
                        key={t._id.toString()}
                        task={t}
                        assignees={assignees}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        meId={meId}
                        onMove={onMove}
                        onReassign={onReassign}
                        onDelete={onDelete}
                    />
                ))
            )}
        </div>
    );
}

/* ─────────────────────────────────────── CARD ──────────────────────────────────── */

function TaskCard({
    task,
    assignees,
    canEdit,
    canDelete,
    meId,
    onMove,
    onReassign,
    onDelete,
}: {
    task: TeamTaskView;
    assignees: Assignee[];
    canEdit: boolean;
    canDelete: boolean;
    meId?: string;
    onMove: (id: string, to: Status) => void;
    onReassign: (id: string, a: string | null) => void;
    onDelete: (id: string) => void;
}) {
    const id = task._id.toString();
    const priorityVariant: Record<Priority, NonNullable<ZoruBadgeProps['variant']>> = {
        High: 'danger',
        Medium: 'warning',
        Low: 'info',
    };

    const due = task.dueDate ? new Date(task.dueDate as any) : null;
    const overdue = due && task.status !== 'Completed' && due.getTime() < Date.now();
    const isMine = meId && task.assignedTo?.toString() === meId;

    return (
        <div
            draggable={canEdit}
            onDragStart={(e) => {
                e.dataTransfer.setData('text/taskId', id);
                e.dataTransfer.effectAllowed = 'move';
            }}
            className="flex flex-col gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] p-3 shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] leading-snug text-[var(--st-text)]">{task.title}</div>
                    {task.description ? (
                        <div className="mt-0.5 line-clamp-2 text-[12px] text-[var(--st-text-secondary)]">{task.description}</div>
                    ) : null}
                </div>
                {canDelete ? (
                    <button
                        type="button"
                        onClick={() => onDelete(id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--st-text-secondary)] hover:bg-[var(--st-danger)]/10 hover:text-[var(--st-danger)]"
                        aria-label="Delete task"
                    >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={priorityVariant[task.priority]}>
                    <Flag className="h-3 w-3" strokeWidth={2} />
                    {task.priority}
                </Badge>
                {due ? (
                    <Badge variant={overdue ? 'danger' : 'ghost'}>
                        <Calendar className="h-3 w-3" strokeWidth={2} />
                        {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Badge>
                ) : null}
                {isMine ? <Badge variant="secondary">You</Badge> : null}
            </div>

            <div className="flex items-center justify-between gap-2">
                <AssigneeChip
                    task={task}
                    assignees={assignees}
                    canEdit={canEdit}
                    onReassign={(v) => onReassign(id, v)}
                />
                {canEdit ? <StatusMenu status={task.status} onMove={(to) => onMove(id, to)} /> : null}
            </div>
        </div>
    );
}

function AssigneeChip({
    task,
    assignees,
    canEdit,
    onReassign,
}: {
    task: TeamTaskView;
    assignees: Assignee[];
    canEdit: boolean;
    onReassign: (v: string | null) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const name = task.assigneeName || task.assigneeEmail || 'Unassigned';
    const initial = name.charAt(0).toUpperCase();
    const chip = (
        <span
            className={
                'inline-flex items-center gap-1.5 rounded-full border px-2 h-6 text-[11.5px] ' +
                (task.assignedTo
                    ? 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                    : 'border-dashed border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)]')
            }
        >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[9px] text-[var(--st-text)]">
                {task.assignedTo ? initial : '?'}
            </span>
            <span className="max-w-[120px] truncate">{name}</span>
        </span>
    );
    if (!canEdit) return chip;
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <button type="button" className="outline-none hover:opacity-90">
                    {chip}
                </button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="max-w-sm">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Assign task</ZoruDialogTitle>
                </ZoruDialogHeader>
                <div className="mt-3 flex max-h-[280px] flex-col gap-1 overflow-auto">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onReassign(null);
                        }}
                        className="flex items-center justify-between rounded-md px-2 py-2 text-left text-[13px] hover:bg-[var(--st-bg-muted)]"
                    >
                        <span className="text-[var(--st-text-secondary)]">Unassign</span>
                        {!task.assignedTo ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                    {assignees.map((a) => {
                        const active = task.assignedTo?.toString() === a._id;
                        return (
                            <button
                                key={a._id}
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    onReassign(a._id);
                                }}
                                className={
                                    'flex items-center justify-between rounded-md px-2 py-2 text-left text-[13px] hover:bg-[var(--st-bg-muted)] ' +
                                    (active ? 'bg-[var(--st-bg-muted)]/60' : '')
                                }
                            >
                                <span className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[10px] text-[var(--st-text)]">
                                        {a.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span>
                                        <span className="block text-[var(--st-text)]">{a.name}</span>
                                        <span className="block text-[11px] text-[var(--st-text-secondary)]">{a.email}</span>
                                    </span>
                                </span>
                                {active ? <Check className="h-3.5 w-3.5 text-[var(--st-text)]" /> : null}
                            </button>
                        );
                    })}
                </div>
            </ZoruDialogContent>
        </Dialog>
    );
}

function StatusMenu({ status, onMove }: { status: Status; onMove: (s: Status) => void }) {
    const [open, setOpen] = React.useState(false);
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-6 items-center gap-1 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 text-[11.5px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                >
                    Move <ChevronDown className="h-3 w-3" />
                </button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="max-w-xs">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Move to</ZoruDialogTitle>
                </ZoruDialogHeader>
                <div className="flex flex-col gap-1">
                    {STATUSES.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onMove(s);
                            }}
                            className={
                                'flex items-center justify-between rounded-md px-2 py-2 text-left text-[13px] hover:bg-[var(--st-bg-muted)] ' +
                                (s === status ? 'bg-[var(--st-bg-muted)]/60' : '')
                            }
                        >
                            <span>{s}</span>
                            {s === status ? <Check className="h-3.5 w-3.5 text-[var(--st-text)]" /> : null}
                        </button>
                    ))}
                </div>
            </ZoruDialogContent>
        </Dialog>
    );
}

/* ─────────────────────────────────── CREATE DIALOG ─────────────────────────────── */

function CreateTaskDialog({
    open,
    onOpenChange,
    assignees,
    projectId,
    onCreated,
    toast,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    assignees: Assignee[];
    projectId: string | null;
    onCreated: () => void;
    toast: ReturnType<typeof useZoruToast>['toast'];
}) {
    const [pending, setPending] = React.useState(false);
    const [priority, setPriority] = React.useState<Priority>('Medium');
    const [assignedTo, setAssignedTo] = React.useState<string>('');

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        if (projectId) fd.set('projectId', projectId);
        fd.set('priority', priority);
        fd.set('assignedTo', assignedTo);
        setPending(true);
        (async () => {
            const res = await createTeamTask(null, fd);
            setPending(false);
            if (res.message) {
                toast({ title: 'Task created' });
                form.reset();
                setPriority('Medium');
                setAssignedTo('');
                onCreated();
            } else {
                toast({ title: 'Could not create', description: res.error, variant: 'destructive' });
            }
        })();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogTrigger asChild>
                <Button size="md">
                    <Plus className="h-3.5 w-3.5" />
                    New task
                </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="max-w-md">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>New task</ZoruDialogTitle>
                </ZoruDialogHeader>
                <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-4">
                    <Field label="Title">
                        <Input name="title" required placeholder="Follow up with onboarding leads" />
                    </Field>
                    <Field label="Description (optional)">
                        <Textarea
                            name="description"
                            rows={3}
                            placeholder="Details, links, acceptance criteria…"
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Priority">
                            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="High">High</ZoruSelectItem>
                                    <ZoruSelectItem value="Medium">Medium</ZoruSelectItem>
                                    <ZoruSelectItem value="Low">Low</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        <Field label="Due date">
                            <Input name="dueDate" type="date" />
                        </Field>
                    </div>
                    <Field label="Assign to">
                        <Select value={assignedTo || '__none'} onValueChange={(v) => setAssignedTo(v === '__none' ? '' : v)}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Unassigned" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="__none">Unassigned</ZoruSelectItem>
                                {assignees.map((a) => (
                                    <ZoruSelectItem key={a._id} value={a._id}>
                                        {a.name} ({a.email})
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </Field>
                    <div className="mt-2 flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" size="md" disabled={pending}>
                            {pending ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                            Create task
                        </Button>
                    </div>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--st-text-secondary)]">{label}</label>
            {children}
        </div>
    );
}

function KanbanSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATUSES.map((s) => (
                <div key={s} className="flex h-[280px] flex-col gap-3 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)] p-4">
                    <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--st-bg-muted)]" />
                    <div className="h-16 animate-pulse rounded-lg bg-[var(--st-bg-muted)]" />
                    <div className="h-16 animate-pulse rounded-lg bg-[var(--st-bg-muted)]" />
                </div>
            ))}
        </div>
    );
}
