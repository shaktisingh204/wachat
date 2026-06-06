'use client';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { ExternalLink } from 'lucide-react';

/**
 * <TaskDetailRail> — right-rail content for the task detail page.
 *
 * Extracted to keep `[id]/page.tsx` under the 600-line scope cap.
 * Owns nothing — every interactive callback is supplied by the parent.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { EntityKey } from '@/lib/lookup-registry';
import type { CrmTask } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import type { TaskLinkedKind } from '@/app/actions/crm-tasks.actions.types';

const TASK_STATUSES = ['To-Do', 'In Progress', 'Completed'] as const;

interface TaskDetailRailProps {
    task: WithId<CrmTask>;
    related: WithId<CrmTask>[];
    linkedKind: TaskLinkedKind;
    linkedId?: string;
    linkedKey: EntityKey | null;
    linkedKindLabel: string;
    linkedTargetHref: string | null;
    onSetStatus: (s: CrmTask['status']) => void;
}

export function TaskDetailRail({
    task,
    related,
    linkedKind,
    linkedId,
    linkedKey,
    linkedKindLabel,
    linkedTargetHref,
    onSetStatus,
}: TaskDetailRailProps) {
    const status = (task.status as CrmTask['status']) || 'To-Do';
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Owner</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--st-text-secondary)]">Assignee</span>
                        {task.assignedTo ? (
                            <EntityPickerChip
                                entity="user"
                                id={String(task.assignedTo)}
                                fallback="Unassigned"
                            />
                        ) : (
                            <span className="text-[var(--st-text-secondary)]">Unassigned</span>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--st-text-secondary)]">Created by</span>
                        {(task as any).createdBy ? (
                            <EntityPickerChip
                                entity="user"
                                id={String((task as any).createdBy)}
                            />
                        ) : (
                            <span className="text-[var(--st-text-secondary)]">—</span>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--st-text-secondary)]">Priority</span>
                        <StatusPill
                            label={(task.priority as string) || 'Medium'}
                            tone={
                                task.priority === 'High'
                                    ? 'red'
                                    : task.priority === 'Medium'
                                    ? 'amber'
                                    : 'neutral'
                            }
                        />
                    </div>
                    <div className="space-y-1 pt-1">
                        <span className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                            Set status
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {TASK_STATUSES.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => onSetStatus(s)}
                                    aria-pressed={status === s}
                                    className={[
                                        'rounded-full border px-2 py-0.5 text-[11.5px]',
                                        status === s
                                            ? 'border-[var(--st-text)] bg-[var(--st-text)]/10 text-[var(--st-text)]'
                                            : 'border-[var(--st-border)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                                    ].join(' ')}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardBody>
            </Card>

            {linkedKey && linkedId ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Linked {linkedKindLabel}</CardTitle>
                    </CardHeader>
                    <CardBody className="space-y-2 text-sm">
                        <EntityPickerChip
                            entity={linkedKey}
                            id={linkedId}
                            fallback={`${linkedKind}:${linkedId.slice(-6)}`}
                        />
                        {linkedTargetHref ? (
                            <Link
                                href={linkedTargetHref}
                                className="inline-flex items-center gap-1 text-[12.5px] text-[var(--st-text)] hover:underline"
                            >
                                Open {linkedKindLabel.toLowerCase()}{' '}
                                <ExternalLink className="h-3 w-3" />
                            </Link>
                        ) : null}
                    </CardBody>
                </Card>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle>Related tasks</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2 text-sm">
                    {related.length === 0 ? (
                        <p className="text-[var(--st-text-secondary)]">
                            No other tasks on this entity yet.
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {related.map((r) => (
                                <li key={String(r._id)}>
                                    <Link
                                        href={`/dashboard/crm/sales-crm/tasks/${String(r._id)}`}
                                        className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-[var(--st-bg-muted)]"
                                    >
                                        <span className="truncate text-[var(--st-text)]">{r.title}</span>
                                        <StatusPill
                                            label={(r.status as string) || 'To-Do'}
                                            tone={statusToTone((r.status as string) || 'To-Do')}
                                        />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </>
    );
}

export default TaskDetailRail;
