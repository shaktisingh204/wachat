'use client';

// TODO 1E.sweep: status -> <EnumFormField enumName="goalStatus">; owner/employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <GoalForm /> — create + edit form for performance goals.
 *
 * Binds to the `saveGoal` server action via `useActionState`. The form
 * is a flat field set — no nested arrays — so it submits as plain
 * FormData with hidden inputs for the controlled `<ZoruSelect>` values.
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
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

import { saveGoal } from '@/app/actions/crm-goals.actions';
import type { CrmGoalDoc, CrmGoalStatus } from '@/lib/rust-client/crm-goals';

import { STATUS_OPTIONS } from '../_config';

const BASE = '/dashboard/hrm/payroll/goal-setting';

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
            {isEditing ? 'Save changes' : 'Create goal'}
        </ZoruButton>
    );
}

interface GoalFormProps {
    initialData?: CrmGoalDoc | null;
}

export function GoalForm({ initialData }: GoalFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveGoal, initialState);

    const [status, setStatus] = useState<CrmGoalStatus>(
        (initialData?.status as CrmGoalStatus) ?? 'draft',
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

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="goalId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Title */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="title">Title *</ZoruLabel>
                    <ZoruInput
                        id="title"
                        name="title"
                        required
                        placeholder="e.g. Increase NPS by 10 points this quarter"
                        defaultValue={initialData?.title ?? ''}
                    />
                </div>

                {/* Row 2: Description */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="Optional — describe the goal in detail."
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 3: Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee id</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            placeholder="Optional"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            placeholder="Display name"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 4: Period + KPI */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="period">Period</ZoruLabel>
                        <ZoruInput
                            id="period"
                            name="period"
                            placeholder="e.g. 2026-Q2 / FY 25-26"
                            defaultValue={initialData?.period ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="kpi">Linked KPI</ZoruLabel>
                        <ZoruInput
                            id="kpi"
                            name="kpi"
                            placeholder="Optional — KPI id or name"
                            defaultValue={initialData?.kpi ?? ''}
                        />
                    </div>
                </div>

                {/* Row 5: Target + Achieved */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="target">Target</ZoruLabel>
                        <ZoruInput
                            id="target"
                            name="target"
                            placeholder="e.g. NPS 80"
                            defaultValue={initialData?.target ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="achieved">Achieved</ZoruLabel>
                        <ZoruInput
                            id="achieved"
                            name="achieved"
                            placeholder="e.g. NPS 62"
                            defaultValue={initialData?.achieved ?? ''}
                        />
                    </div>
                </div>

                {/* Row 6: Progress + Weight + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="progress">Progress %</ZoruLabel>
                        <ZoruInput
                            id="progress"
                            name="progress"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="0–100"
                            defaultValue={
                                typeof initialData?.progress === 'number'
                                    ? String(initialData.progress)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="weight">Weight %</ZoruLabel>
                        <ZoruInput
                            id="weight"
                            name="weight"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="0–100"
                            defaultValue={
                                typeof initialData?.weight === 'number'
                                    ? String(initialData.weight)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmGoalStatus)}
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
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to goals
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
