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

// 1E.sweep done — category/condition/status converted to <EnumFormField>
// using `assetCategory` / `assetCondition` / `assetStatus`. assignee
// fields stay as text inputs for now — TODO 1E.sweep: convert
// `currentAssigneeId` -> <EntityFormField entity="employee">.

/**
 * <AssetForm /> — create + edit form for HR assets.
 *
 * Binds to the `saveAsset` server action via `useActionState`. ZoruUI
 * throughout. No file picker here (the asset record has no document
 * field); attachments live on asset assignments / repair tickets.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveAsset } from '@/app/actions/crm-assets.actions';
import type {
    CrmAssetDoc,
    CrmAssetStatus,
} from '@/lib/rust-client/crm-assets';

const BASE = '/dashboard/hrm/hr/assets';

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface AssetFormProps {
    initialData?: CrmAssetDoc | null;
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
            {isEditing ? 'Save changes' : 'Create asset'}
        </ZoruButton>
    );
}

export function AssetForm({ initialData }: AssetFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveAsset, initialState);

    const [category, setCategory] = useState<string>(
        (initialData?.category as string) ?? 'laptop',
    );
    const [condition, setCondition] = useState<string>(
        (initialData?.condition as string) ?? 'good',
    );
    const [status, setStatus] = useState<CrmAssetStatus>(
        (initialData?.status as CrmAssetStatus) ?? 'available',
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

    const tagsInitial = Array.isArray(initialData?.tags)
        ? (initialData?.tags ?? []).join(', ')
        : '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="assetId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="category" value={category} />
                <input type="hidden" name="condition" value={condition} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Asset tag + Name */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="assetTag">Asset tag *</ZoruLabel>
                        <ZoruInput
                            id="assetTag"
                            name="assetTag"
                            required
                            placeholder="e.g. LAP-0421"
                            defaultValue={initialData?.assetTag ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                        <ZoruInput
                            id="name"
                            name="name"
                            required
                            placeholder="MacBook Pro 14"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Category + Brand + Model */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel>Category</ZoruLabel>
                        <EnumFormField
                            name="category-picker"
                            enumName="assetCategory"
                            initialId={category}
                            onChange={(id) => setCategory(id ?? 'laptop')}
                            placeholder="Pick a category"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="brand">Brand</ZoruLabel>
                        <ZoruInput id="brand" name="brand" defaultValue={initialData?.brand ?? ''} />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="model">Model</ZoruLabel>
                        <ZoruInput id="model" name="model" defaultValue={initialData?.model ?? ''} />
                    </div>
                </div>

                {/* Row 3: Serial + Location + Branch */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="serialNumber">Serial number</ZoruLabel>
                        <ZoruInput
                            id="serialNumber"
                            name="serialNumber"
                            defaultValue={initialData?.serialNumber ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="location">Location</ZoruLabel>
                        <ZoruInput
                            id="location"
                            name="location"
                            defaultValue={initialData?.location ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="branchId">Branch id</ZoruLabel>
                        <ZoruInput
                            id="branchId"
                            name="branchId"
                            defaultValue={initialData?.branchId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 4: Purchase date + price + currency */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="purchaseDate">Purchase date</ZoruLabel>
                        <ZoruInput
                            id="purchaseDate"
                            name="purchaseDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.purchaseDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="purchasePrice">Purchase price</ZoruLabel>
                        <ZoruInput
                            id="purchasePrice"
                            name="purchasePrice"
                            type="number"
                            step="0.01"
                            defaultValue={initialData?.purchasePrice ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
                        <ZoruInput
                            id="currency"
                            name="currency"
                            placeholder="INR"
                            defaultValue={initialData?.currency ?? 'INR'}
                        />
                    </div>
                </div>

                {/* Row 5: Warranty + Condition + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="warrantyExpiry">Warranty expiry</ZoruLabel>
                        <ZoruInput
                            id="warrantyExpiry"
                            name="warrantyExpiry"
                            type="date"
                            defaultValue={toDateInput(initialData?.warrantyExpiry)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Condition</ZoruLabel>
                        <EnumFormField
                            name="condition-picker"
                            enumName="assetCondition"
                            initialId={condition}
                            onChange={(id) => setCondition(id ?? 'good')}
                            allowInlineCreate={false}
                            placeholder="Condition"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            name="status-picker"
                            enumName="assetStatus"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id as CrmAssetStatus) ?? 'available')
                            }
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 6: Assignee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="currentAssigneeId">Current assignee id</ZoruLabel>
                        <ZoruInput
                            id="currentAssigneeId"
                            name="currentAssigneeId"
                            placeholder="Optional employee id"
                            defaultValue={initialData?.currentAssigneeId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="currentAssigneeName">Current assignee name</ZoruLabel>
                        <ZoruInput
                            id="currentAssigneeName"
                            name="currentAssigneeName"
                            defaultValue={initialData?.currentAssigneeName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 7: Tags + Notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                    <ZoruInput
                        id="tags"
                        name="tags"
                        placeholder="comma, separated, tags"
                        defaultValue={tagsInitial}
                    />
                </div>

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
                            Back to assets
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
