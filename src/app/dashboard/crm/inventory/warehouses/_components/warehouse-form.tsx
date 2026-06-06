'use client';

import { Button, Card, Checkbox, Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <WarehouseForm /> — canonical create + edit form for CRM warehouses.
 *
 * Binds to `saveCrmWarehouse` via `useActionState`. Hidden `warehouseId`
 * toggles create vs edit. Manager field uses
 * `<EntityFormField entity="employee" />` (dual-writes `managerName`).
 *
 * Fields: name · code · address (city/state/country/pincode optional) ·
 * managerId+managerName · capacityUnits · contact phone · status ·
 * isActive (mirrored to status when set).
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveCrmWarehouse } from '@/app/actions/crm-warehouses.actions';
import type { CrmWarehouse } from '@/lib/definitions';

const BASE = '/dashboard/crm/inventory/warehouses';

interface WarehouseFormProps {
    initialData?: CrmWarehouse | null;
}

type SaveState = {
    message?: string;
    error?: string;
    warehouse?: CrmWarehouse;
};
const initialState: SaveState = {};

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'archived', label: 'Archived' },
] as const;

const TYPE_OPTIONS = [
    { value: 'main', label: 'Main' },
    { value: 'branch', label: 'Branch' },
    { value: 'franchise', label: 'Franchise' },
    { value: '3pl', label: '3PL' },
    { value: 'virtual', label: 'Virtual' },
] as const;

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create warehouse'}
        </Button>
    );
}

export function WarehouseForm({ initialData }: WarehouseFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveCrmWarehouse, initialState);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id =
                (state.warehouse?._id as unknown as string) ?? initialData?._id;
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
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="warehouseId"
                        value={String(initialData!._id)}
                    />
                ) : null}

                {/* Row 1: Name + Code */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Mumbai Main"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="code">Code</Label>
                        <Input
                            id="code"
                            name="code"
                            placeholder="e.g. WH-MUM-01"
                            defaultValue={initialData?.code ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Type + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="type">Type</Label>
                        <EnumFormField
                            enumName="warehouseType"
                            name="type"
                            initialId={initialData?.type ?? 'main'}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status">Status</Label>
                        <EnumFormField
                            enumName="warehouseStatus"
                            name="status"
                            initialId={initialData?.status ?? 'active'}
                        />
                    </div>
                </div>

                {/* Row 3: Address (full) */}
                <div className="space-y-1.5">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                        id="address"
                        name="address"
                        rows={2}
                        placeholder="Street, area, landmark…"
                        defaultValue={initialData?.address ?? ''}
                    />
                </div>

                {/* Row 4: City / State / Country / Pincode */}
                <div className="grid gap-4 sm:grid-cols-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="city">City</Label>
                        <Input
                            id="city"
                            name="city"
                            defaultValue={initialData?.city ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="state">State</Label>
                        <Input
                            id="state"
                            name="state"
                            defaultValue={initialData?.state ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="country">Country</Label>
                        <Input
                            id="country"
                            name="country"
                            defaultValue={initialData?.country ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="pincode">Pincode</Label>
                        <Input
                            id="pincode"
                            name="pincode"
                            defaultValue={initialData?.pincode ?? ''}
                        />
                    </div>
                </div>

                {/* Row 5: Manager picker + Manager name + Phone */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="managerId">Manager</Label>
                        <EntityFormField
                            entity="employee"
                            name="managerId"
                            dualWriteName="managerName"
                            initialId={
                                (initialData?.managerId as unknown as string) ?? null
                            }
                            initialLabel={initialData?.managerName ?? ''}
                            placeholder="Pick a manager…"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="phone">Contact phone</Label>
                        <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            placeholder="+91…"
                            defaultValue={initialData?.phone ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="gstin">GSTIN</Label>
                        <Input
                            id="gstin"
                            name="gstin"
                            placeholder="22AAAAA0000A1Z5"
                            defaultValue={initialData?.gstin ?? ''}
                        />
                    </div>
                </div>

                {/* Row 6: Capacity */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="capacityUnits">Capacity (units)</Label>
                        <Input
                            id="capacityUnits"
                            name="capacityUnits"
                            type="number"
                            min={0}
                            step="any"
                            defaultValue={
                                (initialData?.capacityUnits as
                                    | number
                                    | undefined) ?? ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="capacitySqft">Capacity (sqft)</Label>
                        <Input
                            id="capacitySqft"
                            name="capacitySqft"
                            type="number"
                            min={0}
                            step="any"
                            defaultValue={
                                (initialData?.capacitySqft as
                                    | number
                                    | undefined) ?? ''
                            }
                        />
                    </div>
                </div>

                {/* Row 7: Flags */}
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="climateControlled"
                            name="climateControlled"
                            defaultChecked={!!initialData?.climateControlled}
                        />
                        <Label
                            htmlFor="climateControlled"
                            className="cursor-pointer"
                        >
                            Climate-controlled
                        </Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="isDefault"
                            name="isDefault"
                            defaultChecked={!!initialData?.isDefault}
                        />
                        <Label htmlFor="isDefault" className="cursor-pointer">
                            Default warehouse
                        </Label>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to warehouses
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
