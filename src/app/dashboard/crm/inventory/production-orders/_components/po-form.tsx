'use client';

import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Save } from 'lucide-react';

/**
 * <PoForm> — production-order form per §1D.3.
 *
 * Sections:
 *   1. Header (PO #, BOM picker, planned qty, output unit, finished good)
 *   2. Schedule (start, end, machine, operator)
 *   3. Notes + status
 *
 * Smart defaults:
 *   • `?bomId=` pre-selects the BOM picker and pre-fills finished good,
 *     unit, output qty, components and cost rollups via a server action.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    getBomPrefillForProductionOrder,
    saveProductionOrder,
} from '@/app/actions/crm-production-orders.actions';
import type { CrmBomComponent } from '@/app/actions/crm-bom.actions.types';
const INITIAL_STATE = { message: '', error: '', id: '' };

export interface PoFormInitial {
    _id?: string;
    orderNo?: string;
    bomRef?: string;
    bomId?: string;
    finishedGoodId?: string;
    finishedGoodName?: string;
    plannedQty?: number;
    unit?: string;
    plannedStart?: string;
    plannedEnd?: string;
    machineId?: string;
    machineOperator?: string;
    machineOperatorId?: string;
    notes?: string;
    status?: string;
    components?: CrmBomComponent[];
    labourCost?: number;
    overheadCost?: number;
}

export interface PoFormProps {
    initial?: PoFormInitial;
}

function toDateTimeInput(value: string | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {label}
        </Button>
    );
}

export function PoForm({ initial }: PoFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const prefillBomId = searchParams?.get('bomId') ?? '';

    const editing = !!initial?._id;
    const [state, formAction] = React.useActionState(saveProductionOrder, INITIAL_STATE);

    /* BOM-derived prefill state */
    const [bomId, setBomId] = React.useState<string>(initial?.bomId ?? prefillBomId ?? '');
    const [finishedGoodId, setFinishedGoodId] = React.useState<string>(
        initial?.finishedGoodId ?? '',
    );
    const [finishedGoodName, setFinishedGoodName] = React.useState<string>(
        initial?.finishedGoodName ?? '',
    );
    const [unitLabel, setUnitLabel] = React.useState<string>(initial?.unit ?? '');
    const [components, setComponents] = React.useState<CrmBomComponent[]>(
        initial?.components ?? [],
    );
    const [labourCost, setLabourCost] = React.useState<number>(initial?.labourCost ?? 0);
    const [overheadCost, setOverheadCost] = React.useState<number>(initial?.overheadCost ?? 0);
    const [plannedQty, setPlannedQty] = React.useState<number>(initial?.plannedQty ?? 1);

    /* Auto-prefill when BOM changes */
    React.useEffect(() => {
        if (!bomId) return;
        let cancelled = false;
        getBomPrefillForProductionOrder(bomId).then((data) => {
            if (cancelled || !data) return;
            if (!finishedGoodId && data.finishedGoodId) {
                setFinishedGoodId(data.finishedGoodId);
            }
            if (!finishedGoodName && data.finishedGoodName) {
                setFinishedGoodName(data.finishedGoodName);
            }
            if (!unitLabel && data.unit) setUnitLabel(data.unit);
            if (components.length === 0 && data.components) setComponents(data.components);
            if (data.labourCost && labourCost === 0) setLabourCost(data.labourCost);
            if (data.overheadCost && overheadCost === 0) setOverheadCost(data.overheadCost);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bomId]);

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            const target = editing
                ? `/dashboard/crm/inventory/production-orders/${initial?._id ?? ''}`
                : state.id
                  ? `/dashboard/crm/inventory/production-orders/${state.id}`
                  : '/dashboard/crm/inventory/production-orders';
            router.push(target);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, editing, initial?._id]);

    /* Live cost rollup preview */
    const materialCost = React.useMemo(
        () =>
            components.reduce(
                (sum, c) => sum + (c.qty || 0) * (c.costPerUnit ?? 0),
                0,
            ),
        [components],
    );
    const totalCost = materialCost + (labourCost || 0) + (overheadCost || 0);

    return (
        <form action={formAction} className="flex w-full flex-col gap-6">
            {editing ? <input type="hidden" name="orderId" value={initial?._id ?? ''} /> : null}
            <input type="hidden" name="bomId" value={bomId} />
            <input type="hidden" name="components" value={JSON.stringify(components)} />
            <input type="hidden" name="labourCost" value={String(labourCost || 0)} />
            <input type="hidden" name="overheadCost" value={String(overheadCost || 0)} />

            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[var(--st-text)]">
                        {editing ? 'Edit Production Order' : 'New Production Order'}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
                        {editing
                            ? 'Update job-card details, schedule and notes.'
                            : 'Create a manufacturing job card. Pick a BOM to auto-populate components.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link
                            href={
                                editing
                                    ? `/dashboard/crm/inventory/production-orders/${initial?._id ?? ''}`
                                    : '/dashboard/crm/inventory/production-orders'
                            }
                        >
                            Cancel
                        </Link>
                    </Button>
                    <SubmitButton label={editing ? 'Save changes' : 'Create order'} />
                </div>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Header</CardTitle>
                    <CardDescription>Pick a BOM to auto-populate components.</CardDescription>
                </CardHeader>
                <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                        <Label htmlFor="orderNo">PO #</Label>
                        <Input
                            id="orderNo"
                            name="orderNo"
                            defaultValue={initial?.orderNo ?? ''}
                            placeholder="Auto-generated"
                            maxLength={64}
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="bomRef">BOM</Label>
                        <Input
                            id="bomRef"
                            name="bomRef"
                            value={bomId}
                            onChange={(e) => setBomId(e.target.value)}
                            placeholder="BOM id or reference"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="finishedGoodId">Finished good *</Label>
                        <EntityFormField
                            entity="item"
                            name="finishedGoodId"
                            dualWriteName="finishedGoodName"
                            initialId={finishedGoodId || null}
                            initialLabel={finishedGoodName}
                            required
                            onChange={(id, hydrated) => {
                                setFinishedGoodId(id ?? '');
                                if (hydrated?.chip.primary) {
                                    setFinishedGoodName(hydrated.chip.primary);
                                }
                            }}
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="plannedQty">Planned qty *</Label>
                        <Input
                            id="plannedQty"
                            name="plannedQty"
                            type="number"
                            required
                            min={0}
                            step="any"
                            value={plannedQty}
                            onChange={(e) => setPlannedQty(parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 100"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="unit">Output unit</Label>
                        <EntityFormField
                            entity="unit"
                            name="unit"
                            initialLabel={unitLabel}
                            placeholder="e.g. PCS / KG"
                            onChange={(_id, hydrated) =>
                                setUnitLabel(hydrated?.chip.primary ?? '')
                            }
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="status">Status</Label>
                        <EnumFormField
                            enumName="productionOrderStatus"
                            name="status"
                            initialId={initial?.status ?? 'planned'}
                        />
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Schedule</CardTitle>
                </CardHeader>
                <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                        <Label htmlFor="plannedStart">Planned start</Label>
                        <Input
                            id="plannedStart"
                            name="plannedStart"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(initial?.plannedStart)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="plannedEnd">Planned end</Label>
                        <Input
                            id="plannedEnd"
                            name="plannedEnd"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(initial?.plannedEnd)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="machineId">Machine / line</Label>
                        <Input
                            id="machineId"
                            name="machineId"
                            defaultValue={initial?.machineId ?? ''}
                            placeholder="e.g. Line A"
                            maxLength={100}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Operator</Label>
                        <EntityFormField
                            entity="employee"
                            name="machineOperatorId"
                            dualWriteName="machineOperator"
                            initialId={initial?.machineOperatorId || null}
                            initialLabel={initial?.machineOperator ?? ''}
                            placeholder="Pick an operator…"
                        />
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Notes & cost preview</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                    <Textarea
                        name="notes"
                        defaultValue={initial?.notes ?? ''}
                        placeholder="Downtime considerations, scheduling notes, quality remarks…"
                        rows={3}
                    />
                    {components.length > 0 ? (
                        <div className="rounded border border-[var(--st-border)] p-3 text-[12.5px]">
                            <div className="mb-1 font-medium text-[var(--st-text)]">
                                Components from BOM ({components.length})
                            </div>
                            <ul className="grid grid-cols-1 gap-y-1 text-[var(--st-text-secondary)] md:grid-cols-2">
                                {components.map((c, i) => (
                                    <li key={`${c.itemName}-${i}`} className="truncate">
                                        {c.itemName} — {c.qty} {c.unit ?? ''}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div>
                            <Label>Material cost</Label>
                            <div className="font-mono text-[13px] text-[var(--st-text)]">
                                {materialCost.toLocaleString('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 2,
                                })}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="labourCostInput">Labour cost</Label>
                            <Input
                                id="labourCostInput"
                                type="number"
                                min={0}
                                step="any"
                                value={labourCost}
                                onChange={(e) => setLabourCost(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="overheadCostInput">Overhead</Label>
                            <Input
                                id="overheadCostInput"
                                type="number"
                                min={0}
                                step="any"
                                value={overheadCost}
                                onChange={(e) => setOverheadCost(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <Label>Total cost</Label>
                            <div className="font-mono text-[13px] font-semibold text-[var(--st-text)]">
                                {totalCost.toLocaleString('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 2,
                                })}
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] py-3">
                <Button variant="ghost" asChild>
                    <Link
                        href={
                            editing
                                ? `/dashboard/crm/inventory/production-orders/${initial?._id ?? ''}`
                                : '/dashboard/crm/inventory/production-orders'
                        }
                    >
                        Cancel
                    </Link>
                </Button>
                <SubmitButton label={editing ? 'Save changes' : 'Create order'} />
            </div>
        </form>
    );
}

export default PoForm;
