'use client';

import { Button, Card, Checkbox, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
    ArrowLeft,
  FileUp,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * <TaskForm /> — create + edit form for CRM tasks.
 *
 * Binds to the `saveTask` server action (Rust-backed) via `useActionState`.
 *
 * Includes:
 *   • checklist repeater (Vec<{text, done}> → JSON-encoded hidden field)
 *   • multi-file attachments via `<SabFilePickerButton>` (SabFiles policy)
 *   • linked-entity selector (lead/deal/contact/etc.)
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

import { saveTask } from '@/app/actions/crm-tasks-rust.actions';
import type {
    CrmTaskChecklistItem,
    CrmTaskDoc,
    CrmTaskStatus,
} from '@/lib/rust-client/crm-tasks';

const BASE = '/dashboard/crm/tasks';

/**
 * Map the user-picked discriminator → the lookup entity the linked-id
 * picker should resolve against. `none` short-circuits the picker.
 */
const LINKED_ENTITY_BY_KIND: Record<string, EntityKey | null> = {
    none: null,
    lead: 'lead',
    deal: 'deal',
    contact: 'contact',
    client: 'client',
    ticket: 'ticketGroup', // tickets aren't a top-level lookup yet
    invoice: 'invoice',
    project: 'project',
};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface TaskFormProps {
    initialData?: CrmTaskDoc | null;
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
            {isEditing ? 'Save changes' : 'Create task'}
        </Button>
    );
}

export function TaskForm({ initialData }: TaskFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveTask, initialState);

    const [priority, setPriority] = useState<string>(
        initialData?.priority ?? 'Medium',
    );
    const [status, setStatus] = useState<CrmTaskStatus>(
        (initialData?.status as CrmTaskStatus) ?? 'To-Do',
    );
    const [linkedKind, setLinkedKind] = useState<string>(
        initialData?.linkedKind ?? 'none',
    );

    const [checklist, setChecklist] = useState<CrmTaskChecklistItem[]>(
        Array.isArray(initialData?.checklist) ? initialData!.checklist! : [],
    );
    const [attachments, setAttachments] = useState<
        Array<{ url: string; name: string }>
    >(
        Array.isArray(initialData?.attachments)
            ? initialData!.attachments!.map((u) => ({ url: u, name: extractName(u) }))
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

    const addChecklistRow = () =>
        setChecklist((prev) => [...prev, { text: '', done: false }]);

    const updateChecklistRow = (
        idx: number,
        patch: Partial<CrmTaskChecklistItem>,
    ) =>
        setChecklist((prev) =>
            prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
        );

    const removeChecklistRow = (idx: number) =>
        setChecklist((prev) => prev.filter((_, i) => i !== idx));

    const onPickAttachment = (pick: SabFilePick) =>
        setAttachments((prev) => [...prev, { url: pick.url, name: pick.name }]);

    const removeAttachment = (idx: number) =>
        setAttachments((prev) => prev.filter((_, i) => i !== idx));

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="taskId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="priority" value={priority} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="linkedKind" value={linkedKind} />
                <input
                    type="hidden"
                    name="checklist"
                    value={JSON.stringify(
                        checklist.filter((c) => c.text.trim().length > 0),
                    )}
                />
                <input
                    type="hidden"
                    name="attachments"
                    value={JSON.stringify(attachments.map((a) => a.url))}
                />

                {/* Title */}
                <div className="space-y-1.5">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                        id="title"
                        name="title"
                        required
                        placeholder="What needs doing?"
                        defaultValue={initialData?.title ?? ''}
                    />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={4}
                        placeholder="Context, deliverables, acceptance criteria…"
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Type + Priority + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="type">Type</Label>
                        <Input
                            id="type"
                            name="type"
                            placeholder="follow-up, call, …"
                            defaultValue={initialData?.type ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Priority</Label>
                        <EnumFormField
                            enumName="priorityLegacy"
                            name="priorityPicker"
                            initialId={priority}
                            placeholder="Priority"
                            onChange={(next) => setPriority(next ?? 'Medium')}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="taskStatusLegacy"
                            name="statusPicker"
                            initialId={status}
                            placeholder="Status"
                            allowInlineCreate={false}
                            onChange={(next) => setStatus((next ?? 'To-Do') as CrmTaskStatus)}
                        />
                    </div>
                </div>

                {/* Due + Reminders + Assigned */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="dueDate">Due date</Label>
                        <Input
                            id="dueDate"
                            name="dueDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.dueDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="reminders">Reminders</Label>
                        <Input
                            id="reminders"
                            name="reminders"
                            placeholder="2025-12-15, 2025-12-20"
                            defaultValue={
                                Array.isArray(initialData?.reminders)
                                    ? initialData!.reminders!.join(', ')
                                    : ''
                            }
                        />
                        <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                            Comma-separated ISO dates.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Assigned to</Label>
                        <EntityFormField
                            entity="user"
                            name="assignedTo"
                            initialId={initialData?.assignedTo ?? null}
                            placeholder="Pick a user"
                        />
                    </div>
                </div>

                {/* Linked entity */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Linked entity</Label>
                        <EnumFormField
                            enumName="linkedEntityKind"
                            name="linkedKindPicker"
                            initialId={linkedKind}
                            placeholder="Kind"
                            allowInlineCreate={false}
                            onChange={(next) => setLinkedKind(next ?? 'none')}
                        />
                    </div>
                    {linkedKind !== 'none' && LINKED_ENTITY_BY_KIND[linkedKind] ? (
                        <div className="space-y-1.5">
                            <Label>Linked record</Label>
                            <EntityFormField
                                key={linkedKind}
                                entity={LINKED_ENTITY_BY_KIND[linkedKind]!}
                                name="linkedId"
                                initialId={initialData?.linkedId ?? null}
                                placeholder={`Pick a ${linkedKind}`}
                            />
                        </div>
                    ) : null}
                </div>

                {/* Checklist repeater */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Checklist</Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addChecklistRow}
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add item
                        </Button>
                    </div>
                    {checklist.length === 0 ? (
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            No checklist items yet. Add steps the assignee can tick off.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {checklist.map((row, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2"
                                >
                                    <Checkbox
                                        checked={!!row.done}
                                        onCheckedChange={(v) =>
                                            updateChecklistRow(idx, { done: !!v })
                                        }
                                    />
                                    <Input
                                        value={row.text}
                                        onChange={(e) =>
                                            updateChecklistRow(idx, { text: e.target.value })
                                        }
                                        placeholder={`Step ${idx + 1}`}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeChecklistRow(idx)}
                                    >
                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Attachments */}
                <div className="space-y-2">
                    <Label>Attachments</Label>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="any"
                            onPick={onPickAttachment}
                            title="Attach a file from SabFiles"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" /> Add attachment
                        </SabFilePickerButton>
                    </div>
                    {attachments.length > 0 ? (
                        <ul className="flex flex-col gap-1.5">
                            {attachments.map((a, idx) => (
                                <li
                                    key={`${a.url}-${idx}`}
                                    className="flex items-center justify-between gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-1.5"
                                >
                                    <a
                                        href={a.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="max-w-[400px] truncate text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
                                    >
                                        {a.name}
                                    </a>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAttachment(idx)}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            No attachments. Pick from SabFiles or upload fresh.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to tasks
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}

function extractName(url: string): string {
    try {
        const path = new URL(url, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || url;
    } catch {
        return url;
    }
}
