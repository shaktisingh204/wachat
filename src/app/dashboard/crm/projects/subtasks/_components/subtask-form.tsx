'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <SubtaskForm /> — create + edit form for CRM subtasks.
 *
 * Binds to the `saveSubtask` server action via `useActionState`. The
 * parent task is selected with `<EntityFormField entity="task">` plus a
 * `parentKind` radio (task vs project_task). Assignee uses an Employee
 * picker.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveSubtask } from '@/app/actions/crm-subtasks.actions';
import type {
    CrmSubtaskDoc,
    CrmSubtaskParentKind,
    CrmSubtaskStatus,
} from '@/lib/rust-client/crm-subtasks';

const BASE = '/dashboard/crm/projects/subtasks';

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string | Date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create subtask'}
        </ZoruButton>
    );
}

export interface SubtaskFormProps {
    initialData?: CrmSubtaskDoc | null;
}

export function SubtaskForm({ initialData }: SubtaskFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveSubtask, {});

    const [parentKind, setParentKind] = useState<CrmSubtaskParentKind>(
        initialData?.parentKind ?? 'task',
    );
    const [status, setStatus] = useState<CrmSubtaskStatus>(
        initialData?.status ?? 'todo',
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="subtaskId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="parentKind" value={parentKind} />

                {/* Title */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="title">Title *</ZoruLabel>
                    <ZoruInput
                        id="title"
                        name="title"
                        required
                        defaultValue={initialData?.title ?? ''}
                        placeholder="e.g. Update onboarding email copy"
                    />
                </div>

                {/* Parent kind + parent picker */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Parent kind *</ZoruLabel>
                        <EnumFormField
                            enumName="subtaskParentKindRust"
                            name="parentKindPicker"
                            initialId={parentKind}
                            allowInlineCreate={false}
                            placeholder="Pick parent kind"
                            onChange={(next) =>
                                setParentKind(
                                    (next ?? 'task') as CrmSubtaskParentKind,
                                )
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Parent task *</ZoruLabel>
                        <EntityFormField
                            entity="task"
                            name="parentId"
                            initialId={initialData?.parentId}
                            placeholder="Pick a parent task"
                            required
                        />
                    </div>
                </div>

                {/* Assignee + Due */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Assignee</ZoruLabel>
                        <EntityFormField
                            entity="employee"
                            name="assigneeId"
                            initialId={initialData?.assigneeId}
                            placeholder="Pick an assignee"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="dueDate">Due date</ZoruLabel>
                        <ZoruInput
                            id="dueDate"
                            name="dueDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.dueDate)}
                        />
                    </div>
                </div>

                {/* Order + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="order">Order</ZoruLabel>
                        <ZoruInput
                            id="order"
                            name="order"
                            type="number"
                            min={0}
                            step={1}
                            placeholder="0"
                            defaultValue={
                                initialData?.order != null
                                    ? String(initialData.order)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            enumName="subtaskStatus"
                            name="statusPicker"
                            initialId={status}
                            placeholder="Status"
                            onChange={(next) =>
                                setStatus((next ?? 'todo') as CrmSubtaskStatus)
                            }
                        />
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={4}
                        placeholder="Optional details for the subtask"
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to subtasks
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}

export default SubtaskForm;
