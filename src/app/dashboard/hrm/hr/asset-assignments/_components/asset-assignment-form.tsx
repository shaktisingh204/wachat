'use client';

/**
 * <AssetAssignmentForm /> — create + edit form for asset assignments.
 *
 * Binds to `saveAssetAssignment` via `useActionState`. Pre-fills from
 * URL search params when launched via /new?assetId=… (asset detail page
 * "Assign" CTA).
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

import { saveAssetAssignment } from '@/app/actions/crm-asset-assignments.actions';
import type {
    CrmAssetAssignmentDoc,
    CrmAssetAssignmentStatus,
    CrmAssetCondition,
} from '@/app/actions/crm-asset-assignments.actions';

const BASE = '/dashboard/hrm/hr/asset-assignments';

const STATUS_OPTIONS: Array<{ value: CrmAssetAssignmentStatus; label: string }> = [
    { value: 'assigned', label: 'Assigned' },
    { value: 'returned', label: 'Returned' },
    { value: 'lost', label: 'Lost' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'archived', label: 'Archived' },
];

const CONDITION_OPTIONS: Array<{ value: CrmAssetCondition; label: string }> = [
    { value: 'new', label: 'New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
    { value: 'damaged', label: 'Damaged' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface AssetAssignmentFormProps {
    initialData?: CrmAssetAssignmentDoc | null;
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
            {isEditing ? 'Save changes' : 'Create assignment'}
        </ZoruButton>
    );
}

export function AssetAssignmentForm({ initialData }: AssetAssignmentFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveAssetAssignment, initialState);

    const [conditionAssign, setConditionAssign] = useState<string>(
        (initialData?.condition_at_assign as string) ?? 'good',
    );
    const [conditionReturn, setConditionReturn] = useState<string>(
        (initialData?.condition_at_return as string) ?? '',
    );
    const [status, setStatus] = useState<CrmAssetAssignmentStatus>(
        (initialData?.status as CrmAssetAssignmentStatus) ?? 'assigned',
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, initialData?._id]);

    // Pre-fill from query when launching the form from an asset detail page.
    const prefilledAssetId = searchParams?.get('assetId') ?? '';
    const prefilledAssetName = searchParams?.get('assetName') ?? '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="assignmentId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="condition_at_assign" value={conditionAssign} />
                <input type="hidden" name="condition_at_return" value={conditionReturn} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Asset id + name */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="asset_id">Asset id *</ZoruLabel>
                        <ZoruInput
                            id="asset_id"
                            name="asset_id"
                            required
                            placeholder="Asset record id"
                            defaultValue={initialData?.asset_id ?? prefilledAssetId}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="asset_name">Asset name</ZoruLabel>
                        <ZoruInput
                            id="asset_name"
                            name="asset_name"
                            placeholder="Friendly display name"
                            defaultValue={initialData?.asset_name ?? prefilledAssetName}
                        />
                    </div>
                </div>

                {/* Row 2: Employee id + name */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employee_id">Employee id *</ZoruLabel>
                        <ZoruInput
                            id="employee_id"
                            name="employee_id"
                            required
                            placeholder="Employee record id"
                            defaultValue={initialData?.employee_id ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employee_name">Employee name</ZoruLabel>
                        <ZoruInput
                            id="employee_name"
                            name="employee_name"
                            placeholder="Friendly display name"
                            defaultValue={initialData?.employee_name ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="assigned_at">Assigned at</ZoruLabel>
                        <ZoruInput
                            id="assigned_at"
                            name="assigned_at"
                            type="date"
                            defaultValue={toDateInput(initialData?.assigned_at)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="returned_at">Returned at</ZoruLabel>
                        <ZoruInput
                            id="returned_at"
                            name="returned_at"
                            type="date"
                            defaultValue={toDateInput(initialData?.returned_at)}
                        />
                    </div>
                </div>

                {/* Row 4: Conditions */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="condition-assign-trigger">Condition at assign</ZoruLabel>
                        <ZoruSelect value={conditionAssign} onValueChange={setConditionAssign}>
                            <ZoruSelectTrigger id="condition-assign-trigger">
                                <ZoruSelectValue placeholder="Condition" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {CONDITION_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="condition-return-trigger">Condition at return</ZoruLabel>
                        <ZoruSelect
                            value={conditionReturn || 'unset'}
                            onValueChange={(v) => setConditionReturn(v === 'unset' ? '' : v)}
                        >
                            <ZoruSelectTrigger id="condition-return-trigger">
                                <ZoruSelectValue placeholder="—" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="unset">—</ZoruSelectItem>
                                {CONDITION_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                {/* Row 5: Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmAssetAssignmentStatus)}
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

                {/* Row 6: Notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to assignments
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
