'use client';

import {
  ZoruBadge,
  ZoruCheckbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  formatDistanceToNow } from 'date-fns';
import {
    AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit,
  MoreHorizontal,
  Trash2,
  UserPlus,
  } from 'lucide-react';

/**
 * <TasksTable> — dense table for the tasks list view.
 *
 * Columns per §1D.1:
 *   select · title · type · linked entity (polymorphic chip) · assignee ·
 *   priority · status · due · created · actions.
 *
 * Overdue rows (status != Completed AND dueDate < now) get a subtle red
 * left-border treatment.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { EntityKey } from '@/lib/lookup-registry';
import type { CrmTask } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import type { TaskLinkedKind } from '@/app/actions/crm-tasks.actions';

interface TasksTableProps {
    tasks: WithId<CrmTask>[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onComplete: (id: string) => void;
    onSnooze: (id: string, hours: number) => void;
    onDelete: (id: string) => void;
}

const PRIORITY_TONE: Record<string, 'red' | 'amber' | 'neutral'> = {
    High: 'red',
    Medium: 'amber',
    Low: 'neutral',
};

function linkedEntityKey(kind: TaskLinkedKind | undefined): EntityKey | null {
    switch (kind) {
        case 'lead':
            return 'lead';
        case 'deal':
            return 'deal';
        case 'client':
            return 'client';
        case 'contact':
            return 'contact';
        case 'ticket':
            return 'ticketGroup';
        case 'invoice':
            return 'invoice';
        default:
            return null;
    }
}

function linkedHref(kind: TaskLinkedKind | undefined, id: string | undefined): string | null {
    if (!kind || !id) return null;
    switch (kind) {
        case 'lead':
            return `/dashboard/crm/sales-crm/all-leads/${id}`;
        case 'deal':
            return `/dashboard/crm/sales-crm/deals/${id}`;
        case 'client':
            return `/dashboard/crm/accounts/${id}`;
        case 'contact':
            return `/dashboard/crm/sales-crm/contacts/${id}`;
        case 'ticket':
            return `/dashboard/crm/tickets/${id}`;
        case 'invoice':
            return `/dashboard/crm/sales/invoices/${id}`;
        default:
            return null;
    }
}

export function TasksTable({
    tasks,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onComplete,
    onSnooze,
    onDelete,
}: TasksTableProps) {
    const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.has(String(t._id)));
    const someSelected = !allSelected && tasks.some((t) => selectedIds.has(String(t._id)));
    const now = Date.now();

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="w-[36px]">
                            <ZoruCheckbox
                                aria-label="Select all tasks"
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>Task</ZoruTableHead>
                        <ZoruTableHead>Type</ZoruTableHead>
                        <ZoruTableHead>Linked to</ZoruTableHead>
                        <ZoruTableHead>Assignee</ZoruTableHead>
                        <ZoruTableHead>Priority</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead>Due</ZoruTableHead>
                        <ZoruTableHead>Created</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <ZoruTableRow key={i} className="border-zoru-line">
                                <ZoruTableCell colSpan={10}>
                                    <ZoruSkeleton className="h-10 w-full" />
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ))
                    ) : tasks.length === 0 ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                No tasks match the current filters.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        tasks.map((task) => {
                            const id = String(task._id);
                            const status = (task.status as string) || 'To-Do';
                            const isSel = selectedIds.has(id);
                            const due = task.dueDate ? new Date(task.dueDate) : null;
                            const isOverdue =
                                status !== 'Completed' && due ? due.getTime() < now : false;
                            const priorityTone =
                                PRIORITY_TONE[(task.priority as string) || 'Medium'] ?? 'neutral';
                            const linkedKind = (task as any).linkedKind as
                                | TaskLinkedKind
                                | undefined;
                            const linkedId = (task as any).linkedId
                                ? String((task as any).linkedId)
                                : undefined;
                            const linkedKey = linkedEntityKey(linkedKind);
                            const linkedRowHref = linkedHref(linkedKind, linkedId);

                            return (
                                <ZoruTableRow
                                    key={id}
                                    className={[
                                        'border-zoru-line transition-colors',
                                        isOverdue ? 'border-l-2 border-l-zoru-danger' : '',
                                        isSel ? 'bg-zoru-surface-2/70' : '',
                                        status === 'Completed' ? 'opacity-70' : '',
                                    ].join(' ')}
                                >
                                    <ZoruTableCell>
                                        <ZoruCheckbox
                                            aria-label={`Select task ${task.title}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <Link
                                            href={`/dashboard/crm/sales-crm/tasks/${id}`}
                                            className="group flex items-center gap-2"
                                        >
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                                                <CheckSquare className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-[13px] font-medium text-zoru-ink group-hover:underline">
                                                    {task.title || 'Untitled task'}
                                                </span>
                                                {task.description ? (
                                                    <span className="block truncate text-[11.5px] text-zoru-ink-muted">
                                                        {task.description}
                                                    </span>
                                                ) : null}
                                            </span>
                                        </Link>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                        <ZoruBadge variant="secondary">
                                            {(task.type as string) || 'Follow-up'}
                                        </ZoruBadge>
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {linkedKey && linkedId ? (
                                            linkedRowHref ? (
                                                <Link
                                                    href={linkedRowHref}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-block hover:underline"
                                                >
                                                    <EntityPickerChip
                                                        entity={linkedKey}
                                                        id={linkedId}
                                                        fallback={`${linkedKind}:${linkedId.slice(-6)}`}
                                                    />
                                                </Link>
                                            ) : (
                                                <EntityPickerChip
                                                    entity={linkedKey}
                                                    id={linkedId}
                                                    fallback={`${linkedKind}:${linkedId.slice(-6)}`}
                                                />
                                            )
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {task.assignedTo ? (
                                            <EntityPickerChip
                                                entity="user"
                                                id={String(task.assignedTo)}
                                                fallback="Unassigned"
                                            />
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">
                                                Unassigned
                                            </span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill
                                            label={(task.priority as string) || 'Medium'}
                                            tone={priorityTone}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill label={status} tone={statusToTone(status)} />
                                    </ZoruTableCell>
                                    <ZoruTableCell
                                        className={[
                                            'text-[12.5px]',
                                            isOverdue ? 'text-zoru-danger' : 'text-zoru-ink',
                                        ].join(' ')}
                                        title={due ? due.toLocaleString() : ''}
                                    >
                                        {due ? (
                                            <span className="inline-flex items-center gap-1">
                                                {isOverdue ? (
                                                    <AlertTriangle className="h-3 w-3" />
                                                ) : null}
                                                {due.toLocaleDateString()}
                                            </span>
                                        ) : (
                                            <span className="text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell
                                        className="text-[12.5px] text-zoru-ink-muted"
                                        title={task.createdAt ? new Date(task.createdAt).toLocaleString() : ''}
                                    >
                                        {task.createdAt
                                            ? formatDistanceToNow(new Date(task.createdAt), {
                                                  addSuffix: true,
                                              })
                                            : '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruDropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${task.title}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/sales-crm/tasks/${id}`}>
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" /> View
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/sales-crm/tasks/${id}/edit`}>
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onComplete(id)}
                                                    disabled={status === 'Completed'}
                                                >
                                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark complete
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuLabel>Snooze</ZoruDropdownMenuLabel>
                                                <ZoruDropdownMenuItem onClick={() => onSnooze(id, 1)}>
                                                    <Clock className="mr-1.5 h-3.5 w-3.5" /> +1 hour
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem onClick={() => onSnooze(id, 24)}>
                                                    <Clock className="mr-1.5 h-3.5 w-3.5" /> +1 day
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem onClick={() => onSnooze(id, 24 * 7)}>
                                                    <Clock className="mr-1.5 h-3.5 w-3.5" /> +1 week
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/sales-crm/tasks/${id}/edit`}
                                                        className="text-zoru-ink-muted"
                                                    >
                                                        <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Reassign
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onDelete(id)}
                                                    className="text-zoru-danger"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                                                </ZoruDropdownMenuItem>
                                            </ZoruDropdownMenuContent>
                                        </ZoruDropdownMenu>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })
                    )}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}

export default TasksTable;
