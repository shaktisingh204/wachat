'use client';

import {
    Badge,
    type BadgeTone,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    Button,
    Card,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    EmptyState,
    Field,
    IconButton,
    Input,
    PageDescription,
    PageHeader,
    PageHeading,
    PageTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    StatCard,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    Calendar,
    ChevronDown,
    Flag,
    Inbox,
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
    const { toast } = useToast();
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
                    toast({ title: 'Move failed', description: res.error, tone: 'danger' });
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
                    toast.success('Task deleted');
                } else {
                    toast({ title: 'Error', description: res.error, tone: 'danger' });
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
                    toast({ title: 'Error', description: res.error, tone: 'danger' });
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
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/team/manage-users">Team</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Tasks</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <PageHeading>
                    <PageTitle>Team tasks</PageTitle>
                    <PageDescription>
                        Plan work, assign it to teammates, and track what&apos;s in flight.
                    </PageDescription>
                </PageHeading>
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
                <StatCard label="Total" value={tasks.length} />
                <StatCard label="Assigned to me" value={myTaskCount} />
                <StatCard label="In progress" value={byStatus['In Progress'].length} />
                <StatCard
                    label="Overdue"
                    value={overdueCount}
                    delta={overdueCount > 0 ? { value: 'Attention', tone: 'down' } : undefined}
                />
            </div>

            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                        className="max-w-[300px] flex-1"
                        iconLeft={Search}
                        placeholder="Search tasks"
                        aria-label="Search tasks"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="w-full sm:w-[180px]">
                        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                            <SelectTrigger aria-label="Filter by assignee">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All assignees</SelectItem>
                                <SelectItem value="__unassigned">Unassigned</SelectItem>
                                {assignees.map((a) => (
                                    <SelectItem key={a._id} value={a._id}>
                                        {a.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full sm:w-[140px]">
                        <Select
                            value={priorityFilter}
                            onValueChange={(v) => setPriorityFilter(v as 'all' | Priority)}
                        >
                            <SelectTrigger aria-label="Filter by priority">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All priorities</SelectItem>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                            </SelectContent>
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

/* ─────────────────────────────────────── COLUMN ────────────────────────────────── */

const STATUS_TONE: Record<Status, BadgeTone> = {
    'To-Do': 'neutral',
    'In Progress': 'warning',
    Completed: 'success',
};

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
                'flex min-h-[300px] flex-col gap-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4 transition-colors ' +
                (dropActive ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]' : '')
            }
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                    <span className="text-[12px] text-[var(--st-text-secondary)]">{tasks.length}</span>
                </div>
            </div>

            {tasks.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                    <EmptyState
                        size="sm"
                        icon={Inbox}
                        title="No tasks yet"
                        description="Drop tasks here"
                    />
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

const PRIORITY_TONE: Record<Priority, BadgeTone> = {
    High: 'danger',
    Medium: 'warning',
    Low: 'info',
};

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

    const due = task.dueDate ? new Date(task.dueDate as any) : null;
    const overdue = due && task.status !== 'Completed' && due.getTime() < Date.now();
    const isMine = meId && task.assignedTo?.toString() === meId;

    return (
        <Card
            variant="interactive"
            padding="sm"
            draggable={canEdit}
            onDragStart={(e) => {
                e.dataTransfer.setData('text/taskId', id);
                e.dataTransfer.effectAllowed = 'move';
            }}
            className="flex flex-col gap-2"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] leading-snug text-[var(--st-text)]">{task.title}</div>
                    {task.description ? (
                        <div className="mt-0.5 line-clamp-2 text-[12px] text-[var(--st-text-secondary)]">{task.description}</div>
                    ) : null}
                </div>
                {canDelete ? (
                    <IconButton
                        label="Delete task"
                        icon={Trash2}
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(id)}
                    />
                ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={PRIORITY_TONE[task.priority]}>
                    <Flag className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    {task.priority}
                </Badge>
                {due ? (
                    <Badge tone={overdue ? 'danger' : 'neutral'}>
                        <Calendar className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                        {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Badge>
                ) : null}
                {isMine ? <Badge tone="accent">You</Badge> : null}
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
        </Card>
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
    const name = task.assigneeName || task.assigneeEmail || 'Unassigned';
    const initial = name.charAt(0).toUpperCase();
    const current = task.assignedTo?.toString() ?? '__none';

    const chip = (
        <span
            className={
                'inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11.5px] ' +
                (task.assignedTo
                    ? 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]'
                    : 'border-dashed border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)]')
            }
        >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[9px] text-[var(--st-text)]">
                {task.assignedTo ? initial : '?'}
            </span>
            <span className="max-w-[120px] truncate">{name}</span>
        </span>
    );

    if (!canEdit) return chip;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto p-0">
                    {chip}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuLabel>Assign task</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                    value={current}
                    onValueChange={(v) => onReassign(v === '__none' ? null : v)}
                >
                    <DropdownMenuRadioItem value="__none">Unassign</DropdownMenuRadioItem>
                    {assignees.map((a) => (
                        <DropdownMenuRadioItem key={a._id} value={a._id}>
                            <span className="flex flex-col">
                                <span className="text-[var(--st-text)]">{a.name}</span>
                                <span className="text-[11px] text-[var(--st-text-secondary)]">{a.email}</span>
                            </span>
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function StatusMenu({ status, onMove }: { status: Status; onMove: (s: Status) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" iconRight={ChevronDown}>
                    Move
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={status} onValueChange={(v) => onMove(v as Status)}>
                    {STATUSES.map((s) => (
                        <DropdownMenuRadioItem key={s} value={s}>
                            {s}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
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
    toast: ReturnType<typeof useToast>['toast'];
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
                toast.success('Task created');
                form.reset();
                setPriority('Medium');
                setAssignedTo('');
                onCreated();
            } else {
                toast({ title: 'Could not create', description: res.error, tone: 'danger' });
            }
        })();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="primary" size="md" iconLeft={Plus}>
                    New task
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>New task</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-4">
                    <Field label="Title" required>
                        <Input name="title" required placeholder="Follow up with onboarding leads" />
                    </Field>
                    <Field label="Description (optional)">
                        <Textarea
                            name="description"
                            rows={3}
                            placeholder="Details, links, acceptance criteria."
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Priority">
                            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                                <SelectTrigger aria-label="Priority">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="Low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Due date">
                            <Input name="dueDate" type="date" />
                        </Field>
                    </div>
                    <Field label="Assign to">
                        <Select value={assignedTo || '__none'} onValueChange={(v) => setAssignedTo(v === '__none' ? '' : v)}>
                            <SelectTrigger aria-label="Assign to">
                                <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none">Unassigned</SelectItem>
                                {assignees.map((a) => (
                                    <SelectItem key={a._id} value={a._id}>
                                        {a.name} ({a.email})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" size="md" loading={pending} iconLeft={UserPlus}>
                            Create task
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function KanbanSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATUSES.map((s) => (
                <div key={s} className="flex h-[280px] flex-col gap-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4">
                    <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--st-bg-secondary)]" />
                    <div className="h-16 animate-pulse rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]" />
                    <div className="h-16 animate-pulse rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]" />
                </div>
            ))}
        </div>
    );
}
