'use client';

import { useTransition } from 'react';
import {
    Badge,
    Button,
    EmptyState,
    Table,
    ZoruTableHeader,
    ZoruTableBody,
    ZoruTableRow,
    ZoruTableHead,
    ZoruTableCell,
} from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui';
import type { PortalTask } from '@/app/actions/hrm-portal.actions';
import { markTaskComplete } from '@/app/actions/hrm-portal.actions';
import { CheckCircle2, ClipboardList } from 'lucide-react';

// ─── Priority badge helper ─────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: PortalTask['priority'] }) {
    const variant =
        priority === 'High'
            ? 'danger'
            : priority === 'Medium'
              ? 'warning'
              : 'secondary';
    return (
        <ZoruBadge variant={variant} className="text-[11px]">
            {priority}
        </ZoruBadge>
    );
}

function StatusBadge({ status }: { status: PortalTask['status'] }) {
    const variant =
        status === 'Completed'
            ? 'success'
            : status === 'In Progress'
              ? 'info'
              : 'secondary';
    return (
        <ZoruBadge variant={variant} className="text-[11px]">
            {status}
        </ZoruBadge>
    );
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

// ─── My Tasks (assigned to me) ────────────────────────────────────────────────

interface MyTasksTableProps {
    tasks: PortalTask[];
    onRefresh?: () => void;
}

export function MyTasksTable({ tasks, onRefresh }: MyTasksTableProps) {
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    function handleComplete(taskId: string, title: string) {
        startTransition(async () => {
            const result = await markTaskComplete(taskId);
            if (result.success) {
                toast({ title: 'Task completed', description: `"${title}" marked as complete.` });
                onRefresh?.();
            } else {
                toast({
                    title: 'Could not complete task',
                    description: result.error ?? 'Something went wrong.',
                    variant: 'destructive',
                });
            }
        });
    }

    if (tasks.length === 0) {
        return (
            <ZoruEmptyState
                icon={<ClipboardList className="h-7 w-7" />}
                title="All caught up"
                description="No open tasks are assigned to you right now."
            />
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="bg-zoru-surface-2">
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Title</ZoruTableHead>
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Assigned by</ZoruTableHead>
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Due</ZoruTableHead>
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Priority</ZoruTableHead>
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Status</ZoruTableHead>
                        <ZoruTableHead className="w-[120px]" />
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {tasks.map((task) => (
                        <ZoruTableRow key={task._id} className="hover:bg-zoru-surface-2/50 transition-colors">
                            <ZoruTableCell className="font-medium text-zoru-ink max-w-[220px]">
                                <span className="line-clamp-2 text-[13px]">{task.title}</span>
                            </ZoruTableCell>
                            <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                {task.createdByName ?? '—'}
                            </ZoruTableCell>
                            <ZoruTableCell className="text-[13px] text-zoru-ink-muted whitespace-nowrap">
                                {formatDate(task.dueDate)}
                            </ZoruTableCell>
                            <ZoruTableCell>
                                <PriorityBadge priority={task.priority} />
                            </ZoruTableCell>
                            <ZoruTableCell>
                                <StatusBadge status={task.status} />
                            </ZoruTableCell>
                            <ZoruTableCell>
                                <ZoruButton
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-[12px]"
                                    disabled={isPending}
                                    onClick={() => handleComplete(task._id, task.title)}
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Done
                                </ZoruButton>
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ))}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}

// ─── Tasks I Assigned (created by me) ────────────────────────────────────────

interface MyCreatedTasksTableProps {
    tasks: PortalTask[];
}

export function MyCreatedTasksTable({ tasks }: MyCreatedTasksTableProps) {
    if (tasks.length === 0) {
        return (
            <ZoruEmptyState
                icon={<ClipboardList className="h-7 w-7" />}
                title="No tasks assigned yet"
                description="Tasks you assign to your team members will appear here."
            />
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="bg-zoru-surface-2">
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Title</ZoruTableHead>
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Assignee</ZoruTableHead>
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Due</ZoruTableHead>
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Priority</ZoruTableHead>
                        <ZoruTableHead className="text-[12px] uppercase text-zoru-ink-muted">Status</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {tasks.map((task) => (
                        <ZoruTableRow key={task._id} className="hover:bg-zoru-surface-2/50 transition-colors">
                            <ZoruTableCell className="font-medium text-zoru-ink max-w-[220px]">
                                <span className="line-clamp-2 text-[13px]">{task.title}</span>
                            </ZoruTableCell>
                            <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                {task.assignedToName ?? '—'}
                            </ZoruTableCell>
                            <ZoruTableCell className="text-[13px] text-zoru-ink-muted whitespace-nowrap">
                                {formatDate(task.dueDate)}
                            </ZoruTableCell>
                            <ZoruTableCell>
                                <PriorityBadge priority={task.priority} />
                            </ZoruTableCell>
                            <ZoruTableCell>
                                <StatusBadge status={task.status} />
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ))}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}
