'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create asset'}
        </Button>
    );
}

export function AssetForm({ initialData }: AssetFormProps) {
    const router = useRouter();
    const { toast } = useToast();
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
        <Card className="p-6">
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
                        <Label htmlFor="assetTag">Asset tag *</Label>
                        <Input
                            id="assetTag"
                            name="assetTag"
                            required
                            placeholder="e.g. LAP-0421"
                            defaultValue={initialData?.assetTag ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Name *</Label>
                        <Input
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
                        <Label>Category</Label>
                        <EnumFormField
                            name="category-picker"
                            enumName="assetCategory"
                            initialId={category}
                            onChange={(id) => setCategory(id ?? 'laptop')}
                            placeholder="Pick a category"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="brand">Brand</Label>
                        <Input id="brand" name="brand" defaultValue={initialData?.brand ?? ''} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="model">Model</Label>
                        <Input id="model" name="model" defaultValue={initialData?.model ?? ''} />
                    </div>
                </div>

                {/* Row 3: Serial + Location + Branch */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="serialNumber">Serial number</Label>
                        <Input
                            id="serialNumber"
                            name="serialNumber"
                            defaultValue={initialData?.serialNumber ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="location">Location</Label>
                        <Input
                            id="location"
                            name="location"
                            defaultValue={initialData?.location ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="branchId">Branch id</Label>
                        <Input
                            id="branchId"
                            name="branchId"
                            defaultValue={initialData?.branchId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 4: Purchase date + price + currency */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="purchaseDate">Purchase date</Label>
                        <Input
                            id="purchaseDate"
                            name="purchaseDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.purchaseDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="purchasePrice">Purchase price</Label>
                        <Input
                            id="purchasePrice"
                            name="purchasePrice"
                            type="number"
                            step="0.01"
                            defaultValue={initialData?.purchasePrice ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="currency">Currency</Label>
                        <Input
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
                        <Label htmlFor="warrantyExpiry">Warranty expiry</Label>
                        <Input
                            id="warrantyExpiry"
                            name="warrantyExpiry"
                            type="date"
                            defaultValue={toDateInput(initialData?.warrantyExpiry)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Condition</Label>
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
                        <Label>Status</Label>
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
                        <Label htmlFor="currentAssigneeId">Current assignee id</Label>
                        <Input
                            id="currentAssigneeId"
                            name="currentAssigneeId"
                            placeholder="Optional employee id"
                            defaultValue={initialData?.currentAssigneeId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="currentAssigneeName">Current assignee name</Label>
                        <Input
                            id="currentAssigneeName"
                            name="currentAssigneeName"
                            defaultValue={initialData?.currentAssigneeName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 7: Tags + Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                        id="tags"
                        name="tags"
                        placeholder="comma, separated, tags"
                        defaultValue={tagsInitial}
                    />
                </div>

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
                            Back to assets
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
