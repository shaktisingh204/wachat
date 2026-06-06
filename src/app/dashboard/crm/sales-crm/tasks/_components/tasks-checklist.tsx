'use client';

import { Checkbox, useToast } from '@/components/sabcrm/20ui/compat';
/**
 * <TaskChecklist> — interactive checklist for the task detail page.
 *
 * Each checkbox click persists via `toggleCrmTaskChecklist`. Optimistic
 * state flips immediately; on server failure the local state reverts and
 * a toast surfaces the error.
 */

import * as React from 'react';

import { toggleCrmTaskChecklist } from '@/app/actions/crm-tasks.actions';

export interface ChecklistItem {
    label: string;
    done?: boolean;
}

interface TaskChecklistProps {
    taskId: string;
    items: ChecklistItem[];
}

export function TaskChecklist({ taskId, items: initialItems }: TaskChecklistProps) {
    const { toast } = useToast();
    const [items, setItems] = React.useState<ChecklistItem[]>(initialItems);

    const toggle = React.useCallback(
        async (index: number, next: boolean) => {
            const prev = items[index]?.done ?? false;
            setItems((arr) => {
                const copy = arr.slice();
                copy[index] = { ...copy[index], done: next };
                return copy;
            });
            const res = await toggleCrmTaskChecklist(taskId, index, next);
            if (!res.success) {
                setItems((arr) => {
                    const copy = arr.slice();
                    copy[index] = { ...copy[index], done: prev };
                    return copy;
                });
                toast({
                    title: 'Could not update checklist',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [items, taskId, toast],
    );

    if (items.length === 0) {
        return (
            <p className="text-sm text-[var(--st-text-secondary)]">
                No checklist items yet — add some from the Edit page.
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
                <li
                    key={`${item.label}-${i}`}
                    className="flex items-start gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-2"
                >
                    <Checkbox
                        aria-label={`Toggle ${item.label}`}
                        checked={!!item.done}
                        onCheckedChange={(c) => void toggle(i, c === true)}
                    />
                    <span
                        className={[
                            'text-sm',
                            item.done
                                ? 'text-[var(--st-text-secondary)] line-through'
                                : 'text-[var(--st-text)]',
                        ].join(' ')}
                    >
                        {item.label}
                    </span>
                </li>
            ))}
        </ul>
    );
}

export default TaskChecklist;
