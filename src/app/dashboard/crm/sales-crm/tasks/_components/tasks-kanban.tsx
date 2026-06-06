'use client';

import { Card } from '@/components/sabcrm/20ui';
import { CheckSquare, Clock } from 'lucide-react';

/**
 * <TasksKanban> — read-mostly board grouped by status.
 * Drag-to-reorder deferred (see TODO 1D.4 in CRM_REBUILD_PLAN).
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmTask } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface TasksKanbanProps {
    tasks: WithId<CrmTask>[];
}

const STATUS_COLUMNS: { key: string; label: string }[] = [
    { key: 'To-Do', label: 'To-Do' },
    { key: 'In Progress', label: 'In Progress' },
    { key: 'Completed', label: 'Completed' },
];

export function TasksKanban({ tasks }: TasksKanbanProps) {
    const grouped = React.useMemo(() => {
        const map = new Map<string, WithId<CrmTask>[]>();
        for (const col of STATUS_COLUMNS) map.set(col.key, []);
        for (const t of tasks) {
            const key = (t.status as string) || 'To-Do';
            const arr = map.get(key) ?? [];
            arr.push(t);
            map.set(key, arr);
        }
        return map;
    }, [tasks]);

    if (tasks.length === 0) {
        return (
            <Card className="flex min-h-[240px] items-center justify-center text-sm text-[var(--st-text-secondary)]">
                No tasks to plot on the board.
            </Card>
        );
    }

    const now = Date.now();
    return (
        <div className="flex gap-4 overflow-x-auto pb-2">
            {/* TODO 1D.4: drag-between-columns deferred — depends on a column-update server action wiring. */}
            {Array.from(grouped.entries()).map(([key, rows]) => (
                <div
                    key={key}
                    className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3"
                >
                    <header className="flex items-center justify-between">
                        <StatusPill label={key} tone={statusToTone(key)} />
                        <span className="text-[11.5px] text-[var(--st-text-secondary)]">{rows.length}</span>
                    </header>
                    <ol className="flex flex-col gap-2">
                        {rows.map((task) => {
                            const due = task.dueDate ? new Date(task.dueDate) : null;
                            const overdue =
                                key !== 'Completed' && due ? due.getTime() < now : false;
                            return (
                                <li key={String(task._id)}>
                                    <Link
                                        href={`/dashboard/crm/sales-crm/tasks/${String(task._id)}`}
                                        className={[
                                            'block rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-2.5 transition-colors hover:border-[var(--st-border-strong)]',
                                            overdue ? 'border-l-2 border-l-zoru-danger' : '',
                                        ].join(' ')}
                                    >
                                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--st-text)]">
                                            <CheckSquare className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                            <span className="line-clamp-1">
                                                {task.title || 'Untitled task'}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between text-[11.5px] text-[var(--st-text-secondary)]">
                                            <span>{(task.type as string) || 'Follow-up'}</span>
                                            {due ? (
                                                <span
                                                    className={[
                                                        'inline-flex items-center gap-1',
                                                        overdue ? 'text-[var(--st-danger)]' : '',
                                                    ].join(' ')}
                                                >
                                                    <Clock className="h-3 w-3" />
                                                    {due.toLocaleDateString()}
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                                            {(task.priority as string) || 'Medium'}
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                        {rows.length === 0 ? (
                            <li className="rounded-md border border-dashed border-[var(--st-border)] p-2 text-center text-[11.5px] text-[var(--st-text-secondary)]">
                                Empty
                            </li>
                        ) : null}
                    </ol>
                </div>
            ))}
        </div>
    );
}

export default TasksKanban;
