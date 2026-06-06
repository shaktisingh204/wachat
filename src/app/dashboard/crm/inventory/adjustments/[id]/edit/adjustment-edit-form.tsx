'use client';

import { Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';

/**
 * §1D Stock-adjustment edit form.
 *
 * Quantity / product / warehouse stay immutable because they're tied
 * to the inventory mutation written at creation time. The form only
 * mutates `reason`, `referenceNumber`, and `notes` — same contract the
 * server `updateCrmStockAdjustment` action expects.
 */

import * as React from 'react';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { updateCrmStockAdjustment } from '@/app/actions/crm-inventory.actions';
import type { StockAdjustment } from '../types';

export interface AdjustmentEditFormProps {
    initial: StockAdjustment;
}

export function AdjustmentEditForm({ initial }: AdjustmentEditFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [error, setError] = React.useState<string | undefined>();

    const handleAction = async (formData: FormData) => {
        setError(undefined);
        const res = await updateCrmStockAdjustment(null, formData);
        if (res.error) {
            setError(res.error);
            toast({
                title: 'Save failed',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        toast({ title: 'Saved', description: res.message ?? 'Updated.' });
        router.push(`/dashboard/crm/inventory/adjustments/${initial._id}`);
    };

    return (
        <EntityFormShell
            title="Edit Stock Adjustment"
            subtitle={`Update the reason or notes for ${
                initial.adjustmentNumber ?? `#${initial._id.slice(-6)}`
            }.`}
            action={handleAction}
            cancelHref={`/dashboard/crm/inventory/adjustments/${initial._id}`}
            submitLabel="Save changes"
            error={error}
            hiddenInputs={
                <input type="hidden" name="adjustmentId" value={initial._id} />
            }
            sections={[
                {
                    id: 'locked',
                    title: 'Locked fields',
                    description:
                        'Quantity, product and warehouse are tied to the inventory mutation. Create a new adjustment to correct stock.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-3">
                            {initial.productName ? (
                                <div className="space-y-1">
                                    <Label>Product</Label>
                                    <Input
                                        defaultValue={initial.productName}
                                        disabled
                                    />
                                </div>
                            ) : null}
                            {initial.warehouseName ? (
                                <div className="space-y-1">
                                    <Label>Warehouse</Label>
                                    <Input
                                        defaultValue={initial.warehouseName}
                                        disabled
                                    />
                                </div>
                            ) : null}
                            <div className="space-y-1">
                                <Label>Quantity</Label>
                                <Input
                                    defaultValue={String(initial.quantity ?? 0)}
                                    disabled
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'editable',
                    title: 'Editable',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <Label htmlFor="reason">Reason *</Label>
                                <EnumFormField
                                    enumName="stockAdjustmentReason"
                                    name="reason"
                                    initialId={initial.reason}
                                    placeholder="Select reason"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="referenceNumber">
                                    Reference doc
                                </Label>
                                <Input
                                    id="referenceNumber"
                                    name="referenceNumber"
                                    defaultValue={initial.referenceNumber ?? ''}
                                    placeholder="e.g. internal memo #42"
                                />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    defaultValue={initial.notes ?? ''}
                                    rows={3}
                                />
                            </div>
                        </div>
                    ),
                },
            ]}
        />
    );
}
