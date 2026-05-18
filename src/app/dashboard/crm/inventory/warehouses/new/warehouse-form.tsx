'use client';

/**
 * §1D Warehouse form — reused for both `/new` and `/[id]/edit`.
 *
 * Composition: `<EntityFormShell>` with sections:
 *   - Basic (name, code, type, status)
 *   - Address (country → state → city cascade + address line + pincode)
 *   - Tax (GSTIN)
 *   - Manager (employee picker + phone)
 *   - Capacity (units / sqft / climate flag)
 *   - Default flag
 *
 * Every entity ref goes through `<EntityFormField>`. FormData keys
 * preserve the legacy `saveCrmWarehouse` contract (`name`, `isDefault`,
 * and the legacy `location` alias for `address`).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
    ZoruCheckbox,
    ZoruInput,
    ZoruLabel,
    useZoruToast,
} from '@/components/zoruui';
import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveCrmWarehouse } from '@/app/actions/crm-warehouses.actions';
import type { CrmWarehouse } from '@/lib/definitions';

export interface WarehouseFormProps {
    initialData?: Partial<CrmWarehouse> & { _id?: string };
}

export function WarehouseForm({ initialData }: WarehouseFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();

    const [country, setCountry] = React.useState<string>(
        (initialData?.country as string) || '',
    );
    const [stateVal, setStateVal] = React.useState<string>(
        (initialData?.state as string) || '',
    );
    const [city, setCity] = React.useState<string>(
        (initialData?.city as string) || '',
    );
    const [error, setError] = React.useState<string | undefined>();

    const handleAction = async (formData: FormData) => {
        const res = await saveCrmWarehouse(null, formData);
        if (res.error) {
            setError(res.error);
            toast({
                title: 'Save failed',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        toast({
            title: 'Saved',
            description: res.message ?? 'Warehouse saved.',
        });
        router.push('/dashboard/crm/inventory/warehouses');
    };

    const hiddenInputs = (
        <>
            <input
                type="hidden"
                name="warehouseId"
                value={initialData?._id || ''}
            />
            {/* Mirror cascade state through hidden inputs so the action sees
                fresh values even when the user only touched the picker. */}
            <input type="hidden" name="country" value={country} />
            <input type="hidden" name="state" value={stateVal} />
            <input type="hidden" name="city" value={city} />
        </>
    );

    return (
        <EntityFormShell
            title={initialData?._id ? 'Edit Warehouse' : 'New Warehouse'}
            subtitle="Storage location with manager, capacity and default flag."
            action={handleAction}
            cancelHref="/dashboard/crm/inventory/warehouses"
            submitLabel={initialData?._id ? 'Save changes' : 'Create warehouse'}
            error={error}
            hiddenInputs={hiddenInputs}
            sections={[
                {
                    id: 'basic',
                    title: 'Basic',
                    description: 'Identifier, name and classification.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="name">Warehouse name *</ZoruLabel>
                                <ZoruInput
                                    id="name"
                                    name="name"
                                    defaultValue={initialData?.name ?? ''}
                                    placeholder="e.g. Main Warehouse"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="code">Code</ZoruLabel>
                                <ZoruInput
                                    id="code"
                                    name="code"
                                    defaultValue={initialData?.code ?? ''}
                                    placeholder="e.g. WH-01"
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="type">Type</ZoruLabel>
                                <EnumFormField
                                    enumName="warehouseType"
                                    name="type"
                                    initialId={(initialData?.type as string) || 'main'}
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="status">Status</ZoruLabel>
                                <EnumFormField
                                    enumName="warehouseStatus"
                                    name="status"
                                    initialId={(initialData?.status as string) || 'active'}
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'address',
                    title: 'Address',
                    description: 'Geography cascade: country → state → city.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-1 md:col-span-3">
                                <ZoruLabel htmlFor="address">Street address</ZoruLabel>
                                <ZoruInput
                                    id="address"
                                    name="address"
                                    defaultValue={initialData?.address ?? ''}
                                    placeholder="123 Storage Lane"
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel>Country</ZoruLabel>
                                <EntityFormField
                                    entity="country"
                                    name="countryPicker"
                                    initialId={country || null}
                                    onChange={(next) => {
                                        setCountry(next ?? '');
                                        setStateVal('');
                                        setCity('');
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel>State</ZoruLabel>
                                <EntityFormField
                                    entity="state"
                                    name="statePicker"
                                    initialId={stateVal || null}
                                    filter={country ? { country } : undefined}
                                    disabled={!country}
                                    onChange={(next) => {
                                        setStateVal(next ?? '');
                                        setCity('');
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel>City</ZoruLabel>
                                <EntityFormField
                                    entity="city"
                                    name="cityPicker"
                                    initialId={city || null}
                                    filter={
                                        stateVal
                                            ? { state: stateVal }
                                            : country
                                              ? { country }
                                              : undefined
                                    }
                                    disabled={!country}
                                    onChange={(next) => setCity(next ?? '')}
                                />
                            </div>
                            <div className="space-y-1 md:col-span-3">
                                <ZoruLabel htmlFor="pincode">Pincode</ZoruLabel>
                                <ZoruInput
                                    id="pincode"
                                    name="pincode"
                                    defaultValue={initialData?.pincode ?? ''}
                                    placeholder="560001"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'tax',
                    title: 'Tax',
                    description: 'Optional GST registration for this location.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="gstin">GSTIN</ZoruLabel>
                                <ZoruInput
                                    id="gstin"
                                    name="gstin"
                                    defaultValue={initialData?.gstin ?? ''}
                                    placeholder="27AAAPL1234C1ZV"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'manager',
                    title: 'Manager',
                    description: 'Person responsible for this warehouse.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <ZoruLabel>Manager (employee)</ZoruLabel>
                                <EntityFormField
                                    entity="employee"
                                    name="managerId"
                                    dualWriteName="managerName"
                                    initialId={
                                        initialData?.managerId
                                            ? String(initialData.managerId)
                                            : null
                                    }
                                    initialLabel={initialData?.managerName}
                                    placeholder="Pick an employee"
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="phone">Phone</ZoruLabel>
                                <ZoruInput
                                    id="phone"
                                    name="phone"
                                    defaultValue={initialData?.phone ?? ''}
                                    placeholder="+91 …"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'capacity',
                    title: 'Capacity',
                    description: 'Units and footprint.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="capacityUnits">
                                    Capacity (units)
                                </ZoruLabel>
                                <ZoruInput
                                    type="number"
                                    min={0}
                                    id="capacityUnits"
                                    name="capacityUnits"
                                    defaultValue={
                                        (initialData as any)?.capacityUnits ?? ''
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="capacitySqft">
                                    Footprint (sqft)
                                </ZoruLabel>
                                <ZoruInput
                                    type="number"
                                    min={0}
                                    id="capacitySqft"
                                    name="capacitySqft"
                                    defaultValue={
                                        (initialData as any)?.capacitySqft ?? ''
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-7">
                                <ZoruCheckbox
                                    id="climateControlled"
                                    name="climateControlled"
                                    defaultChecked={
                                        !!(initialData as any)?.climateControlled
                                    }
                                />
                                <ZoruLabel
                                    htmlFor="climateControlled"
                                    className="cursor-pointer"
                                >
                                    Climate-controlled
                                </ZoruLabel>
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'default',
                    title: 'Default',
                    description:
                        'Used for initial stock assignments and quick actions.',
                    children: (
                        <div className="flex items-center gap-2">
                            <ZoruCheckbox
                                id="isDefault"
                                name="isDefault"
                                defaultChecked={!!initialData?.isDefault}
                            />
                            <ZoruLabel htmlFor="isDefault" className="cursor-pointer">
                                Set as default warehouse
                            </ZoruLabel>
                        </div>
                    ),
                },
            ]}
        />
    );
}
