'use client';

import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/sabcrm/20ui/compat';
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
                <ZoruCardHeader>
                    <ZoruCardTitle>Owner</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-zoru-ink-muted">Assignee</span>
                        {task.assignedTo ? (
                            <EntityPickerChip
                                entity="user"
                                id={String(task.assignedTo)}
                                fallback="Unassigned"
                            />
                        ) : (
                            <span className="text-zoru-ink-muted">Unassigned</span>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-zoru-ink-muted">Created by</span>
                        {(task as any).createdBy ? (
                            <EntityPickerChip
                                entity="user"
                                id={String((task as any).createdBy)}
                            />
                        ) : (
                            <span className="text-zoru-ink-muted">—</span>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-zoru-ink-muted">Priority</span>
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
                        <span className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
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
                                            ? 'border-zoru-primary bg-zoru-primary/10 text-zoru-ink'
                                            : 'border-zoru-line text-zoru-ink-muted hover:text-zoru-ink',
                                    ].join(' ')}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            {linkedKey && linkedId ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Linked {linkedKindLabel}</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-2 text-sm">
                        <EntityPickerChip
                            entity={linkedKey}
                            id={linkedId}
                            fallback={`${linkedKind}:${linkedId.slice(-6)}`}
                        />
                        {linkedTargetHref ? (
                            <Link
                                href={linkedTargetHref}
                                className="inline-flex items-center gap-1 text-[12.5px] text-zoru-primary hover:underline"
                            >
                                Open {linkedKindLabel.toLowerCase()}{' '}
                                <ExternalLink className="h-3 w-3" />
                            </Link>
                        ) : null}
                    </ZoruCardContent>
                </Card>
            ) : null}

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Related tasks</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-2 text-sm">
                    {related.length === 0 ? (
                        <p className="text-zoru-ink-muted">
                            No other tasks on this entity yet.
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {related.map((r) => (
                                <li key={String(r._id)}>
                                    <Link
                                        href={`/dashboard/crm/sales-crm/tasks/${String(r._id)}`}
                                        className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-zoru-surface-2"
                                    >
                                        <span className="truncate text-zoru-ink">{r.title}</span>
                                        <StatusPill
                                            label={(r.status as string) || 'To-Do'}
                                            tone={statusToTone((r.status as string) || 'To-Do')}
                                        />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </ZoruCardContent>
            </Card>
        </>
    );
}

export default TaskDetailRail;
