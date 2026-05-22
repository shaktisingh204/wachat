'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Plus,
  Trash2 } from 'lucide-react';

/**
 * §1D Stock Adjustment form — supports both single-row (legacy) and
 * multi-line entries. The action layer accepts either shape; this UI
 * defaults to multi-line and posts:
 *
 *   warehouseId   (entity id from <EntityFormField>)
 *   reason        (enum)
 *   date          (yyyy-mm-dd)
 *   referenceNumber
 *   notes
 *   lines[i][productId,qtyBefore,qtyAfter,batch,serial,costPerUnit]
 *
 * The approval workflow card lets the creator pre-pick an approver
 * (stored as `approverPick` for now; approval still happens via the
 * Approve action). Each row computes its own delta (qtyAfter -
 * qtyBefore) and total impact.
 */

import * as React from 'react';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveCrmStockAdjustment } from '@/app/actions/crm-inventory.actions';
import { REASON_OPTIONS } from '../_components/adjustments-bits';

interface LineRow {
    key: string;
    productId: string;
    qtyBefore: string;
    qtyAfter: string;
    batch: string;
    serial: string;
    costPerUnit: string;
}

function newLine(): LineRow {
    return {
        key: Math.random().toString(36).slice(2),
        productId: '',
        qtyBefore: '',
        qtyAfter: '',
        batch: '',
        serial: '',
        costPerUnit: '',
    };
}

export function AdjustmentForm() {
    const router = useRouter();
    const { toast } = useZoruToast();

    const [warehouseId, setWarehouseId] = React.useState<string>('');
    const [approverId, setApproverId] = React.useState<string>('');
    const [lines, setLines] = React.useState<LineRow[]>([newLine()]);
    const [error, setError] = React.useState<string | undefined>();

    const updateLine = (idx: number, patch: Partial<LineRow>) => {
        setLines((prev) =>
            prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
        );
    };

    const addLine = () => setLines((prev) => [...prev, newLine()]);
    const removeLine = (idx: number) =>
        setLines((prev) =>
            prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
        );

    const totalImpact = React.useMemo(() => {
        let v = 0;
        for (const l of lines) {
            const before = Number(l.qtyBefore || 0);
            const after = Number(l.qtyAfter || 0);
            const cost = Number(l.costPerUnit || 0);
            if (!Number.isFinite(before) || !Number.isFinite(after)) continue;
            const delta = after - before;
            v += Math.abs(delta * (cost || 1));
        }
        return v;
    }, [lines]);

    const handleAction = async (formData: FormData) => {
        setError(undefined);
        const res = await saveCrmStockAdjustment(null, formData);
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
            description: res.message ?? 'Adjustment saved.',
        });
        router.push('/dashboard/crm/inventory/adjustments');
    };

    const hiddenInputs = (
        <>
            <input type="hidden" name="warehouseId" value={warehouseId} />
            <input type="hidden" name="approverPick" value={approverId} />
            {lines.map((l, idx) => (
                <React.Fragment key={l.key}>
                    <input
                        type="hidden"
                        name={`lines[${idx}][productId]`}
                        value={l.productId}
                    />
                    <input
                        type="hidden"
                        name={`lines[${idx}][qtyBefore]`}
                        value={l.qtyBefore}
                    />
                    <input
                        type="hidden"
                        name={`lines[${idx}][qtyAfter]`}
                        value={l.qtyAfter}
                    />
                    <input
                        type="hidden"
                        name={`lines[${idx}][batch]`}
                        value={l.batch}
                    />
                    <input
                        type="hidden"
                        name={`lines[${idx}][serial]`}
                        value={l.serial}
                    />
                    <input
                        type="hidden"
                        name={`lines[${idx}][costPerUnit]`}
                        value={l.costPerUnit}
                    />
                </React.Fragment>
            ))}
        </>
    );

    const today = new Date().toISOString().slice(0, 10);

    return (
        <EntityFormShell
            title="New Stock Adjustment"
            subtitle="Record an inventory correction. Approval workflow tracked separately."
            action={handleAction}
            cancelHref="/dashboard/crm/inventory/adjustments"
            submitLabel="Create adjustment"
            error={error}
            hiddenInputs={hiddenInputs}
            sections={[
                {
                    id: 'header',
                    title: 'Header',
                    description:
                        'Date, warehouse, reason, and an optional reference doc.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="date">Date *</ZoruLabel>
                                <ZoruInput
                                    type="date"
                                    id="date"
                                    name="date"
                                    defaultValue={today}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel>Warehouse *</ZoruLabel>
                                <EntityFormField
                                    entity="warehouse"
                                    name="warehousePicker"
                                    initialId={warehouseId || null}
                                    onChange={(next) => setWarehouseId(next ?? '')}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="reason">Reason *</ZoruLabel>
                                <EnumFormField
                                    enumName="stockAdjustmentReason"
                                    name="reason"
                                    placeholder="Select reason"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="referenceNumber">
                                    Reference doc
                                </ZoruLabel>
                                <ZoruInput
                                    id="referenceNumber"
                                    name="referenceNumber"
                                    placeholder="e.g. internal memo #42"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'lines',
                    title: 'Line items',
                    description:
                        'Add one row per item. Delta is qtyAfter − qtyBefore.',
                    children: (
                        <div className="space-y-3">
                            <div className="overflow-x-auto rounded-md border border-zoru-line">
                                <table className="w-full text-[12.5px]">
                                    <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                        <tr>
                                            <th className="px-2 py-2 text-left font-medium">
                                                Item
                                            </th>
                                            <th className="px-2 py-2 text-right font-medium">
                                                Qty before
                                            </th>
                                            <th className="px-2 py-2 text-right font-medium">
                                                Qty after
                                            </th>
                                            <th className="px-2 py-2 text-right font-medium">
                                                Delta
                                            </th>
                                            <th className="px-2 py-2 text-left font-medium">
                                                Batch
                                            </th>
                                            <th className="px-2 py-2 text-left font-medium">
                                                Serial
                                            </th>
                                            <th className="px-2 py-2 text-right font-medium">
                                                Cost/unit
                                            </th>
                                            <th className="w-[40px]" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.map((l, idx) => {
                                            const before = Number(l.qtyBefore || 0);
                                            const after = Number(l.qtyAfter || 0);
                                            const delta = after - before;
                                            return (
                                                <tr
                                                    key={l.key}
                                                    className="border-t border-zoru-line"
                                                >
                                                    <td className="px-2 py-1.5 min-w-[180px]">
                                                        <EntityFormField
                                                            entity="item"
                                                            name={`linePicker[${idx}]`}
                                                            initialId={l.productId || null}
                                                            onChange={(next) =>
                                                                updateLine(idx, {
                                                                    productId: next ?? '',
                                                                })
                                                            }
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <ZoruInput
                                                            type="number"
                                                            value={l.qtyBefore}
                                                            onChange={(e) =>
                                                                updateLine(idx, {
                                                                    qtyBefore: e.target.value,
                                                                })
                                                            }
                                                            className="h-8 text-right text-[12.5px]"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <ZoruInput
                                                            type="number"
                                                            value={l.qtyAfter}
                                                            onChange={(e) =>
                                                                updateLine(idx, {
                                                                    qtyAfter: e.target.value,
                                                                })
                                                            }
                                                            className="h-8 text-right text-[12.5px]"
                                                        />
                                                    </td>
                                                    <td
                                                        className={[
                                                            'px-2 py-1.5 text-right font-mono',
                                                            delta > 0
                                                                ? 'text-emerald-500'
                                                                : delta < 0
                                                                  ? 'text-rose-500'
                                                                  : 'text-zoru-ink-muted',
                                                        ].join(' ')}
                                                    >
                                                        {delta > 0 ? '+' : ''}
                                                        {delta}
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <ZoruInput
                                                            value={l.batch}
                                                            onChange={(e) =>
                                                                updateLine(idx, {
                                                                    batch: e.target.value,
                                                                })
                                                            }
                                                            className="h-8 text-[12.5px]"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <ZoruInput
                                                            value={l.serial}
                                                            onChange={(e) =>
                                                                updateLine(idx, {
                                                                    serial: e.target.value,
                                                                })
                                                            }
                                                            className="h-8 text-[12.5px]"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <ZoruInput
                                                            type="number"
                                                            value={l.costPerUnit}
                                                            onChange={(e) =>
                                                                updateLine(idx, {
                                                                    costPerUnit:
                                                                        e.target.value,
                                                                })
                                                            }
                                                            className="h-8 text-right text-[12.5px]"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLine(idx)}
                                                            disabled={lines.length === 1}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded text-zoru-ink-muted hover:bg-zoru-surface-2 disabled:opacity-30"
                                                            aria-label="Remove row"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between">
                                <ZoruButton
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addLine}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add line
                                </ZoruButton>
                                <div className="text-[12.5px] text-zoru-ink-muted">
                                    Total impact:{' '}
                                    <span className="font-mono text-zoru-ink">
                                        {totalImpact.toLocaleString('en-IN', {
                                            maximumFractionDigits: 2,
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'approval',
                    title: 'Approval workflow',
                    description:
                        'Pre-assign an approver. Approval is recorded via the Approve action on the detail page.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <ZoruLabel>Approver</ZoruLabel>
                                <EntityFormField
                                    entity="user"
                                    name="approverPicker"
                                    initialId={approverId || null}
                                    onChange={(next) => setApproverId(next ?? '')}
                                />
                            </div>
                            <div className="space-y-1">
                                <ZoruLabel htmlFor="approvalNotes">
                                    Approval notes
                                </ZoruLabel>
                                <ZoruInput
                                    id="approvalNotes"
                                    name="approvalNotes"
                                    placeholder="Optional context for the approver"
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'notes',
                    title: 'Notes',
                    children: (
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            placeholder="Optional notes…"
                            rows={3}
                        />
                    ),
                },
            ]}
        />
    );
}
