'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCheckbox,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

/**
 * <BomForm> — canonical create/edit form for BOMs.
 *
 * Sections (per §1D.3):
 *   1. Header (BOM code, finished good item picker, output qty, output
 *      unit picker, version, effective date, status)
 *   2. Components table — item picker + qty + unit + scrap % + optional
 *      flag + cost-per-unit (loaded from product when the picker hydrates)
 *   3. Costs (labour, overhead) + live total
 *
 * Smart defaults:
 *   • `?finishedGoodId=` query param pre-selects on the new page.
 *   • `initial` provides edit-mode hydration; presence of `initial._id`
 *     toggles edit semantics.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveBom } from '@/app/actions/crm-bom.actions';
import type { CrmBomComponent } from '@/app/actions/crm-bom.actions';

interface ComponentRow {
    id: string;
    itemId: string;
    itemName: string;
    qty: number;
    unit: string;
    scrapPct: number;
    optional: boolean;
    costPerUnit: number;
}

export interface BomFormInitial {
    _id?: string;
    bomNo?: string;
    finishedGoodId?: string;
    finishedGoodName?: string;
    outputQty?: number;
    unit?: string;
    effectiveDate?: string;
    version?: string;
    status?: string;
    notes?: string;
    labourCost?: number;
    overheadCost?: number;
    components?: CrmBomComponent[];
}

export interface BomFormProps {
    initial?: BomFormInitial;
}

const INITIAL_STATE = { message: '', error: '', id: '' };

function toDateInput(value: string | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            {label}
        </ZoruButton>
    );
}

export function BomForm({ initial }: BomFormProps) {
    const searchParams = useSearchParams();
    const prefillFgId = searchParams?.get('finishedGoodId') ?? '';
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = React.useActionState(saveBom, INITIAL_STATE);

    const editing = !!initial?._id;

    const seedRows = React.useMemo<ComponentRow[]>(() => {
        const seed = initial?.components ?? [];
        if (seed.length === 0) {
            return [
                {
                    id: uuidv4(),
                    itemId: '',
                    itemName: '',
                    qty: 1,
                    unit: '',
                    scrapPct: 0,
                    optional: false,
                    costPerUnit: 0,
                },
            ];
        }
        return seed.map((c) => ({
            id: uuidv4(),
            itemId: c.itemId ?? '',
            itemName: c.itemName ?? '',
            qty: typeof c.qty === 'number' ? c.qty : 1,
            unit: c.unit ?? '',
            scrapPct: typeof c.scrapPct === 'number' ? c.scrapPct : 0,
            optional: Boolean(c.optional),
            costPerUnit: typeof c.costPerUnit === 'number' ? c.costPerUnit : 0,
        }));
    }, [initial?.components]);

    const [components, setComponents] = React.useState<ComponentRow[]>(seedRows);
    const [labourCost, setLabourCost] = React.useState<number>(initial?.labourCost ?? 0);
    const [overheadCost, setOverheadCost] = React.useState<number>(initial?.overheadCost ?? 0);

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            const target = editing
                ? `/dashboard/crm/inventory/bom/${initial?._id ?? ''}`
                : state.id
                  ? `/dashboard/crm/inventory/bom/${state.id}`
                  : '/dashboard/crm/inventory/bom';
            router.push(target);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, editing, initial?._id]);

    const updateRow = React.useCallback(
        <K extends keyof ComponentRow>(id: string, field: K, value: ComponentRow[K]) => {
            setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
        },
        [],
    );

    const addRow = () =>
        setComponents((prev) => [
            ...prev,
            {
                id: uuidv4(),
                itemId: '',
                itemName: '',
                qty: 1,
                unit: '',
                scrapPct: 0,
                optional: false,
                costPerUnit: 0,
            },
        ]);

    const removeRow = (id: string) => {
        setComponents((prev) => (prev.length === 1 ? prev : prev.filter((c) => c.id !== id)));
    };

    const materialCost = React.useMemo(
        () =>
            components.reduce((sum, c) => {
                const scrapMul = 1 + (c.scrapPct || 0) / 100;
                return sum + (c.qty || 0) * (c.costPerUnit || 0) * scrapMul;
            }, 0),
        [components],
    );
    const totalCost = materialCost + (labourCost || 0) + (overheadCost || 0);

    const submitComponents: CrmBomComponent[] = components.map((c) => ({
        itemId: c.itemId,
        itemName: c.itemName,
        qty: c.qty,
        unit: c.unit,
        scrapPct: c.scrapPct,
        optional: c.optional,
        costPerUnit: c.costPerUnit,
    }));

    return (
        <form action={formAction} className="flex w-full flex-col gap-6">
            {editing ? <input type="hidden" name="bomId" value={initial?._id ?? ''} /> : null}
            <input type="hidden" name="components" value={JSON.stringify(submitComponents)} />
            <input type="hidden" name="labourCost" value={String(labourCost || 0)} />
            <input type="hidden" name="overheadCost" value={String(overheadCost || 0)} />

            {/* Sticky header bar */}
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-zoru-ink">
                        {editing ? 'Edit BOM' : 'New BOM'}
                    </h1>
                    <p className="mt-1 text-sm text-zoru-ink-muted">
                        {editing
                            ? `Update the recipe for ${initial?.finishedGoodName || 'this product'}.`
                            : 'Define the components, quantities and costs for a finished product.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ZoruButton variant="outline" size="sm" asChild>
                        <Link
                            href={
                                editing
                                    ? `/dashboard/crm/inventory/bom/${initial?._id ?? ''}`
                                    : '/dashboard/crm/inventory/bom'
                            }
                        >
                            Cancel
                        </Link>
                    </ZoruButton>
                    <SubmitButton label={editing ? 'Save changes' : 'Create BOM'} />
                </div>
            </header>

            {/* Section 1 — Header */}
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Header</ZoruCardTitle>
                    <ZoruCardDescription>Core identifiers and lifecycle dates.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                        <ZoruLabel htmlFor="bomNo">BOM code</ZoruLabel>
                        <ZoruInput
                            id="bomNo"
                            name="bomNo"
                            defaultValue={initial?.bomNo ?? ''}
                            placeholder="Auto-generated if blank"
                            maxLength={64}
                        />
                    </div>

                    <div className="space-y-1">
                        <ZoruLabel htmlFor="finishedGoodId">Finished good *</ZoruLabel>
                        <EntityFormField
                            entity="item"
                            name="finishedGoodId"
                            dualWriteName="finishedGoodName"
                            initialId={initial?.finishedGoodId || prefillFgId || null}
                            initialLabel={initial?.finishedGoodName || ''}
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <ZoruLabel htmlFor="outputQty">Output qty</ZoruLabel>
                        <ZoruInput
                            id="outputQty"
                            name="outputQty"
                            type="number"
                            min={0}
                            step="any"
                            defaultValue={initial?.outputQty ?? 1}
                        />
                    </div>

                    <div className="space-y-1">
                        <ZoruLabel htmlFor="unit">Output unit</ZoruLabel>
                        <EntityFormField
                            entity="unit"
                            name="unit"
                            initialLabel={initial?.unit ?? ''}
                            placeholder="e.g. PCS"
                        />
                    </div>

                    <div className="space-y-1">
                        <ZoruLabel htmlFor="version">Version</ZoruLabel>
                        <ZoruInput
                            id="version"
                            name="version"
                            defaultValue={initial?.version || '1.0'}
                            maxLength={32}
                        />
                    </div>

                    <div className="space-y-1">
                        <ZoruLabel htmlFor="effectiveDate">Effective date</ZoruLabel>
                        <ZoruInput
                            id="effectiveDate"
                            name="effectiveDate"
                            type="date"
                            defaultValue={toDateInput(initial?.effectiveDate)}
                        />
                    </div>

                    <div className="space-y-1">
                        <ZoruLabel htmlFor="status">Status</ZoruLabel>
                        <EnumFormField
                            enumName="bomStatus"
                            name="status"
                            initialId={initial?.status ?? 'active'}
                        />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            defaultValue={initial?.notes ?? ''}
                            placeholder="Specifications, supplier notes, references…"
                            rows={3}
                        />
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* Section 2 — Components */}
            <ZoruCard>
                <ZoruCardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <ZoruCardTitle>Components</ZoruCardTitle>
                            <ZoruCardDescription>
                                Each raw material or sub-assembly needed to produce the finished good.
                            </ZoruCardDescription>
                        </div>
                        <ZoruButton type="button" variant="outline" size="sm" onClick={addRow}>
                            <Plus className="h-4 w-4" /> Add component
                        </ZoruButton>
                    </div>
                </ZoruCardHeader>
                <ZoruCardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zoru-line bg-zoru-surface-2 text-zoru-ink-muted">
                                    <th className="px-3 py-2 text-left text-xs font-medium">Item</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium">Qty</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium">Unit</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium">Scrap %</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium">
                                        Cost / unit
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium">Optional</th>
                                    <th className="w-10 px-3 py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {components.map((row, idx) => (
                                    <tr
                                        key={row.id}
                                        className="border-b border-zoru-line last:border-0 align-top"
                                    >
                                        <td className="min-w-[200px] px-2 py-2">
                                            <EntityFormField
                                                entity="item"
                                                name={`__bom-item-${row.id}`}
                                                initialId={row.itemId || null}
                                                initialLabel={row.itemName}
                                                placeholder={`Component ${idx + 1}`}
                                                onChange={(id, hydrated) => {
                                                    setComponents((prev) =>
                                                        prev.map((c) =>
                                                            c.id === row.id
                                                                ? {
                                                                      ...c,
                                                                      itemId: id ?? '',
                                                                      itemName:
                                                                          hydrated?.chip.primary ??
                                                                          c.itemName,
                                                                      costPerUnit:
                                                                          (hydrated as any)?.cost?.value ??
                                                                          (hydrated as any)?.priceCost ??
                                                                          c.costPerUnit,
                                                                      unit:
                                                                          (hydrated as any)?.unit ??
                                                                          c.unit,
                                                                  }
                                                                : c,
                                                        ),
                                                    );
                                                }}
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <ZoruInput
                                                type="number"
                                                min={0}
                                                step="any"
                                                value={row.qty}
                                                onChange={(e) =>
                                                    updateRow(
                                                        row.id,
                                                        'qty',
                                                        parseFloat(e.target.value) || 0,
                                                    )
                                                }
                                                className="h-8 w-24"
                                            />
                                        </td>
                                        <td className="min-w-[120px] px-2 py-2">
                                            <EntityFormField
                                                entity="unit"
                                                name={`__bom-unit-${row.id}`}
                                                initialLabel={row.unit}
                                                placeholder="PCS"
                                                onChange={(_id, hydrated) => {
                                                    updateRow(
                                                        row.id,
                                                        'unit',
                                                        hydrated?.chip.primary ?? '',
                                                    );
                                                }}
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <ZoruInput
                                                type="number"
                                                min={0}
                                                max={100}
                                                step="any"
                                                value={row.scrapPct}
                                                onChange={(e) =>
                                                    updateRow(
                                                        row.id,
                                                        'scrapPct',
                                                        parseFloat(e.target.value) || 0,
                                                    )
                                                }
                                                className="h-8 w-20"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <ZoruInput
                                                type="number"
                                                min={0}
                                                step="any"
                                                value={row.costPerUnit}
                                                onChange={(e) =>
                                                    updateRow(
                                                        row.id,
                                                        'costPerUnit',
                                                        parseFloat(e.target.value) || 0,
                                                    )
                                                }
                                                className="h-8 w-28"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <ZoruCheckbox
                                                checked={row.optional}
                                                onCheckedChange={(c) =>
                                                    updateRow(row.id, 'optional', c === true)
                                                }
                                                aria-label="Optional component"
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <ZoruButton
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Remove component"
                                                onClick={() => removeRow(row.id)}
                                                disabled={components.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                                            </ZoruButton>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            {/* Section 3 — Costs */}
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Cost rollup</ZoruCardTitle>
                    <ZoruCardDescription>
                        Material cost is derived from components (qty × cost × scrap multiplier).
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="space-y-1">
                        <ZoruLabel>Material cost</ZoruLabel>
                        <div className="font-mono text-[14px] text-zoru-ink">
                            {materialCost.toLocaleString('en-IN', {
                                style: 'currency',
                                currency: 'INR',
                                maximumFractionDigits: 2,
                            })}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <ZoruLabel htmlFor="labourCost">Labour cost</ZoruLabel>
                        <ZoruInput
                            id="labourCost"
                            type="number"
                            min={0}
                            step="any"
                            value={labourCost}
                            onChange={(e) => setLabourCost(parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <div className="space-y-1">
                        <ZoruLabel htmlFor="overheadCost">Overhead cost</ZoruLabel>
                        <ZoruInput
                            id="overheadCost"
                            type="number"
                            min={0}
                            step="any"
                            value={overheadCost}
                            onChange={(e) => setOverheadCost(parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <div className="space-y-1">
                        <ZoruLabel>Total cost</ZoruLabel>
                        <div className="font-mono text-[14px] font-semibold text-zoru-ink">
                            {totalCost.toLocaleString('en-IN', {
                                style: 'currency',
                                currency: 'INR',
                                maximumFractionDigits: 2,
                            })}
                        </div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-zoru-line bg-zoru-bg py-3">
                <ZoruButton variant="ghost" asChild>
                    <Link
                        href={
                            editing
                                ? `/dashboard/crm/inventory/bom/${initial?._id ?? ''}`
                                : '/dashboard/crm/inventory/bom'
                        }
                    >
                        Cancel
                    </Link>
                </ZoruButton>
                <SubmitButton label={editing ? 'Save changes' : 'Create BOM'} />
            </div>
        </form>
    );
}

export default BomForm;
