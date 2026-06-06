'use client';

import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';

// §1E.sweep: status Select kept — form uses in_progress/no_show/archived but oneOnOneStatus enum only has scheduled/completed/cancelled/rescheduled; resolve Rust DTO first.
// §1E.sweep: mood Select kept — no moodStatus enum in catalogue.

/**
 * <OneOnOneForm /> — create + edit form for HR one-on-ones.
 *
 * Binds to the `saveOneOnOne` server action via `useActionState`. Agenda
 * and action items are structured arrays, serialised to hidden JSON.
 */

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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Schedule one-on-one'}
        </Button>
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
        <Card className="p-6">
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
                        <Label htmlFor="managerId">Manager (user id) *</Label>
                        <Input
                            id="managerId"
                            name="managerId"
                            required
                            placeholder="Manager user id"
                            defaultValue={initialData?.managerId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="managerName">Manager name</Label>
                        <Input
                            id="managerName"
                            name="managerName"
                            placeholder="Display name"
                            defaultValue={initialData?.managerName ?? ''}
                        />
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="reportId">Report (user id) *</Label>
                        <Input
                            id="reportId"
                            name="reportId"
                            required
                            placeholder="Report user id"
                            defaultValue={initialData?.reportId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="reportName">Report name</Label>
                        <Input
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
                        <Label htmlFor="scheduledAt">Scheduled at *</Label>
                        <Input
                            id="scheduledAt"
                            name="scheduledAt"
                            type="datetime-local"
                            required
                            defaultValue={toDateTimeInput(initialData?.scheduledAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="durationMinutes">Duration (min)</Label>
                        <Input
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
                        <Label htmlFor="location">Location</Label>
                        <Input
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
                        <Label htmlFor="status-trigger">Status</Label>
                        <Select
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
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="mood-trigger">Mood</Label>
                        <Select
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
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="engagementScore">Engagement score</Label>
                        <Input
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
                        <Label htmlFor="nextMeetingAt">Next meeting</Label>
                        <Input
                            id="nextMeetingAt"
                            name="nextMeetingAt"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(initialData?.nextMeetingAt)}
                        />
                    </div>
                </div>

                {/* Discussion notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="discussionNotes">Discussion notes</Label>
                    <Textarea
                        id="discussionNotes"
                        name="discussionNotes"
                        rows={5}
                        placeholder="Free-form notes captured during the meeting."
                        defaultValue={initialData?.discussionNotes ?? ''}
                    />
                </div>

                {/* Private toggle */}
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="isPrivate"
                        name="isPrivate"
                        defaultChecked={!!initialData?.isPrivate}
                    />
                    <Label htmlFor="isPrivate" className="cursor-pointer">
                        Mark as private (visible only to manager and report)
                    </Label>
                </div>

                {/* Agenda */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Agenda</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addAgenda}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add topic
                        </Button>
                    </div>
                    {agenda.length === 0 ? (
                        <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                            No agenda topics yet.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {agenda.map((ag) => (
                                <div
                                    key={ag.id}
                                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3"
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 space-y-1.5">
                                            <Label>Topic *</Label>
                                            <Input
                                                value={ag.topic}
                                                onChange={(e) =>
                                                    updateAgenda(ag.id, 'topic', e.target.value)
                                                }
                                                placeholder="What to discuss"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeAgenda(ag.id)}
                                            aria-label="Remove topic"
                                        >
                                            <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                        </Button>
                                    </div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <Label>Owner</Label>
                                            <Input
                                                value={ag.owner ?? ''}
                                                onChange={(e) =>
                                                    updateAgenda(ag.id, 'owner', e.target.value)
                                                }
                                                placeholder="Who leads"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Time (min)</Label>
                                            <Input
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
                                            <Checkbox
                                                checked={!!ag.discussed}
                                                onCheckedChange={(v) =>
                                                    updateAgenda(ag.id, 'discussed', !!v)
                                                }
                                            />
                                            <span className="text-[12.5px] text-[var(--st-text)]">
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
                        <Label>Action items</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addAction}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add action
                        </Button>
                    </div>
                    {actionItems.length === 0 ? (
                        <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                            No action items yet.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {actionItems.map((ai) => (
                                <div
                                    key={ai.id}
                                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3"
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 space-y-1.5">
                                            <Label>Description *</Label>
                                            <Input
                                                value={ai.description}
                                                onChange={(e) =>
                                                    updateAction(ai.id, 'description', e.target.value)
                                                }
                                                placeholder="What needs to happen"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeAction(ai.id)}
                                            aria-label="Remove action item"
                                        >
                                            <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                        </Button>
                                    </div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                        <div className="space-y-1.5">
                                            <Label>Assignee id</Label>
                                            <Input
                                                value={ai.assigneeId ?? ''}
                                                onChange={(e) =>
                                                    updateAction(ai.id, 'assigneeId', e.target.value)
                                                }
                                                placeholder="User id"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Due date</Label>
                                            <Input
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
                                            <Label>Status</Label>
                                            <Select
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
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to one-on-ones
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
