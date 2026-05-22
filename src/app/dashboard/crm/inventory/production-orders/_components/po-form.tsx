'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
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
import type { CrmBomComponent } from '@/app/actions/crm-bom.actions';

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
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {label}
        </ZoruButton>
    );
}

export function PoForm({ initial }: PoFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
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
                    <h1 className="text-2xl font-semibold text-zoru-ink">
                        {editing ? 'Edit Production Order' : 'New Production Order'}
                    </h1>
                    <p className="mt-1 text-sm text-zoru-ink-muted">
                        {editing
                            ? 'Update job-card details, schedule and notes.'
                            : 'Create a manufacturing job card. Pick a BOM to auto-populate components.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ZoruButton variant="outline" size="sm" asChild>
                        <Link
                            href={
                                editing
                                    ? `/dashboard/crm/inventory/production-orders/${initial?._id ?? ''}`
                                    : '/dashboard/crm/inventory/production-orders'
                            }
                        >
                            Cancel
                        </Link>
                    </ZoruButton>
                    <SubmitButton label={editing ? 'Save changes' : 'Create order'} />
                </div>
            </header>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Header</ZoruCardTitle>
                    <ZoruCardDescription>Pick a BOM to auto-populate components.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                        <ZoruLabel htmlFor="orderNo">PO #</ZoruLabel>
                        <ZoruInput
                            id="orderNo"
                            name="orderNo"
                            defaultValue={initial?.orderNo ?? ''}
                            placeholder="Auto-generated"
                            maxLength={64}
                        />
                    </div>

                    <div className="space-y-1">
                        <ZoruLabel htmlFor="bomRef">BOM</ZoruLabel>
                        <ZoruInput
                            id="bomRef"
                            name="bomRef"
                            value={bomId}
                            onChange={(e) => setBomId(e.target.value)}
                            placeholder="BOM id or reference"
                        />
                    </div>

                    <div className="space-y-1">
                        <ZoruLabel htmlFor="finishedGoodId">Finished good *</ZoruLabel>
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
                        <ZoruLabel htmlFor="plannedQty">Planned qty *</ZoruLabel>
                        <ZoruInput
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
                        <ZoruLabel htmlFor="unit">Output unit</ZoruLabel>
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
                        <ZoruLabel htmlFor="status">Status</ZoruLabel>
                        <EnumFormField
                            enumName="productionOrderStatus"
                            name="status"
                            initialId={initial?.status ?? 'planned'}
                        />
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Schedule</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                        <ZoruLabel htmlFor="plannedStart">Planned start</ZoruLabel>
                        <ZoruInput
                            id="plannedStart"
                            name="plannedStart"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(initial?.plannedStart)}
                        />
                    </div>
                    <div className="space-y-1">
                        <ZoruLabel htmlFor="plannedEnd">Planned end</ZoruLabel>
                        <ZoruInput
                            id="plannedEnd"
                            name="plannedEnd"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(initial?.plannedEnd)}
                        />
                    </div>
                    <div className="space-y-1">
                        <ZoruLabel htmlFor="machineId">Machine / line</ZoruLabel>
                        <ZoruInput
                            id="machineId"
                            name="machineId"
                            defaultValue={initial?.machineId ?? ''}
                            placeholder="e.g. Line A"
                            maxLength={100}
                        />
                    </div>
                    <div className="space-y-1">
                        <ZoruLabel>Operator</ZoruLabel>
                        <EntityFormField
                            entity="employee"
                            name="machineOperatorId"
                            dualWriteName="machineOperator"
                            initialId={initial?.machineOperatorId || null}
                            initialLabel={initial?.machineOperator ?? ''}
                            placeholder="Pick an operator…"
                        />
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Notes & cost preview</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-4">
                    <ZoruTextarea
                        name="notes"
                        defaultValue={initial?.notes ?? ''}
                        placeholder="Downtime considerations, scheduling notes, quality remarks…"
                        rows={3}
                    />
                    {components.length > 0 ? (
                        <div className="rounded border border-zoru-line p-3 text-[12.5px]">
                            <div className="mb-1 font-medium text-zoru-ink">
                                Components from BOM ({components.length})
                            </div>
                            <ul className="grid grid-cols-1 gap-y-1 text-zoru-ink-muted md:grid-cols-2">
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
                            <ZoruLabel>Material cost</ZoruLabel>
                            <div className="font-mono text-[13px] text-zoru-ink">
                                {materialCost.toLocaleString('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 2,
                                })}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <ZoruLabel htmlFor="labourCostInput">Labour cost</ZoruLabel>
                            <ZoruInput
                                id="labourCostInput"
                                type="number"
                                min={0}
                                step="any"
                                value={labourCost}
                                onChange={(e) => setLabourCost(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1">
                            <ZoruLabel htmlFor="overheadCostInput">Overhead</ZoruLabel>
                            <ZoruInput
                                id="overheadCostInput"
                                type="number"
                                min={0}
                                step="any"
                                value={overheadCost}
                                onChange={(e) => setOverheadCost(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <ZoruLabel>Total cost</ZoruLabel>
                            <div className="font-mono text-[13px] font-semibold text-zoru-ink">
                                {totalCost.toLocaleString('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 2,
                                })}
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-zoru-line bg-zoru-bg py-3">
                <ZoruButton variant="ghost" asChild>
                    <Link
                        href={
                            editing
                                ? `/dashboard/crm/inventory/production-orders/${initial?._id ?? ''}`
                                : '/dashboard/crm/inventory/production-orders'
                        }
                    >
                        Cancel
                    </Link>
                </ZoruButton>
                <SubmitButton label={editing ? 'Save changes' : 'Create order'} />
            </div>
        </form>
    );
}

export default PoForm;
