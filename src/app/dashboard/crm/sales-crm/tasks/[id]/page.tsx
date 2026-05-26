'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Skeleton, useZoruToast } from '@/components/zoruui';
import {
  useParams,
  useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { CheckSquare } from 'lucide-react';

/**
 * Task detail page (§1D.2).
 *
 * Layout (per <EntityDetailShell>):
 *   • Header: status pill, back link, eyebrow, title, action group (8+ buttons).
 *   • Main column: Overview · Linked entity preview · Checklist · Attachments · Notes · Reminders.
 *   • Right rail: Assignee/creator · Priority · Linked entity · Related tasks.
 *   • Footer: <EntityAuditTimeline entityKind="task" entityId={id} />.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { statusToTone } from '@/components/crm/status-pill';
import type { EntityKey } from '@/lib/lookup-registry';

import {
    completeCrmTask,
    deleteCrmTask,
    getCrmTaskById,
    getCrmTasksByLinkedEntity,
    snoozeCrmTask,
    updateCrmTaskStatus,
    type TaskLinkedKind,
} from '@/app/actions/crm-tasks.actions';
import type { CrmTask } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { TaskDetailActions } from '../_components/tasks-detail-actions';
import { TaskChecklist, type ChecklistItem } from '../_components/tasks-checklist';
import { TaskDetailRail } from '../_components/tasks-detail-rail';

const LINKED_KIND_LABEL: Record<TaskLinkedKind, string> = {
    none: 'No link',
    lead: 'Lead',
    deal: 'Deal',
    client: 'Client',
    contact: 'Contact',
    ticket: 'Ticket',
    invoice: 'Invoice',
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

export default function TaskDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useZoruToast();

    const taskId = (params?.id as string) || '';

    const [task, setTask] = React.useState<WithId<CrmTask> | null>(null);
    const [related, setRelated] = React.useState<WithId<CrmTask>[]>([]);
    const [isPending, startTransition] = React.useTransition();
    const [completing, setCompleting] = React.useState(false);
    const [snoozing, setSnoozing] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [archiveOpen, setArchiveOpen] = React.useState(false);

    const refresh = React.useCallback(() => {
        if (!taskId) return;
        startTransition(async () => {
            const t = await getCrmTaskById(taskId);
            setTask(t);
            if (t && (t as any).linkedKind && (t as any).linkedId) {
                const rel = await getCrmTasksByLinkedEntity(
                    (t as any).linkedKind,
                    String((t as any).linkedId),
                    taskId,
                );
                setRelated(rel);
            } else {
                setRelated([]);
            }
        });
    }, [taskId]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const handleStatusChange = React.useCallback(
        async (next: CrmTask['status']) => {
            if (!taskId || !task || next === task.status) return;
            const res = await updateCrmTaskStatus(taskId, next);
            if (res.success) {
                toast({ title: `Status set to ${next}` });
                refresh();
            } else {
                toast({
                    title: 'Status change failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [taskId, task, refresh, toast],
    );

    const handleComplete = React.useCallback(async () => {
        if (!taskId) return;
        setCompleting(true);
        const res = await completeCrmTask(taskId);
        setCompleting(false);
        if (res.success) {
            toast({ title: 'Task completed' });
            refresh();
        } else {
            toast({
                title: 'Could not complete',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [taskId, refresh, toast]);

    const handleSnooze = React.useCallback(
        async (hours: number) => {
            if (!taskId) return;
            setSnoozing(true);
            const res = await snoozeCrmTask(taskId, hours);
            setSnoozing(false);
            if (res.success) {
                toast({ title: `Snoozed for ${hours}h` });
                refresh();
            } else {
                toast({
                    title: 'Could not snooze',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [taskId, refresh, toast],
    );

    const handleDelete = React.useCallback(async () => {
        if (!taskId) return;
        const res = await deleteCrmTask(taskId);
        if (res.success) {
            toast({ title: 'Task deleted' });
            router.push('/dashboard/crm/sales-crm/tasks');
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteOpen(false);
    }, [taskId, router, toast]);

    if (isPending && !task) {
        return (
            <div className="flex w-full flex-col gap-6">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-[500px] w-full" />
            </div>
        );
    }

    if (!task) {
        return (
            <div className="flex w-full flex-col gap-4">
                <h1 className="text-xl font-semibold">Task not found</h1>
                <p className="text-sm text-zoru-ink-muted">
                    The task you&apos;re looking for has been removed or you don&apos;t
                    have access.
                </p>
                <Button asChild variant="outline" className="w-fit">
                    <Link href="/dashboard/crm/sales-crm/tasks">Back to tasks</Link>
                </Button>
            </div>
        );
    }

    const status = (task.status as CrmTask['status']) || 'To-Do';
    const tone = statusToTone(status);
    const archived = (task as any).archivedAt != null;
    const due = task.dueDate ? new Date(task.dueDate) : null;
    const isOverdue = status !== 'Completed' && due ? due.getTime() < Date.now() : false;

    const linkedKind = ((task as any).linkedKind as TaskLinkedKind | undefined) ?? 'none';
    const linkedId = (task as any).linkedId ? String((task as any).linkedId) : undefined;
    const linkedKey = linkedEntityKey(linkedKind);
    const linkedTargetHref = linkedHref(linkedKind, linkedId);

    const checklist = ((task as any).checklist as ChecklistItem[]) ?? [];
    const reminders = ((task as any).reminders as Array<string | Date>) ?? [];
    const recurring = (task as any).recurring as
        | { frequency?: string; endDate?: string | Date | null }
        | undefined;
    const attachments = ((task as any).attachments as Array<{
        name?: string;
        url?: string;
    }>) ?? [];

    return (
        <>
            <EntityDetailShell
                back={{ href: '/dashboard/crm/sales-crm/tasks', label: 'Back to Tasks' }}
                eyebrow="TASK"
                title={task.title || 'Untitled task'}
                status={{
                    label: status,
                    tone:
                        tone === 'amber'
                            ? 'amber'
                            : tone === 'red'
                            ? 'red'
                            : tone === 'green'
                            ? 'green'
                            : tone === 'blue'
                            ? 'blue'
                            : 'neutral',
                }}
                actions={
                    <TaskDetailActions
                        taskId={taskId}
                        completed={status === 'Completed'}
                        archived={archived}
                        completing={completing}
                        snoozing={snoozing}
                        assigneeEmail={undefined}
                        onComplete={handleComplete}
                        onSnooze={handleSnooze}
                        onReassign={() =>
                            router.push(`/dashboard/crm/sales-crm/tasks/${taskId}/edit`)
                        }
                        onArchive={() => setArchiveOpen(true)}
                        onDelete={() => setDeleteOpen(true)}
                    />
                }
                rightRail={
                    <TaskDetailRail
                        task={task}
                        related={related}
                        linkedKind={linkedKind}
                        linkedId={linkedId}
                        linkedKey={linkedKey}
                        linkedKindLabel={LINKED_KIND_LABEL[linkedKind]}
                        linkedTargetHref={linkedTargetHref}
                        onSetStatus={(s) => void handleStatusChange(s)}
                    />
                }
            >
                {/* ─── Overview ─────────────────────────────────────────── */}
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Overview</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Type" value={(task.type as string) || 'Follow-up'} />
                        <Field
                            label="Due date"
                            value={
                                due ? (
                                    <span
                                        className={[
                                            'inline-flex items-center gap-1',
                                            isOverdue ? 'text-zoru-danger' : 'text-zoru-ink',
                                        ].join(' ')}
                                    >
                                        {due.toLocaleString()}
                                        {isOverdue ? <span className="text-[11px]">(overdue)</span> : null}
                                    </span>
                                ) : (
                                    '—'
                                )
                            }
                        />
                        <Field
                            label="Created"
                            value={
                                task.createdAt
                                    ? formatDistanceToNow(new Date(task.createdAt), {
                                          addSuffix: true,
                                      })
                                    : '—'
                            }
                        />
                        <Field
                            label="Last updated"
                            value={
                                task.updatedAt
                                    ? formatDistanceToNow(new Date(task.updatedAt), {
                                          addSuffix: true,
                                      })
                                    : '—'
                            }
                        />
                        <Field
                            label="Recurring"
                            value={
                                recurring?.frequency
                                    ? `${recurring.frequency}${
                                          recurring.endDate
                                              ? ` until ${new Date(recurring.endDate).toLocaleDateString()}`
                                              : ''
                                      }`
                                    : 'No'
                            }
                        />
                        <Field
                            label="Linked to"
                            value={
                                linkedKey && linkedId ? (
                                    <EntityPickerChip entity={linkedKey} id={linkedId} />
                                ) : (
                                    '—'
                                )
                            }
                        />
                        {task.description ? (
                            <div className="space-y-1 sm:col-span-2">
                                <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Description
                                </p>
                                <p className="whitespace-pre-line text-sm text-zoru-ink">
                                    {task.description}
                                </p>
                            </div>
                        ) : null}
                    </ZoruCardContent>
                </Card>

                {/* ─── Checklist ────────────────────────────────────────── */}
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Checklist</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <TaskChecklist taskId={taskId} items={checklist} />
                    </ZoruCardContent>
                </Card>

                {/* ─── Attachments ──────────────────────────────────────── */}
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Attachments</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {/* TODO 1D.2: SabFile picker integration deferred — wire SabFilePickerButton with onPick → updateCrmTask. */}
                        {attachments.length === 0 ? (
                            <p className="text-sm text-zoru-ink-muted">
                                No attachments yet. Inline SabFile picker is coming next —
                                edit the task to attach a file in the meantime.
                            </p>
                        ) : (
                            <ul className="space-y-1.5">
                                {attachments.map((a, i) => (
                                    <li key={i}>
                                        <a
                                            href={a.url ?? '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-sm text-zoru-primary hover:underline"
                                        >
                                            <CheckSquare className="h-3.5 w-3.5" />
                                            {a.name ?? a.url ?? `Attachment ${i + 1}`}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ZoruCardContent>
                </Card>

                {/* ─── Reminders ────────────────────────────────────────── */}
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Reminders</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {reminders.length === 0 ? (
                            <p className="text-sm text-zoru-ink-muted">
                                No reminders set. Edit the task to schedule one.
                            </p>
                        ) : (
                            <ul className="space-y-1.5">
                                {reminders.map((r, i) => {
                                    const d = new Date(r);
                                    return (
                                        <li
                                            key={i}
                                            className="rounded-md border border-zoru-line bg-zoru-bg px-2 py-1.5 text-sm text-zoru-ink"
                                        >
                                            {Number.isNaN(d.getTime())
                                                ? String(r)
                                                : d.toLocaleString()}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </ZoruCardContent>
                </Card>

                {/* ─── Notes ────────────────────────────────────────────── */}
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Notes</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {/* TODO 1D.2: full notes timeline + inline composer deferred —
                            crm-notes' record-kind enum does not include 'task' yet.
                            For now task.description carries the note content; edit the
                            task to amend. */}
                        <p className="text-sm text-zoru-ink-muted">
                            Inline note composer for tasks is queued. Until then, use{' '}
                            <Link
                                className="underline"
                                href={`/dashboard/crm/sales-crm/tasks/${taskId}/edit`}
                            >
                                Edit
                            </Link>{' '}
                            to update the description.
                        </p>
                    </ZoruCardContent>
                </Card>
            </EntityDetailShell>

            <ConfirmDialog
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
                title="Archive this task?"
                description={`"${task.title}" will be hidden from default views. (Soft archive: a follow-up will add the archive server action.)`}
                confirmLabel="Archive"
                confirmTone="primary"
                onConfirm={async () => {
                    // TODO 1D.2: dedicated archive endpoint deferred. For now we
                    // mark the task Completed so it falls out of "Open" views.
                    await handleStatusChange('Completed');
                    setArchiveOpen(false);
                }}
            />
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Delete this task permanently?"
                description="This permanently removes the task and cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}

/* ─── Tiny helpers ───────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                {label}
            </p>
            <div className="text-sm text-zoru-ink">{value}</div>
        </div>
    );
}
