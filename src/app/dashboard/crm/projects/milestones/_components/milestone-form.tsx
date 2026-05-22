'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
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
 * <MilestoneForm /> — create + edit form for project milestones.
 *
 * Binds to the `saveMilestone` server action via `useActionState`.
 * Project + parent are entity pickers; tags are a comma-separated input.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveMilestone } from '@/app/actions/crm-milestones.actions';
import type {
    CrmMilestoneDoc,
    CrmMilestonePriority,
    CrmMilestoneStatus,
} from '@/lib/rust-client/crm-milestones';

const BASE = '/dashboard/crm/projects/milestones';

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string | Date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create milestone'}
        </Button>
    );
}

export interface MilestoneFormProps {
    initialData?: CrmMilestoneDoc | null;
}

export function MilestoneForm({ initialData }: MilestoneFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveMilestone, {});

    const [status, setStatus] = useState<CrmMilestoneStatus>(
        initialData?.status ?? 'planned',
    );
    const [priority, setPriority] = useState<CrmMilestonePriority>(
        initialData?.priority ?? 'medium',
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

    const tagsInitial = Array.isArray(initialData?.tags)
        ? (initialData?.tags ?? []).join(', ')
        : '';

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="milestoneId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="priority" value={priority} />

                {/* Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        defaultValue={initialData?.name ?? ''}
                        placeholder="e.g. Beta launch"
                    />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={3}
                        defaultValue={initialData?.description ?? ''}
                        placeholder="What does reaching this milestone mean?"
                    />
                </div>

                {/* Project + parent */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Project</Label>
                        <EntityFormField
                            entity="project"
                            name="projectId"
                            initialId={initialData?.projectId}
                            placeholder="Pick a project"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Parent milestone</Label>
                        {/* TODO 1E.sweep: no `milestone` entity in lookup-registry — falling
                            back to free-text id input. Promote once a milestone lookup
                            adapter exists. */}
                        <Input
                            id="parentId"
                            name="parentId"
                            placeholder="Optional — parent milestone id"
                            defaultValue={initialData?.parentId ?? ''}
                        />
                    </div>
                </div>

                {/* Dates */}
                <div className="grid gap-4 sm:grid-cols-2">
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
                        <Label htmlFor="completedAt">Completed on</Label>
                        <Input
                            id="completedAt"
                            name="completedAt"
                            type="date"
                            defaultValue={toDateInput(initialData?.completedAt)}
                        />
                    </div>
                </div>

                {/* Progress + Priority */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="progress">Progress (%)</Label>
                        <Input
                            id="progress"
                            name="progress"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="0"
                            defaultValue={
                                initialData?.progress != null
                                    ? String(initialData.progress)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Priority</Label>
                        <EnumFormField
                            enumName="priorityMedium"
                            name="priorityPicker"
                            initialId={priority}
                            placeholder="Priority"
                            onChange={(next) =>
                                setPriority((next ?? 'medium') as CrmMilestonePriority)
                            }
                        />
                    </div>
                </div>

                {/* Status + Owner */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="milestoneStatus"
                            name="statusPicker"
                            initialId={status}
                            placeholder="Status"
                            onChange={(next) =>
                                setStatus((next ?? 'planned') as CrmMilestoneStatus)
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Owner</Label>
                        <EntityFormField
                            entity="employee"
                            name="ownerId"
                            initialId={initialData?.ownerId}
                            placeholder="Pick an owner"
                        />
                    </div>
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                        id="tags"
                        name="tags"
                        placeholder="comma, separated, tags"
                        defaultValue={tagsInitial}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to milestones
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}

export default MilestoneForm;
