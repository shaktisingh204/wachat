'use client';

import { Badge, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Skeleton, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
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
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { EntityKey } from '@/lib/lookup-registry';
import type { CrmTask } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import type { TaskLinkedKind } from '@/app/actions/crm-tasks.actions.types';

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
            return `/dashboard/sabdesk/${id}`;
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
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
                <THead>
                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                        <Th className="w-[36px]">
                            <Checkbox
                                aria-label="Select all tasks"
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </Th>
                        <Th>Task</Th>
                        <Th>Type</Th>
                        <Th>Linked to</Th>
                        <Th>Assignee</Th>
                        <Th>Priority</Th>
                        <Th>Status</Th>
                        <Th>Due</Th>
                        <Th>Created</Th>
                        <Th className="text-right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Tr key={i} className="border-[var(--st-border)]">
                                <Td colSpan={10}>
                                    <Skeleton className="h-10 w-full" />
                                </Td>
                            </Tr>
                        ))
                    ) : tasks.length === 0 ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                            >
                                No tasks match the current filters.
                            </Td>
                        </Tr>
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
                                <Tr
                                    key={id}
                                    className={[
                                        'border-[var(--st-border)] transition-colors',
                                        isOverdue ? 'border-l-2 border-l-zoru-danger' : '',
                                        isSel ? 'bg-[var(--st-bg-muted)]/70' : '',
                                        status === 'Completed' ? 'opacity-70' : '',
                                    ].join(' ')}
                                >
                                    <Td>
                                        <Checkbox
                                            aria-label={`Select task ${task.title}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </Td>
                                    <Td>
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales-crm/tasks/${id}`}
                                            label={
                                                <span className="flex items-center gap-2">
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                                        <CheckSquare className="h-3.5 w-3.5" />
                                                    </span>
                                                    <span className="block truncate text-[13px]">
                                                        {task.title || 'Untitled task'}
                                                    </span>
                                                </span>
                                            }
                                            subtitle={task.description || undefined}
                                        />
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                                        <Badge variant="secondary">
                                            {(task.type as string) || 'Follow-up'}
                                        </Badge>
                                    </Td>
                                    <Td>
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
                                            <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                                        )}
                                    </Td>
                                    <Td>
                                        {task.assignedTo ? (
                                            <EntityPickerChip
                                                entity="user"
                                                id={String(task.assignedTo)}
                                                fallback="Unassigned"
                                            />
                                        ) : (
                                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                                Unassigned
                                            </span>
                                        )}
                                    </Td>
                                    <Td>
                                        <StatusPill
                                            label={(task.priority as string) || 'Medium'}
                                            tone={priorityTone}
                                        />
                                    </Td>
                                    <Td>
                                        <StatusPill label={status} tone={statusToTone(status)} />
                                    </Td>
                                    <Td
                                        className={[
                                            'text-[12.5px]',
                                            isOverdue ? 'text-[var(--st-danger)]' : 'text-[var(--st-text)]',
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
                                            <span className="text-[var(--st-text-secondary)]">—</span>
                                        )}
                                    </Td>
                                    <Td
                                        className="text-[12.5px] text-[var(--st-text-secondary)]"
                                        title={task.createdAt ? new Date(task.createdAt).toLocaleString() : ''}
                                    >
                                        {task.createdAt
                                            ? formatDistanceToNow(new Date(task.createdAt), {
                                                  addSuffix: true,
                                              })
                                            : '—'}
                                    </Td>
                                    <Td className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${task.title}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/sales-crm/tasks/${id}`}>
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" /> View
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/sales-crm/tasks/${id}/edit`}>
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onComplete(id)}
                                                    disabled={status === 'Completed'}
                                                >
                                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark complete
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuLabel>Snooze</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => onSnooze(id, 1)}>
                                                    <Clock className="mr-1.5 h-3.5 w-3.5" /> +1 hour
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onSnooze(id, 24)}>
                                                    <Clock className="mr-1.5 h-3.5 w-3.5" /> +1 day
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onSnooze(id, 24 * 7)}>
                                                    <Clock className="mr-1.5 h-3.5 w-3.5" /> +1 week
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/sales-crm/tasks/${id}/edit`}
                                                        className="text-[var(--st-text-secondary)]"
                                                    >
                                                        <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Reassign
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onDelete(id)}
                                                    className="text-[var(--st-danger)]"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </Td>
                                </Tr>
                            );
                        })
                    )}
                </TBody>
            </Table>
        </div>
    );
}

export default TasksTable;
