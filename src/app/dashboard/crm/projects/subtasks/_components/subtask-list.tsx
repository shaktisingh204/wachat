'use client';

import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState,
  useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
    CheckCircle2,
  Circle,
  LoaderCircle,
  Plus,
  Trash2,
  } from 'lucide-react';

/**
 * <SubtaskList> — reusable subtask rail.
 *
 * Drops into any parent entity detail page (task, project_task) to show
 * the parent's subtasks with inline status toggling. Reads via the
 * `getSubtasks` server action (scoped by `parentId` + `parentKind`) and
 * writes via `saveSubtask` / `deleteSubtask`.
 *
 * Designed to be lazy-loaded by the consumer when the rail tab is
 * activated — keeps the parent detail bundle slim.
 */

import * as React from 'react';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import {
    deleteSubtask,
    getSubtasks,
    saveSubtask,
} from '@/app/actions/crm-subtasks.actions';
import type {
    CrmSubtaskDoc,
    CrmSubtaskParentKind,
    CrmSubtaskStatus,
} from '@/lib/rust-client/crm-subtasks';

const STATUS_OPTIONS: Array<{ value: CrmSubtaskStatus; label: string }> = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
    { value: 'archived', label: 'Archived' },
];

function fmtDate(v: unknown): string {
    if (!v) return '';
    const d = new Date(v as string | Date);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export interface SubtaskListProps {
    parentId: string;
    parentKind: CrmSubtaskParentKind;
    /** Optional title. Defaults to "Subtasks". */
    title?: string;
    /** Hide the inline "Add subtask" form. */
    readOnly?: boolean;
    /** Max rows to render. Default 200. */
    limit?: number;
}

export function SubtaskList({
    parentId,
    parentKind,
    title = 'Subtasks',
    readOnly = false,
    limit = 200,
}: SubtaskListProps) {
    const { toast } = useToast();
    const [rows, setRows] = useState<CrmSubtaskDoc[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusPending, startStatusTransition] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const refresh = React.useCallback(async () => {
        if (!parentId) {
            setRows([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const res = await getSubtasks({
                parentId,
                parentKind,
                limit,
            });
            setRows(res.items ?? []);
        } catch {
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [parentId, parentKind, limit]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleToggle = (row: CrmSubtaskDoc) => {
        const next: CrmSubtaskStatus = row.status === 'done' ? 'todo' : 'done';
        startStatusTransition(async () => {
            const fd = new FormData();
            fd.set('subtaskId', row._id);
            fd.set('title', row.title);
            fd.set('parentId', row.parentId);
            fd.set('parentKind', row.parentKind);
            fd.set('status', next);
            if (row.description) fd.set('description', row.description);
            if (row.assigneeId) fd.set('assigneeId', row.assigneeId);
            if (row.dueDate) fd.set('dueDate', row.dueDate);
            if (row.order != null) fd.set('order', String(row.order));
            const res = await saveSubtask(undefined, fd);
            if (res.error) {
                toast({
                    title: 'Update failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            await refresh();
        });
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        const res = await deleteSubtask(id);
        setDeletingId(null);
        if (res.success) {
            toast({ title: 'Subtask deleted' });
            await refresh();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error ?? 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    const completedCount = rows.filter((r) => r.status === 'done').length;
    const totalCount = rows.length;

    return (
        <Card className="p-4">
            <header className="mb-3 flex items-center justify-between">
                <div>
                    <h3 className="text-[14px] font-semibold text-[var(--st-text)]">
                        {title}
                    </h3>
                    {totalCount > 0 ? (
                        <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
                            {completedCount} of {totalCount} complete
                        </p>
                    ) : null}
                </div>
            </header>

            {isLoading ? (
                <div className="flex items-center gap-2 py-4 text-[12px] text-[var(--st-text-secondary)]">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading subtasks…
                </div>
            ) : rows.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--st-border)] p-3 text-center text-[12px] text-[var(--st-text-secondary)]">
                    No subtasks yet.
                </p>
            ) : (
                <ul className="flex flex-col divide-y divide-[var(--st-border)]">
                    {rows.map((r) => {
                        const isDone = r.status === 'done';
                        return (
                            <li
                                key={r._id}
                                className="flex items-start gap-2 py-2"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleToggle(r)}
                                    aria-label={
                                        isDone ? 'Mark as todo' : 'Mark as done'
                                    }
                                    disabled={statusPending}
                                    className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--st-text-secondary)] hover:text-[var(--st-text)] disabled:opacity-50"
                                >
                                    {isDone ? (
                                        <CheckCircle2 className="h-4 w-4 text-[var(--st-status-ok)]" />
                                    ) : (
                                        <Circle className="h-4 w-4" />
                                    )}
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p
                                        className={[
                                            'truncate text-[13px]',
                                            isDone
                                                ? 'text-[var(--st-text-secondary)] line-through'
                                                : 'text-[var(--st-text)]',
                                        ].join(' ')}
                                    >
                                        {r.title}
                                    </p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
                                        <StatusPill
                                            label={r.status.replace(/_/g, ' ')}
                                            tone={statusToTone(r.status)}
                                        />
                                        {r.dueDate ? (
                                            <span>Due {fmtDate(r.dueDate)}</span>
                                        ) : null}
                                    </div>
                                </div>
                                {!readOnly ? (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(r._id)}
                                        disabled={deletingId === r._id}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-danger)] disabled:opacity-50"
                                        aria-label={`Delete ${r.title}`}
                                    >
                                        {deletingId === r._id ? (
                                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            )}

            {!readOnly ? (
                <AddSubtaskInline
                    parentId={parentId}
                    parentKind={parentKind}
                    onAdded={refresh}
                />
            ) : null}
        </Card>
    );
}

/* ─── Inline add form ─────────────────────────────────────────────────── */

interface AddSubtaskInlineProps {
    parentId: string;
    parentKind: CrmSubtaskParentKind;
    onAdded: () => Promise<void> | void;
}

function AddSubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
                <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add
        </Button>
    );
}

function AddSubtaskInline({
    parentId,
    parentKind,
    onAdded,
}: AddSubtaskInlineProps) {
    const { toast } = useToast();
    const [expanded, setExpanded] = useState(false);
    const [state, formAction] = useActionState(saveSubtask, {});

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Subtask added' });
            void onAdded();
            setExpanded(false);
        }
        if (state?.error) {
            toast({
                title: 'Add failed',
                description: state.error,
                variant: 'destructive',
            });
        }
        // We only want to react to action-state changes; the toast/onAdded
        // identities are stable enough that re-firing is safe.
    }, [state, toast, onAdded]);

    if (!expanded) {
        return (
            <button
                type="button"
                onClick={() => setExpanded(true)}
                className="mt-3 flex w-full items-center gap-2 rounded-md border border-dashed border-[var(--st-border)] px-3 py-2 text-[12.5px] text-[var(--st-text-secondary)] hover:border-[var(--st-border)]/80 hover:text-[var(--st-text)]"
            >
                <Plus className="h-3.5 w-3.5" /> Add subtask
            </button>
        );
    }

    return (
        <form
            action={formAction}
            className="mt-3 flex flex-col gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2"
        >
            <input type="hidden" name="parentId" value={parentId} />
            <input type="hidden" name="parentKind" value={parentKind} />
            <div>
                <Label htmlFor="subtask-title" className="sr-only">
                    Title
                </Label>
                <Input
                    id="subtask-title"
                    name="title"
                    placeholder="Subtask title"
                    autoFocus
                    required
                />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Input
                    name="dueDate"
                    type="date"
                    aria-label="Due date"
                    className="h-9 text-[12.5px]"
                />
                <Select name="status" defaultValue="todo">
                    <SelectTrigger className="h-9 text-[12.5px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Textarea
                name="description"
                rows={2}
                placeholder="Description (optional)"
                className="text-[12.5px]"
            />
            <div className="flex items-center justify-end gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(false)}
                >
                    Cancel
                </Button>
                <AddSubmitButton />
            </div>
        </form>
    );
}

export default SubtaskList;
