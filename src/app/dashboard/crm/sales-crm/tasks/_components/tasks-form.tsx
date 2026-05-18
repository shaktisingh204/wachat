'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDatePicker,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { LoaderCircle,
  Save } from 'lucide-react';

/**
 * <TaskForm> — shared client form for `/new` and `/[id]/edit`.
 *
 * Drives both `createCrmTask` and `updateCrmTask`. Implements the
 * linked-entity discriminator pattern from §1D.3: the `linkedKind`
 * state variable picks which entity-key the linked-entity picker
 * binds to, mirroring the approach used by portal-user.
 *
 * Actions: Cancel · Save · Save & New · Save & Mark Complete (the
 * latter only on `/new` so retroactive logging works).
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import {
    createCrmTask,
    updateCrmTask,
    type TaskLinkedKind,
} from '@/app/actions/crm-tasks.actions';
import type { EntityKey } from '@/lib/lookup-registry';
import type { CrmTask } from '@/lib/definitions';
import type { WithId } from 'mongodb';

const TASK_TYPES = ['Call', 'Email', 'Meeting', 'Follow-up', 'Demo', 'Other'] as const;
const TASK_PRIORITIES = ['Low', 'Medium', 'High'] as const;
const TASK_STATUSES = ['To-Do', 'In Progress', 'Completed'] as const;
const LINKED_KINDS: { value: TaskLinkedKind; label: string; entity: EntityKey | null }[] = [
    { value: 'none', label: 'No link', entity: null },
    { value: 'lead', label: 'Lead', entity: 'lead' },
    { value: 'deal', label: 'Deal', entity: 'deal' },
    { value: 'client', label: 'Client / Account', entity: 'client' },
    { value: 'contact', label: 'Contact', entity: 'contact' },
    { value: 'ticket', label: 'Ticket', entity: 'ticketGroup' },
    { value: 'invoice', label: 'Invoice', entity: 'invoice' },
];

const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export interface TaskFormProps {
    mode: 'create' | 'edit';
    initial?: WithId<CrmTask> | null;
    /** Pre-fill from `?linkedKind=&linkedId=` query string. */
    prefill?: {
        linkedKind?: TaskLinkedKind;
        linkedId?: string;
        title?: string;
    } | null;
    /** Current session user id — used as default assignee. */
    currentUserId?: string | null;
}

type ActionState = { message?: string; error?: string; taskId?: string };

function getLinkedEntity(kind: TaskLinkedKind): EntityKey | null {
    const found = LINKED_KINDS.find((k) => k.value === kind);
    return found?.entity ?? null;
}

export function TaskForm({ mode, initial, prefill, currentUserId }: TaskFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const formRef = React.useRef<HTMLFormElement>(null);

    const [pending, startTransition] = React.useTransition();
    const [dirty, setDirty] = React.useState(false);

    // Linked-entity discriminator state (mirrors the portal-user pattern).
    const initialLinkedKind: TaskLinkedKind =
        ((initial as any)?.linkedKind as TaskLinkedKind | undefined) ??
        prefill?.linkedKind ??
        'none';
    const initialLinkedId =
        ((initial as any)?.linkedId
            ? String((initial as any).linkedId)
            : prefill?.linkedId) ?? '';
    const [linkedKind, setLinkedKind] = React.useState<TaskLinkedKind>(initialLinkedKind);
    const [linkedId, setLinkedId] = React.useState<string>(initialLinkedId);
    const linkedEntity = getLinkedEntity(linkedKind);

    const [dueDate, setDueDate] = React.useState<Date | undefined>(
        initial?.dueDate ? new Date(initial.dueDate) : undefined,
    );
    const [recurringEnd, setRecurringEnd] = React.useState<Date | undefined>(
        (initial as any)?.recurring?.endDate
            ? new Date((initial as any).recurring.endDate)
            : undefined,
    );
    const [assignedTo, setAssignedTo] = React.useState<string>(
        initial?.assignedTo
            ? String(initial.assignedTo)
            : currentUserId
            ? currentUserId
            : '',
    );

    const submit = React.useCallback(
        async (intent: 'save' | 'save_new' | 'save_complete') => {
            if (!formRef.current) return;
            const fd = new FormData(formRef.current);
            fd.set('intent', intent);

            startTransition(async () => {
                const state: ActionState =
                    mode === 'edit'
                        ? await updateCrmTask({}, fd)
                        : await createCrmTask({}, fd);

                if (state.error) {
                    toast({
                        title: 'Could not save',
                        description: state.error,
                        variant: 'destructive',
                    });
                    return;
                }

                setDirty(false);
                toast({ title: state.message ?? 'Saved' });

                const newId = state.taskId ?? (initial?._id?.toString() ?? '');

                if (intent === 'save_new') {
                    router.push('/dashboard/crm/sales-crm/tasks/new');
                    return;
                }

                if (newId) {
                    router.push(`/dashboard/crm/sales-crm/tasks/${newId}`);
                } else {
                    router.push('/dashboard/crm/sales-crm/tasks');
                }
            });
        },
        [mode, initial?._id, router, toast],
    );

    // Cmd/Ctrl+S → save.
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void submit('save');
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void submit('save_new');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [submit]);

    const existingChecklist =
        ((initial as any)?.checklist as Array<{ label: string; done?: boolean }>) ?? [];
    const checklistText = existingChecklist.map((c) => c.label).join('\n');

    return (
        <form
            ref={formRef}
            onChange={() => setDirty(true)}
            onSubmit={(e) => {
                e.preventDefault();
                void submit('save');
            }}
            className="flex w-full flex-col gap-6 pb-24"
        >
            <DirtyFormPrompt dirty={dirty && !pending} />

            {mode === 'edit' && initial?._id ? (
                <input type="hidden" name="taskId" value={String(initial._id)} />
            ) : null}
            <input type="hidden" name="dueDate" value={dueDate?.toISOString() ?? ''} />
            <input
                type="hidden"
                name="recurringEndDate"
                value={recurringEnd?.toISOString() ?? ''}
            />
            <input type="hidden" name="linkedKind" value={linkedKind} />
            <input type="hidden" name="linkedId" value={linkedId} />
            <input type="hidden" name="assignedTo" value={assignedTo} />

            {/* ─── Overview ─────────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Overview</ZoruCardTitle>
                    <ZoruCardDescription>
                        What needs doing, how urgent, and where it sits in your queue.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                        <ZoruLabel htmlFor="title">Title *</ZoruLabel>
                        <ZoruInput
                            id="title"
                            name="title"
                            required
                            defaultValue={initial?.title ?? prefill?.title ?? ''}
                            placeholder="e.g. Follow up with Priya about pricing"
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <ZoruLabel htmlFor="description">Description</ZoruLabel>
                        <ZoruTextarea
                            id="description"
                            name="description"
                            rows={3}
                            defaultValue={initial?.description ?? ''}
                            placeholder="Optional notes or context"
                        />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Type</ZoruLabel>
                        <EnumFormField
                            enumName="taskType"
                            name="type"
                            initialId={(initial?.type as string) ?? 'Follow-up'}
                        />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Priority</ZoruLabel>
                        <EnumFormField
                            enumName="priorityLegacy"
                            name="priority"
                            initialId={(initial?.priority as string) ?? 'Medium'}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            enumName="taskStatusLegacy"
                            name="status"
                            initialId={(initial?.status as string) ?? 'To-Do'}
                            allowInlineCreate={false}
                        />
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* ─── Schedule ─────────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Schedule</ZoruCardTitle>
                    <ZoruCardDescription>
                        Due date, reminders, and optional recurrence.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <ZoruLabel>Due date</ZoruLabel>
                        <ZoruDatePicker
                            value={dueDate}
                            onChange={(d) => {
                                setDueDate(d);
                                setDirty(true);
                            }}
                            placeholder="Pick a due date…"
                        />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="reminders">Reminders</ZoruLabel>
                        <ZoruInput
                            id="reminders"
                            name="reminders"
                            placeholder="2026-05-15T09:00, 2026-05-16T18:30"
                            defaultValue={
                                Array.isArray((initial as any)?.reminders)
                                    ? ((initial as any).reminders as Array<string | Date>)
                                          .map((r) =>
                                              typeof r === 'string'
                                                  ? r
                                                  : new Date(r).toISOString(),
                                          )
                                          .join(', ')
                                    : ''
                            }
                        />
                        <p className="text-[11.5px] text-zoru-ink-muted">
                            Comma- or semicolon-separated ISO timestamps. Plumbed for the
                            reminders cron (deferred).
                        </p>
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Repeat</ZoruLabel>
                        <EnumFormField
                            enumName="recurringFrequencySimple"
                            name="recurringFrequency"
                            initialId={
                                ((initial as any)?.recurring?.frequency as string) ?? null
                            }
                            placeholder="Does not repeat"
                        />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Recurrence ends on</ZoruLabel>
                        <ZoruDatePicker
                            value={recurringEnd}
                            onChange={(d) => {
                                setRecurringEnd(d);
                                setDirty(true);
                            }}
                            placeholder="No end date"
                        />
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* ─── Assignment ───────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Assignment</ZoruCardTitle>
                    <ZoruCardDescription>
                        Who owns this task? Defaults to you.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <ZoruLabel>Assignee</ZoruLabel>
                        <EntityFormField
                            entity="user"
                            name="assigneeDisplay"
                            initialId={assignedTo || null}
                            placeholder="Unassigned"
                            onChange={(next) => {
                                setAssignedTo(next ?? '');
                                setDirty(true);
                            }}
                        />
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* ─── Linked entity (discriminator) ────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Linked entity</ZoruCardTitle>
                    <ZoruCardDescription>
                        Tie this task to a lead, deal, client, contact, ticket, or invoice.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <ZoruLabel>Link to</ZoruLabel>
                        <EnumFormField
                            enumName="linkedEntityKind"
                            name="linkedKindPicker"
                            initialId={linkedKind}
                            allowInlineCreate={false}
                            onChange={(next) => {
                                setLinkedKind((next ?? 'none') as TaskLinkedKind);
                                setLinkedId('');
                                setDirty(true);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>
                            {LINKED_KINDS.find((k) => k.value === linkedKind)?.label ?? 'None'}
                        </ZoruLabel>
                        {linkedEntity ? (
                            <EntityFormField
                                entity={linkedEntity}
                                name="linkedDisplay"
                                initialId={linkedId || null}
                                placeholder="Pick the linked record…"
                                onChange={(next) => {
                                    setLinkedId(next ?? '');
                                    setDirty(true);
                                }}
                            />
                        ) : (
                            <p className="text-[12.5px] text-zoru-ink-muted">
                                Pick a link target above to attach this task to a record.
                            </p>
                        )}
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* ─── Checklist ────────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Checklist</ZoruCardTitle>
                    <ZoruCardDescription>
                        One item per line. Becomes a togglable checklist on the detail page.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <ZoruTextarea
                        id="checklist"
                        name="checklist"
                        rows={4}
                        defaultValue={checklistText}
                        placeholder="Draft proposal\nSend follow-up email\nBook demo slot"
                    />
                </ZoruCardContent>
            </ZoruCard>

            {/* ─── Attachments ──────────────────────────────────────────── */}
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Attachments</ZoruCardTitle>
                    <ZoruCardDescription>
                        SabFile picker integration is deferred to the inline composer on the
                        detail page.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {/* TODO 1D.3: SabFile picker integration deferred —
                        use SabFilePickerButton inside an array editor.
                        For now, attachments mirror through as a hidden JSON
                        payload so the action accepts it without crashing. */}
                    <input
                        type="hidden"
                        name="attachments"
                        defaultValue={JSON.stringify(
                            ((initial as any)?.attachments as unknown[]) ?? [],
                        )}
                    />
                    <p className="text-[12.5px] text-zoru-ink-muted">
                        Add files from the task detail page once it has been saved.
                    </p>
                </ZoruCardContent>
            </ZoruCard>

            {/* ─── Sticky action bar ────────────────────────────────────── */}
            <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-zoru-line bg-zoru-bg/95 px-4 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <ZoruButton
                        type="button"
                        variant="ghost"
                        onClick={() => router.push('/dashboard/crm/sales-crm/tasks')}
                        disabled={pending}
                    >
                        Cancel
                    </ZoruButton>
                    <ZoruButton
                        type="button"
                        variant="outline"
                        onClick={() => void submit('save_new')}
                        disabled={pending}
                    >
                        Save &amp; New
                    </ZoruButton>
                    {mode === 'create' ? (
                        <ZoruButton
                            type="button"
                            variant="outline"
                            onClick={() => void submit('save_complete')}
                            disabled={pending}
                            title="Save the task and immediately mark it Completed"
                        >
                            Save &amp; Mark Complete
                        </ZoruButton>
                    ) : null}
                    <ZoruButton type="submit" disabled={pending}>
                        {pending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Save className="h-4 w-4" aria-hidden="true" />
                        )}
                        {mode === 'edit' ? 'Save changes' : 'Save task'}
                    </ZoruButton>
                </div>
            </div>
        </form>
    );
}

export default TaskForm;
