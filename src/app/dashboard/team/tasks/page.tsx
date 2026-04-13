'use client';

import * as React from 'react';
import {
    LuCalendar,
    LuCheck,
    LuChevronDown,
    LuFlag,
    LuLoader,
    LuPlus,
    LuSearch,
    LuTrash2,
    LuUserPlus,
} from 'react-icons/lu';

import { ClayBadge } from '@/components/clay/clay-badge';
import { ClayBreadcrumbs } from '@/components/clay/clay-breadcrumbs';
import { ClayButton } from '@/components/clay/clay-button';
import { ClayCard } from '@/components/clay/clay-card';
import { ClayInput, ClaySelect } from '@/components/clay/clay-input';
import { ClaySectionHeader } from '@/components/clay/clay-section-header';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
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
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'SabNode', href: '/home' },
                    { label: 'Team', href: '/dashboard/team/manage-users' },
                    { label: 'Tasks' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Team tasks"
                subtitle="Plan work, assign it to teammates, and track what's in flight."
                actions={
                    canCreate ? (
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
                    ) : null
                }
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Total" value={tasks.length} />
                <StatTile label="Assigned to me" value={myTaskCount} />
                <StatTile label="In progress" value={byStatus['In Progress'].length} />
                <StatTile label="Overdue" value={overdueCount} tone={overdueCount > 0 ? 'red' : 'neutral'} />
            </div>

            <ClayCard padded={false} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                    <ClayInput
                        sizeVariant="md"
                        className="max-w-[300px] flex-1"
                        leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                        placeholder="Search tasks"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <ClaySelect
                        sizeVariant="md"
                        className="w-[180px]"
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                        options={[
                            { value: 'all', label: 'All assignees' },
                            { value: '__unassigned', label: 'Unassigned' },
                            ...assignees.map((a) => ({ value: a._id, label: a.name })),
                        ]}
                    />
                    <ClaySelect
                        sizeVariant="md"
                        className="w-[140px]"
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value as any)}
                        options={[
                            { value: 'all', label: 'All priorities' },
                            { value: 'High', label: 'High' },
                            { value: 'Medium', label: 'Medium' },
                            { value: 'Low', label: 'Low' },
                        ]}
                    />
                </div>
            </ClayCard>

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
        <ClayCard padded={false} className="flex items-center gap-3 p-4">
            <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-clay-ink-soft">{label}</div>
                <div className="flex items-center gap-2">
                    <div className="text-[22px] font-semibold tracking-[-0.01em] text-clay-ink">{value}</div>
                    {tone === 'red' && value > 0 ? <ClayBadge tone="red" dot>Attention</ClayBadge> : null}
                </div>
            </div>
        </ClayCard>
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
    const tone: Record<Status, React.ComponentProps<typeof ClayBadge>['tone']> = {
        'To-Do': 'neutral',
        'In Progress': 'amber',
        Completed: 'green',
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
                'flex min-h-[300px] flex-col gap-3 rounded-clay-lg border border-clay-border bg-clay-surface p-4 transition-colors ' +
                (dropActive ? 'border-clay-rose bg-clay-rose-soft/40' : '')
            }
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ClayBadge tone={tone[status]} dot>
                        {status}
                    </ClayBadge>
                    <span className="text-[12px] text-clay-ink-muted">{tasks.length}</span>
                </div>
            </div>

            {tasks.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-clay-md border border-dashed border-clay-border p-6 text-[12.5px] text-clay-ink-soft">
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
    const priorityTone: Record<Priority, React.ComponentProps<typeof ClayBadge>['tone']> = {
        High: 'red',
        Medium: 'amber',
        Low: 'blue',
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
            className="flex flex-col gap-2 rounded-clay-md border border-clay-border bg-clay-surface p-3 shadow-clay-xs transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-clay-float"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium leading-snug text-clay-ink">{task.title}</div>
                    {task.description ? (
                        <div className="mt-0.5 line-clamp-2 text-[12px] text-clay-ink-muted">{task.description}</div>
                    ) : null}
                </div>
                {canDelete ? (
                    <button
                        type="button"
                        onClick={() => onDelete(id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-clay-ink-soft hover:bg-clay-red-soft/60 hover:text-clay-red"
                        aria-label="Delete task"
                    >
                        <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                <ClayBadge tone={priorityTone[task.priority]} dot>
                    <LuFlag className="h-3 w-3" strokeWidth={2} />
                    {task.priority}
                </ClayBadge>
                {due ? (
                    <ClayBadge tone={overdue ? 'red' : 'neutral'}>
                        <LuCalendar className="h-3 w-3" strokeWidth={2} />
                        {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </ClayBadge>
                ) : null}
                {isMine ? <ClayBadge tone="rose-soft">You</ClayBadge> : null}
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
                    ? 'border-clay-border bg-clay-surface-2 text-clay-ink'
                    : 'border-dashed border-clay-border bg-clay-surface text-clay-ink-soft')
            }
        >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-clay-rose-soft text-[9px] font-semibold text-clay-rose-ink">
                {task.assignedTo ? initial : '?'}
            </span>
            <span className="max-w-[120px] truncate">{name}</span>
        </span>
    );
    if (!canEdit) return chip;
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button type="button" className="outline-none hover:opacity-90">
                    {chip}
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm border border-clay-border bg-clay-surface p-4 shadow-clay-pop">
                <DialogHeader>
                    <DialogTitle className="text-[15px] font-semibold text-clay-ink">Assign task</DialogTitle>
                </DialogHeader>
                <div className="mt-3 flex max-h-[280px] flex-col gap-1 overflow-auto">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onReassign(null);
                        }}
                        className="flex items-center justify-between rounded-clay-sm px-2 py-2 text-left text-[13px] hover:bg-clay-surface-2"
                    >
                        <span className="text-clay-ink-muted">Unassign</span>
                        {!task.assignedTo ? <LuCheck className="h-3.5 w-3.5" /> : null}
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
                                    'flex items-center justify-between rounded-clay-sm px-2 py-2 text-left text-[13px] hover:bg-clay-surface-2 ' +
                                    (active ? 'bg-clay-rose-soft/40' : '')
                                }
                            >
                                <span className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay-surface-2 text-[10px] font-semibold text-clay-ink">
                                        {a.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span>
                                        <span className="block text-clay-ink">{a.name}</span>
                                        <span className="block text-[11px] text-clay-ink-soft">{a.email}</span>
                                    </span>
                                </span>
                                {active ? <LuCheck className="h-3.5 w-3.5 text-clay-rose-ink" /> : null}
                            </button>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StatusMenu({ status, onMove }: { status: Status; onMove: (s: Status) => void }) {
    const [open, setOpen] = React.useState(false);
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-6 items-center gap-1 rounded-full border border-clay-border bg-clay-surface-2 px-2 text-[11.5px] text-clay-ink-muted hover:text-clay-ink"
                >
                    Move <LuChevronDown className="h-3 w-3" />
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-xs border border-clay-border bg-clay-surface p-3 shadow-clay-pop">
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
                                'flex items-center justify-between rounded-clay-sm px-2 py-2 text-left text-[13px] hover:bg-clay-surface-2 ' +
                                (s === status ? 'bg-clay-rose-soft/40' : '')
                            }
                        >
                            <span>{s}</span>
                            {s === status ? <LuCheck className="h-3.5 w-3.5 text-clay-rose-ink" /> : null}
                        </button>
                    ))}
                </div>
            </DialogContent>
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
    toast: ReturnType<typeof useToast>['toast'];
}) {
    const [pending, setPending] = React.useState(false);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        if (projectId) fd.set('projectId', projectId);
        setPending(true);
        (async () => {
            const res = await createTeamTask(null, fd);
            setPending(false);
            if (res.message) {
                toast({ title: 'Task created' });
                form.reset();
                onCreated();
            } else {
                toast({ title: 'Could not create', description: res.error, variant: 'destructive' });
            }
        })();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <ClayButton variant="obsidian" size="md" leading={<LuPlus className="h-3.5 w-3.5" strokeWidth={2.25} />}>
                    New task
                </ClayButton>
            </DialogTrigger>
            <DialogContent className="max-w-md overflow-hidden border border-clay-border bg-clay-surface p-0 shadow-clay-pop">
                <div className="h-[6px] w-full bg-clay-rose" />
                <div className="p-6">
                    <DialogHeader>
                        <DialogTitle className="text-[20px] font-semibold tracking-[-0.01em] text-clay-ink">
                            New task
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
                        <Field label="Title">
                            <ClayInput name="title" required placeholder="Follow up with onboarding leads" />
                        </Field>
                        <Field label="Description (optional)">
                            <textarea
                                name="description"
                                rows={3}
                                placeholder="Details, links, acceptance criteria…"
                                className="clay-input min-h-[80px] py-2 text-[13px]"
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Priority">
                                <ClaySelect
                                    name="priority"
                                    defaultValue="Medium"
                                    options={[
                                        { value: 'High', label: 'High' },
                                        { value: 'Medium', label: 'Medium' },
                                        { value: 'Low', label: 'Low' },
                                    ]}
                                />
                            </Field>
                            <Field label="Due date">
                                <ClayInput name="dueDate" type="date" />
                            </Field>
                        </div>
                        <Field label="Assign to">
                            <ClaySelect
                                name="assignedTo"
                                defaultValue=""
                                options={[
                                    { value: '', label: 'Unassigned' },
                                    ...assignees.map((a) => ({ value: a._id, label: `${a.name} (${a.email})` })),
                                ]}
                            />
                        </Field>
                        <div className="mt-2 flex justify-end gap-2">
                            <ClayButton type="button" variant="pill" size="md" onClick={() => onOpenChange(false)} disabled={pending}>
                                Cancel
                            </ClayButton>
                            <ClayButton
                                type="submit"
                                variant="obsidian"
                                size="md"
                                disabled={pending}
                                leading={
                                    pending ? (
                                        <LuLoader className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <LuUserPlus className="h-3.5 w-3.5" strokeWidth={2.25} />
                                    )
                                }
                            >
                                Create task
                            </ClayButton>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-clay-ink-soft">{label}</label>
            {children}
        </div>
    );
}

function KanbanSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATUSES.map((s) => (
                <div key={s} className="flex h-[280px] flex-col gap-3 rounded-clay-lg border border-clay-border bg-clay-surface p-4">
                    <div className="h-4 w-24 animate-pulse rounded-full bg-clay-surface-2" />
                    <div className="h-16 animate-pulse rounded-clay-md bg-clay-surface-2" />
                    <div className="h-16 animate-pulse rounded-clay-md bg-clay-surface-2" />
                </div>
            ))}
        </div>
    );
}
