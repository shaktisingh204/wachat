'use client';

// TODO 1E.sweep: status -> <EnumFormField enumName="oneOnOneStatus">; manager/employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <OneOnOneForm /> — create + edit form for HR one-on-ones.
 *
 * Binds to the `saveOneOnOne` server action via `useActionState`. Agenda
 * and action items are structured arrays, serialised to hidden JSON.
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
    ZoruCheckbox,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';

import { saveOneOnOne } from '@/app/actions/crm-one-on-ones.actions';
import type {
    CrmOneOnOneActionItem,
    CrmOneOnOneAgendaItem,
    CrmOneOnOneDoc,
    CrmOneOnOneMood,
    CrmOneOnOneStatus,
} from '@/lib/rust-client/crm-one-on-ones';

const BASE = '/dashboard/hrm/hr/one-on-ones';

const STATUS_OPTIONS: Array<{ value: CrmOneOnOneStatus; label: string }> = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No show' },
    { value: 'archived', label: 'Archived' },
];

const MOOD_OPTIONS: Array<{ value: CrmOneOnOneMood | ''; label: string }> = [
    { value: '', label: 'Not set' },
    { value: 'happy', label: 'Happy' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'concerned', label: 'Concerned' },
];

const ACTION_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
    { value: 'cancelled', label: 'Cancelled' },
];

function toDateTimeInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    // Format YYYY-MM-DDTHH:mm for datetime-local
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function newId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

interface OneOnOneFormProps {
    initialData?: CrmOneOnOneDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Schedule one-on-one'}
        </ZoruButton>
    );
}

export function OneOnOneForm({ initialData }: OneOnOneFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveOneOnOne, initialState);

    const [status, setStatus] = useState<CrmOneOnOneStatus>(
        (initialData?.status as CrmOneOnOneStatus) ?? 'scheduled',
    );
    const [mood, setMood] = useState<CrmOneOnOneMood | ''>(
        (initialData?.mood as CrmOneOnOneMood | undefined) ?? '',
    );
    const [agenda, setAgenda] = useState<CrmOneOnOneAgendaItem[]>(
        Array.isArray(initialData?.agenda)
            ? (initialData!.agenda as CrmOneOnOneAgendaItem[])
            : [],
    );
    const [actionItems, setActionItems] = useState<CrmOneOnOneActionItem[]>(
        Array.isArray(initialData?.actionItems)
            ? (initialData!.actionItems as CrmOneOnOneActionItem[])
            : [],
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const addAgenda = () =>
        setAgenda((a) => [...a, { id: newId('ag'), topic: '' }]);
    const removeAgenda = (id: string) =>
        setAgenda((a) => a.filter((i) => i.id !== id));
    const updateAgenda = <K extends keyof CrmOneOnOneAgendaItem>(
        id: string,
        field: K,
        value: CrmOneOnOneAgendaItem[K],
    ) =>
        setAgenda((a) =>
            a.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
        );

    const addAction = () =>
        setActionItems((a) => [
            ...a,
            { id: newId('ai'), description: '', status: 'pending' },
        ]);
    const removeAction = (id: string) =>
        setActionItems((a) => a.filter((i) => i.id !== id));
    const updateAction = <K extends keyof CrmOneOnOneActionItem>(
        id: string,
        field: K,
        value: CrmOneOnOneActionItem[K],
    ) =>
        setActionItems((a) =>
            a.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
        );

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="oneOnOneId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="mood" value={mood} />
                <input type="hidden" name="agenda" value={JSON.stringify(agenda)} />
                <input
                    type="hidden"
                    name="actionItems"
                    value={JSON.stringify(actionItems)}
                />

                {/* Row 1: Manager + Report */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="managerId">Manager (user id) *</ZoruLabel>
                        <ZoruInput
                            id="managerId"
                            name="managerId"
                            required
                            placeholder="Manager user id"
                            defaultValue={initialData?.managerId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="managerName">Manager name</ZoruLabel>
                        <ZoruInput
                            id="managerName"
                            name="managerName"
                            placeholder="Display name"
                            defaultValue={initialData?.managerName ?? ''}
                        />
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="reportId">Report (user id) *</ZoruLabel>
                        <ZoruInput
                            id="reportId"
                            name="reportId"
                            required
                            placeholder="Report user id"
                            defaultValue={initialData?.reportId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="reportName">Report name</ZoruLabel>
                        <ZoruInput
                            id="reportName"
                            name="reportName"
                            placeholder="Display name"
                            defaultValue={initialData?.reportName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Scheduled / Duration / Location */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="scheduledAt">Scheduled at *</ZoruLabel>
                        <ZoruInput
                            id="scheduledAt"
                            name="scheduledAt"
                            type="datetime-local"
                            required
                            defaultValue={toDateTimeInput(initialData?.scheduledAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="durationMinutes">Duration (min)</ZoruLabel>
                        <ZoruInput
                            id="durationMinutes"
                            name="durationMinutes"
                            type="number"
                            min={0}
                            step={5}
                            placeholder="30"
                            defaultValue={
                                typeof initialData?.durationMinutes === 'number'
                                    ? String(initialData.durationMinutes)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="location">Location</ZoruLabel>
                        <ZoruInput
                            id="location"
                            name="location"
                            placeholder="Room / link"
                            defaultValue={initialData?.location ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Status / Mood / Engagement / Next */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmOneOnOneStatus)}
                        >
                            <ZoruSelectTrigger id="status-trigger">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="mood-trigger">Mood</ZoruLabel>
                        <ZoruSelect
                            value={mood || ''}
                            onValueChange={(v) => setMood((v as CrmOneOnOneMood) || '')}
                        >
                            <ZoruSelectTrigger id="mood-trigger">
                                <ZoruSelectValue placeholder="Mood" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {MOOD_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value || 'none'} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="engagementScore">Engagement score</ZoruLabel>
                        <ZoruInput
                            id="engagementScore"
                            name="engagementScore"
                            type="number"
                            min={0}
                            max={10}
                            step={1}
                            placeholder="0–10"
                            defaultValue={
                                typeof initialData?.engagementScore === 'number'
                                    ? String(initialData.engagementScore)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="nextMeetingAt">Next meeting</ZoruLabel>
                        <ZoruInput
                            id="nextMeetingAt"
                            name="nextMeetingAt"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(initialData?.nextMeetingAt)}
                        />
                    </div>
                </div>

                {/* Discussion notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="discussionNotes">Discussion notes</ZoruLabel>
                    <ZoruTextarea
                        id="discussionNotes"
                        name="discussionNotes"
                        rows={5}
                        placeholder="Free-form notes captured during the meeting."
                        defaultValue={initialData?.discussionNotes ?? ''}
                    />
                </div>

                {/* Private toggle */}
                <div className="flex items-center gap-2">
                    <ZoruCheckbox
                        id="isPrivate"
                        name="isPrivate"
                        defaultChecked={!!initialData?.isPrivate}
                    />
                    <ZoruLabel htmlFor="isPrivate" className="cursor-pointer">
                        Mark as private (visible only to manager and report)
                    </ZoruLabel>
                </div>

                {/* Agenda */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Agenda</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addAgenda}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add topic
                        </ZoruButton>
                    </div>
                    {agenda.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                            No agenda topics yet.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {agenda.map((ag) => (
                                <div
                                    key={ag.id}
                                    className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3"
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 space-y-1.5">
                                            <ZoruLabel>Topic *</ZoruLabel>
                                            <ZoruInput
                                                value={ag.topic}
                                                onChange={(e) =>
                                                    updateAgenda(ag.id, 'topic', e.target.value)
                                                }
                                                placeholder="What to discuss"
                                            />
                                        </div>
                                        <ZoruButton
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeAgenda(ag.id)}
                                            aria-label="Remove topic"
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </ZoruButton>
                                    </div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <ZoruLabel>Owner</ZoruLabel>
                                            <ZoruInput
                                                value={ag.owner ?? ''}
                                                onChange={(e) =>
                                                    updateAgenda(ag.id, 'owner', e.target.value)
                                                }
                                                placeholder="Who leads"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <ZoruLabel>Time (min)</ZoruLabel>
                                            <ZoruInput
                                                type="number"
                                                min={0}
                                                value={
                                                    typeof ag.timeMinutes === 'number'
                                                        ? String(ag.timeMinutes)
                                                        : ''
                                                }
                                                onChange={(e) =>
                                                    updateAgenda(
                                                        ag.id,
                                                        'timeMinutes',
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value),
                                                    )
                                                }
                                                placeholder="10"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 self-end pb-1.5">
                                            <ZoruCheckbox
                                                checked={!!ag.discussed}
                                                onCheckedChange={(v) =>
                                                    updateAgenda(ag.id, 'discussed', !!v)
                                                }
                                            />
                                            <span className="text-[12.5px] text-zoru-ink">
                                                Discussed
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action items */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Action items</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addAction}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add action
                        </ZoruButton>
                    </div>
                    {actionItems.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                            No action items yet.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {actionItems.map((ai) => (
                                <div
                                    key={ai.id}
                                    className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3"
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 space-y-1.5">
                                            <ZoruLabel>Description *</ZoruLabel>
                                            <ZoruInput
                                                value={ai.description}
                                                onChange={(e) =>
                                                    updateAction(ai.id, 'description', e.target.value)
                                                }
                                                placeholder="What needs to happen"
                                            />
                                        </div>
                                        <ZoruButton
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeAction(ai.id)}
                                            aria-label="Remove action item"
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </ZoruButton>
                                    </div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <ZoruLabel>Assignee id</ZoruLabel>
                                            <ZoruInput
                                                value={ai.assigneeId ?? ''}
                                                onChange={(e) =>
                                                    updateAction(ai.id, 'assigneeId', e.target.value)
                                                }
                                                placeholder="User id"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <ZoruLabel>Due date</ZoruLabel>
                                            <ZoruInput
                                                type="date"
                                                value={
                                                    ai.dueDate
                                                        ? new Date(ai.dueDate)
                                                              .toISOString()
                                                              .slice(0, 10)
                                                        : ''
                                                }
                                                onChange={(e) =>
                                                    updateAction(
                                                        ai.id,
                                                        'dueDate',
                                                        e.target.value || undefined,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <ZoruLabel>Status</ZoruLabel>
                                            <ZoruSelect
                                                value={ai.status}
                                                onValueChange={(v) =>
                                                    updateAction(ai.id, 'status', v)
                                                }
                                            >
                                                <ZoruSelectTrigger>
                                                    <ZoruSelectValue />
                                                </ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    {ACTION_STATUS_OPTIONS.map((o) => (
                                                        <ZoruSelectItem
                                                            key={o.value}
                                                            value={o.value}
                                                        >
                                                            {o.label}
                                                        </ZoruSelectItem>
                                                    ))}
                                                </ZoruSelectContent>
                                            </ZoruSelect>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to one-on-ones
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
