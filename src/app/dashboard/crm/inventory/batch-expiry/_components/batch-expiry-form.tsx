'use client';

/**
 * <BatchExpiryForm /> — create + edit form for `crm_item_batches`.
 *
 * Mirrors the policies §1D form pattern: `useActionState` binds to the
 * `saveCrmItemBatch` server action; hidden `batchId` toggles create vs
 * edit semantics. No JSON paste anywhere — each field has its own
 * dedicated input. Item picker uses `<EntityFormField entity="item" />`
 * (dual-writes `itemName`), supplier uses `entity="vendor"`, location
 * uses `entity="warehouse"`.
 */

import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    saveCrmItemBatch,
    type CrmItemBatchDoc,
    type CrmItemBatchStatus,
} from '@/app/actions/crm-item-batches.actions';

const BASE = '/dashboard/crm/inventory/batch-expiry';

const STATUS_OPTIONS: Array<{ value: CrmItemBatchStatus; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'expired', label: 'Expired' },
    { value: 'recalled', label: 'Recalled' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

interface BatchExpiryFormProps {
    initialData?: CrmItemBatchDoc | null;
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
            {isEditing ? 'Save changes' : 'Create batch'}
        </ZoruButton>
    );
}

export function BatchExpiryForm({ initialData }: BatchExpiryFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveCrmItemBatch, initialState);

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
                    <input type="hidden" name="batchId" value={initialData!._id} />
                ) : null}

                {/* Row 1: Item picker + Batch number */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="itemId">Item *</ZoruLabel>
                        <EntityFormField
                            entity="item"
                            name="itemId"
                            dualWriteName="itemName"
                            initialId={initialData?.itemId ?? null}
                            initialLabel={initialData?.itemName ?? ''}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="batchNumber">Batch number *</ZoruLabel>
                        <ZoruInput
                            id="batchNumber"
                            name="batchNumber"
                            required
                            placeholder="e.g. B-2026-001"
                            defaultValue={initialData?.batchNumber ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Manufacture + Expiry */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="manufactureDate">Manufacture date</ZoruLabel>
                        <ZoruInput
                            id="manufactureDate"
                            name="manufactureDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.manufactureDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="expiryDate">Expiry date</ZoruLabel>
                        <ZoruInput
                            id="expiryDate"
                            name="expiryDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.expiryDate)}
                        />
                    </div>
                </div>

                {/* Row 3: Quantity + Unit + Cost */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="quantity">Quantity *</ZoruLabel>
                        <ZoruInput
                            id="quantity"
                            name="quantity"
                            type="number"
                            min={0}
                            step="any"
                            required
                            defaultValue={initialData?.quantity ?? 0}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="unit">Unit</ZoruLabel>
                        <ZoruInput
                            id="unit"
                            name="unit"
                            placeholder="e.g. PCS, KG, L"
                            defaultValue={initialData?.unit ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="costPrice">Cost price</ZoruLabel>
                        <ZoruInput
                            id="costPrice"
                            name="costPrice"
                            type="number"
                            min={0}
                            step="any"
                            defaultValue={initialData?.costPrice ?? ''}
                        />
                    </div>
                </div>

                {/* Row 4: Location + Supplier */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="locationId">Location (warehouse)</ZoruLabel>
                        <EntityFormField
                            entity="warehouse"
                            name="locationId"
                            initialId={initialData?.locationId ?? null}
                            placeholder="Pick a warehouse…"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="supplierId">Supplier</ZoruLabel>
                        <EntityFormField
                            entity="vendor"
                            name="supplierId"
                            initialId={initialData?.supplierId ?? null}
                            placeholder="Pick a supplier…"
                        />
                    </div>
                </div>

                {/* Row 5: Status + Notes */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status">Status</ZoruLabel>
                        <EnumFormField
                            enumName="itemBatchStatus"
                            name="status"
                            initialId={initialData?.status ?? 'active'}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            rows={2}
                            placeholder="Storage notes, COA references…"
                            defaultValue={initialData?.notes ?? ''}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to batches
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
