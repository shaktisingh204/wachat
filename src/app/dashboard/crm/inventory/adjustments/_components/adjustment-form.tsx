'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

/**
 * <AdjustmentForm /> — canonical create form for stock adjustments.
 *
 * Binds to `saveCrmStockAdjustment` via `useActionState`. The line items
 * are a true REPEATER (no JSON paste) — each row renders an item picker
 * + qty-before + qty-after + computed delta + optional batch / serial /
 * cost-per-unit. Rows post as `lines[i][field]` so the existing parser
 * picks them up unchanged.
 *
 * `adjustment_number` is auto-generated server-side (see
 * `nextAdjustmentNumber`).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveCrmStockAdjustment } from '@/app/actions/crm-inventory-writes.actions';

const BASE = '/dashboard/crm/inventory/adjustments';

interface AdjustmentLineSeed {
    productId?: string;
    productName?: string;
    qtyBefore?: number;
    qtyAfter?: number;
    batch?: string;
    serial?: string;
    costPerUnit?: number;
}

interface AdjustmentFormInitial {
    _id?: string;
    warehouseId?: string;
    date?: string;
    reason?: string;
    referenceNumber?: string;
    notes?: string;
    lines?: AdjustmentLineSeed[];
}

interface AdjustmentFormProps {
    initialData?: AdjustmentFormInitial | null;
}

type SaveState = { message?: string; error?: string; adjustmentId?: string };
const initialState: SaveState = {};

const REASON_OPTIONS = [
    { value: 'correction', label: 'Correction' },
    { value: 'damage', label: 'Damage' },
    { value: 'theft', label: 'Theft' },
    { value: 'expiry', label: 'Expiry' },
    { value: 'audit', label: 'Audit' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'return', label: 'Return' },
    { value: 'other', label: 'Other' },
] as const;

interface LineRow {
    rowId: string;
    productId: string;
    productName: string;
    qtyBefore: number;
    qtyAfter: number;
    batch: string;
    serial: string;
    costPerUnit: number;
}

function emptyRow(): LineRow {
    return {
        rowId: uuidv4(),
        productId: '',
        productName: '',
        qtyBefore: 0,
        qtyAfter: 0,
        batch: '',
        serial: '',
        costPerUnit: 0,
    };
}

function toDateInput(value: unknown): string {
    if (!value) return new Date().toISOString().slice(0, 10);
    const d = new Date(value as string);
    return Number.isNaN(d.getTime())
        ? new Date().toISOString().slice(0, 10)
        : d.toISOString().slice(0, 10);
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create adjustment'}
        </ZoruButton>
    );
}

export function AdjustmentForm({ initialData }: AdjustmentFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = React.useActionState(
        saveCrmStockAdjustment,
        initialState,
    );

    const seedRows = React.useMemo<LineRow[]>(() => {
        const seed = initialData?.lines ?? [];
        if (seed.length === 0) return [emptyRow()];
        return seed.map((l) => ({
            rowId: uuidv4(),
            productId: l.productId ?? '',
            productName: l.productName ?? '',
            qtyBefore: l.qtyBefore ?? 0,
            qtyAfter: l.qtyAfter ?? 0,
            batch: l.batch ?? '',
            serial: l.serial ?? '',
            costPerUnit: l.costPerUnit ?? 0,
        }));
    }, [initialData?.lines]);

    const [lines, setLines] = React.useState<LineRow[]>(seedRows);

    React.useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.adjustmentId ?? initialData?._id;
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

    const updateRow = <K extends keyof LineRow>(
        rowId: string,
        field: K,
        value: LineRow[K],
    ) => {
        setLines((prev) =>
            prev.map((l) => (l.rowId === rowId ? { ...l, [field]: value } : l)),
        );
    };

    const addRow = () => setLines((prev) => [...prev, emptyRow()]);
    const removeRow = (rowId: string) =>
        setLines((prev) =>
            prev.length === 1 ? prev : prev.filter((l) => l.rowId !== rowId),
        );

    const totalDelta = lines.reduce(
        (s, l) => s + ((l.qtyAfter || 0) - (l.qtyBefore || 0)),
        0,
    );

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="adjustmentId"
                        value={initialData!._id}
                    />
                ) : null}

                {/* Row 1: Warehouse + Date + Reason */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="warehouseId">Warehouse *</ZoruLabel>
                        <EntityFormField
                            entity="warehouse"
                            name="warehouseId"
                            initialId={initialData?.warehouseId ?? null}
                            required
                            placeholder="Pick a warehouse…"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="date">Date *</ZoruLabel>
                        <ZoruInput
                            id="date"
                            name="date"
                            type="date"
                            required
                            defaultValue={toDateInput(initialData?.date)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="reason">Reason *</ZoruLabel>
                        <EnumFormField
                            enumName="stockAdjustmentReason"
                            name="reason"
                            initialId={initialData?.reason ?? 'correction'}
                            required
                        />
                    </div>
                </div>

                {/* Row 2: Reference number */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="referenceNumber">Reference number</ZoruLabel>
                    <ZoruInput
                        id="referenceNumber"
                        name="referenceNumber"
                        placeholder="Optional — external reference / doc no."
                        defaultValue={initialData?.referenceNumber ?? ''}
                    />
                </div>

                {/* Line items REPEATER */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <ZoruLabel>Line items *</ZoruLabel>
                            <p className="text-[11.5px] text-zoru-ink-muted">
                                Add one row per SKU being adjusted. Delta = after −
                                before.
                            </p>
                        </div>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add line
                        </ZoruButton>
                    </div>

                    <div className="overflow-x-auto rounded-md border border-zoru-line">
                        <table className="w-full text-[13px]">
                            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Item
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Qty before
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Qty after
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Delta
                                    </th>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Batch
                                    </th>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Serial
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                        Cost/unit
                                    </th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((row, idx) => {
                                    const delta =
                                        (row.qtyAfter || 0) - (row.qtyBefore || 0);
                                    return (
                                        <tr
                                            key={row.rowId}
                                            className="border-t border-zoru-line align-top"
                                        >
                                            <td className="min-w-[220px] px-2 py-2">
                                                <EntityFormField
                                                    entity="item"
                                                    name={`lines[${idx}][productId]`}
                                                    initialId={row.productId || null}
                                                    initialLabel={row.productName}
                                                    placeholder={`Item ${idx + 1}`}
                                                    onChange={(id, hydrated) =>
                                                        setLines((prev) =>
                                                            prev.map((l) =>
                                                                l.rowId === row.rowId
                                                                    ? {
                                                                          ...l,
                                                                          productId: id ?? '',
                                                                          productName:
                                                                              hydrated?.chip
                                                                                  .primary ??
                                                                              l.productName,
                                                                      }
                                                                    : l,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <ZoruInput
                                                    type="number"
                                                    min={0}
                                                    step="any"
                                                    name={`lines[${idx}][qtyBefore]`}
                                                    value={row.qtyBefore}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            row.rowId,
                                                            'qtyBefore',
                                                            parseFloat(e.target.value) || 0,
                                                        )
                                                    }
                                                    className="h-8 w-24 text-right"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <ZoruInput
                                                    type="number"
                                                    min={0}
                                                    step="any"
                                                    name={`lines[${idx}][qtyAfter]`}
                                                    value={row.qtyAfter}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            row.rowId,
                                                            'qtyAfter',
                                                            parseFloat(e.target.value) || 0,
                                                        )
                                                    }
                                                    className="h-8 w-24 text-right"
                                                />
                                            </td>
                                            <td
                                                className={`px-2 py-2 text-right font-mono ${
                                                    delta > 0
                                                        ? 'text-emerald-600 dark:text-emerald-300'
                                                        : delta < 0
                                                          ? 'text-red-600 dark:text-red-300'
                                                          : 'text-zoru-ink-muted'
                                                }`}
                                            >
                                                {delta > 0 ? '+' : ''}
                                                {delta}
                                            </td>
                                            <td className="px-2 py-2">
                                                <ZoruInput
                                                    name={`lines[${idx}][batch]`}
                                                    value={row.batch}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            row.rowId,
                                                            'batch',
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="h-8 w-28"
                                                    placeholder="—"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <ZoruInput
                                                    name={`lines[${idx}][serial]`}
                                                    value={row.serial}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            row.rowId,
                                                            'serial',
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="h-8 w-28"
                                                    placeholder="—"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <ZoruInput
                                                    type="number"
                                                    min={0}
                                                    step="any"
                                                    name={`lines[${idx}][costPerUnit]`}
                                                    value={row.costPerUnit}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            row.rowId,
                                                            'costPerUnit',
                                                            parseFloat(e.target.value) || 0,
                                                        )
                                                    }
                                                    className="h-8 w-24 text-right"
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-right">
                                                <ZoruButton
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeRow(row.rowId)}
                                                    disabled={lines.length === 1}
                                                    aria-label="Remove line"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                </ZoruButton>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-zoru-line bg-zoru-surface-2">
                                    <td
                                        colSpan={3}
                                        className="px-3 py-2 text-right text-[12.5px] text-zoru-ink-muted"
                                    >
                                        Net delta
                                    </td>
                                    <td
                                        className={`px-3 py-2 text-right font-mono font-semibold ${
                                            totalDelta > 0
                                                ? 'text-emerald-600 dark:text-emerald-300'
                                                : totalDelta < 0
                                                  ? 'text-red-600 dark:text-red-300'
                                                  : 'text-zoru-ink'
                                        }`}
                                    >
                                        {totalDelta > 0 ? '+' : ''}
                                        {totalDelta}
                                    </td>
                                    <td colSpan={4} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Context, attachments references, approver notes…"
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to adjustments
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
