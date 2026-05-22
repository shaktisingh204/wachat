'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter,
  useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <AssetAssignmentForm /> — create + edit form for asset assignments.
 *
 * Binds to `saveAssetAssignment` via `useActionState`. Pre-fills from
 * URL search params when launched via /new?assetId=… (asset detail page
 * "Assign" CTA).
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';

import { saveAssetAssignment } from '@/app/actions/crm-asset-assignments.actions';
import type {
    CrmAssetAssignmentDoc,
    CrmAssetAssignmentStatus,
} from '@/app/actions/crm-asset-assignments.actions';

const BASE = '/dashboard/hrm/hr/asset-assignments';

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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create assignment'}
        </Button>
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
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="assignmentId" value={initialData!._id} />
                ) : null}

                {/* Row 1: Asset (entity picker dual-writes asset_name for legacy callers) */}
                <div className="space-y-1.5">
                    <Label>Asset *</Label>
                    <EntityFormField
                        entity="asset"
                        name="asset_id"
                        dualWriteName="asset_name"
                        initialId={initialData?.asset_id ?? prefilledAssetId ?? null}
                        initialLabel={
                            initialData?.asset_name ?? prefilledAssetName ?? ''
                        }
                        allowCreate
                        placeholder="Select asset"
                        required
                    />
                </div>

                {/* Row 2: Employee (entity picker dual-writes employee_name) */}
                <div className="space-y-1.5">
                    <Label>Employee *</Label>
                    <EntityFormField
                        entity="employee"
                        name="employee_id"
                        dualWriteName="employee_name"
                        initialId={initialData?.employee_id ?? null}
                        initialLabel={initialData?.employee_name ?? ''}
                        allowCreate
                        placeholder="Select employee"
                        required
                    />
                </div>

                {/* Row 3: Dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="assigned_at">Assigned at</Label>
                        <Input
                            id="assigned_at"
                            name="assigned_at"
                            type="date"
                            defaultValue={toDateInput(initialData?.assigned_at)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="returned_at">Returned at</Label>
                        <Input
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
                        <Label>Condition at assign</Label>
                        <EnumFormField
                            enumName="assetCondition"
                            name="condition_at_assign"
                            initialId={conditionAssign}
                            onChange={(id) => setConditionAssign(id ?? 'good')}
                            placeholder="Condition"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Condition at return</Label>
                        <EnumFormField
                            enumName="assetCondition"
                            name="condition_at_return"
                            initialId={conditionReturn || null}
                            onChange={(id) => setConditionReturn(id ?? '')}
                            placeholder="Condition at return"
                        />
                    </div>
                </div>

                {/* Row 5: Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        {/* TODO 1E.sweep: catalogued assetAssignmentStatus has 'active'+'pending' but this form uses 'assigned' — bridge or extend before enabling inline-create. */}
                        <EnumFormField
                            enumName="assetAssignmentStatus"
                            name="status"
                            initialId={status === 'assigned' ? 'active' : status}
                            onChange={(id) => {
                                const mapped =
                                    id === 'active'
                                        ? 'assigned'
                                        : (id as CrmAssetAssignmentStatus);
                                setStatus(mapped ?? 'assigned');
                            }}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 6: Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to assignments
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
