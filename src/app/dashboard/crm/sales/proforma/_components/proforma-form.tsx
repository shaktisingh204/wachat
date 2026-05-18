'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';

/**
 * <ProformaForm /> — canonical create/edit form for proforma invoices.
 *
 * Posts to `saveProformaInvoice` (create) or `updateProformaInvoice` (edit)
 * via `useActionState`. Line items + terms use a repeater UI; the form
 * serialises them into JSON before submit (matches existing server
 * action contract).
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    saveProformaInvoice,
    updateProformaInvoice,
} from '@/app/actions/crm-proforma-invoices.actions';
import type {
    CrmProformaInvoiceDoc,
    CrmProformaLineItem,
    CrmProformaStatus,
} from '@/lib/rust-client/crm-proforma-invoices';

const BASE = '/dashboard/crm/sales/proforma';

// Status + currency now sourced from CRM_ENUMS / EntityFormField.

interface LineRow extends CrmProformaLineItem {
    rowId: string;
}

interface ProformaFormProps {
    initialData?: CrmProformaInvoiceDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function newRow(): LineRow {
    return {
        rowId: `r-${Math.random().toString(36).slice(2, 9)}`,
        description: '',
        quantity: 1,
        rate: 0,
        unit: '',
        taxPct: 0,
        amount: 0,
    };
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
            {isEditing ? 'Save changes' : 'Create proforma'}
        </ZoruButton>
    );
}

export function ProformaForm({ initialData }: ProformaFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(
        isEditing ? updateProformaInvoice : saveProformaInvoice,
        initialState,
    );

    const [accountId, setAccountId] = useState<string | null>(
        initialData?.accountId ?? null,
    );
    const [status, setStatus] = useState<CrmProformaStatus>(
        (initialData?.status as CrmProformaStatus) ?? 'Draft',
    );
    const [currency, setCurrency] = useState<string>(
        initialData?.currency ?? 'INR',
    );

    const [rows, setRows] = useState<LineRow[]>(() => {
        const items = initialData?.lineItems ?? [];
        if (items.length === 0) return [newRow()];
        return items.map((it, i) => ({
            rowId: `r-${i}-${Math.random().toString(36).slice(2, 6)}`,
            description: it.description ?? '',
            quantity: it.quantity ?? 1,
            rate: it.rate ?? 0,
            unit: it.unit ?? '',
            taxPct: it.taxPct ?? 0,
            amount: (it.quantity ?? 1) * (it.rate ?? 0),
            itemId: it.itemId,
        }));
    });

    const [terms, setTerms] = useState<string[]>(
        initialData?.termsAndConditions ?? [''],
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
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

    const subtotal = rows.reduce(
        (s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0),
        0,
    );

    function patchRow(rowId: string, patch: Partial<LineRow>) {
        setRows((prev) =>
            prev.map((r) => {
                if (r.rowId !== rowId) return r;
                const next = { ...r, ...patch };
                next.amount = (Number(next.quantity) || 0) * (Number(next.rate) || 0);
                return next;
            }),
        );
    }

    const lineItemsJson = JSON.stringify(
        rows.map(({ rowId: _drop, amount: _a, ...rest }) => ({
            ...rest,
            amount: (Number(rest.quantity) || 0) * (Number(rest.rate) || 0),
        })),
    );
    const termsJson = JSON.stringify(terms.map((t) => t.trim()).filter(Boolean));

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="proformaId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="accountId" value={accountId ?? ''} />
                <input type="hidden" name="currency" value={currency} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="lineItems" value={lineItemsJson} />
                <input type="hidden" name="termsAndConditions" value={termsJson} />

                {/* Row 1: Number + Customer */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="proformaNumber">Proforma #</ZoruLabel>
                        <ZoruInput
                            id="proformaNumber"
                            name="proformaNumber"
                            placeholder="Auto-generated if empty"
                            defaultValue={initialData?.proformaNumber ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Customer *</ZoruLabel>
                        <EntityFormField
                            entity="client"
                            name="accountIdPicker"
                            initialId={accountId}
                            onChange={(id) => setAccountId(id ?? null)}
                            placeholder="Pick a client…"
                        />
                    </div>
                </div>

                {/* Row 2: Dates + Currency */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="proformaDate">Proforma date *</ZoruLabel>
                        <ZoruInput
                            id="proformaDate"
                            name="proformaDate"
                            type="date"
                            required
                            defaultValue={toDateInput(initialData?.proformaDate) || toDateInput(new Date().toISOString())}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="validTillDate">Valid till</ZoruLabel>
                        <ZoruInput
                            id="validTillDate"
                            name="validTillDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.validTillDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Currency</ZoruLabel>
                        <EntityFormField
                            entity="currency"
                            name="__currency_picker"
                            initialId={currency}
                            onChange={(id) => setCurrency(id ?? 'INR')}
                        />
                    </div>
                </div>

                {/* Line items */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Line items *</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setRows((p) => [...p, newRow()])}
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add line
                        </ZoruButton>
                    </div>
                    <div className="overflow-x-auto rounded-md border border-zoru-line">
                        <table className="w-full text-[13px]">
                            <thead className="bg-zoru-surface-2 text-left text-zoru-ink-muted">
                                <tr>
                                    <th className="p-2 font-medium">Description</th>
                                    <th className="w-[80px] p-2 text-right font-medium">Qty</th>
                                    <th className="w-[110px] p-2 font-medium">Unit</th>
                                    <th className="w-[100px] p-2 text-right font-medium">Rate</th>
                                    <th className="w-[80px] p-2 text-right font-medium">Tax %</th>
                                    <th className="w-[110px] p-2 text-right font-medium">Amount</th>
                                    <th className="w-[40px] p-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.rowId} className="border-t border-zoru-line">
                                        <td className="p-2">
                                            <ZoruInput
                                                value={row.description}
                                                onChange={(e) =>
                                                    patchRow(row.rowId, {
                                                        description: e.target.value,
                                                    })
                                                }
                                                placeholder="Item description"
                                                className="h-9 text-[12.5px]"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <ZoruInput
                                                type="number"
                                                min={0}
                                                step="any"
                                                value={row.quantity}
                                                onChange={(e) =>
                                                    patchRow(row.rowId, {
                                                        quantity: Number(e.target.value) || 0,
                                                    })
                                                }
                                                className="h-9 text-right text-[12.5px] tabular-nums"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <ZoruInput
                                                value={row.unit ?? ''}
                                                onChange={(e) =>
                                                    patchRow(row.rowId, { unit: e.target.value })
                                                }
                                                placeholder="PCS"
                                                className="h-9 text-[12.5px]"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <ZoruInput
                                                type="number"
                                                min={0}
                                                step="any"
                                                value={row.rate}
                                                onChange={(e) =>
                                                    patchRow(row.rowId, {
                                                        rate: Number(e.target.value) || 0,
                                                    })
                                                }
                                                className="h-9 text-right text-[12.5px] tabular-nums"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <ZoruInput
                                                type="number"
                                                min={0}
                                                step="any"
                                                value={row.taxPct ?? 0}
                                                onChange={(e) =>
                                                    patchRow(row.rowId, {
                                                        taxPct: Number(e.target.value) || 0,
                                                    })
                                                }
                                                className="h-9 text-right text-[12.5px] tabular-nums"
                                            />
                                        </td>
                                        <td className="p-2 text-right tabular-nums text-zoru-ink">
                                            {((Number(row.quantity) || 0) *
                                                (Number(row.rate) || 0)).toFixed(2)}
                                        </td>
                                        <td className="p-2 text-right">
                                            <ZoruButton
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setRows((p) =>
                                                        p.length === 1
                                                            ? p
                                                            : p.filter((r) => r.rowId !== row.rowId),
                                                    )
                                                }
                                                disabled={rows.length === 1}
                                                className="text-zoru-danger-ink"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </ZoruButton>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-zoru-line bg-zoru-surface-2">
                                    <td colSpan={5} className="p-2 text-right font-medium text-zoru-ink-muted">
                                        Subtotal
                                    </td>
                                    <td className="p-2 text-right font-mono text-[13px] text-zoru-ink">
                                        {currency} {subtotal.toFixed(2)}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Terms & conditions repeater */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Terms &amp; conditions</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setTerms((p) => [...p, ''])}
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add term
                        </ZoruButton>
                    </div>
                    <div className="space-y-2">
                        {terms.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <ZoruInput
                                    value={t}
                                    placeholder={`Term ${i + 1}`}
                                    onChange={(e) =>
                                        setTerms((p) => p.map((v, idx) => (idx === i ? e.target.value : v)))
                                    }
                                />
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setTerms((p) =>
                                            p.length === 1 ? [''] : p.filter((_, idx) => idx !== i),
                                        )
                                    }
                                    className="text-zoru-danger-ink"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </ZoruButton>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Notes + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            rows={3}
                            defaultValue={initialData?.notes ?? ''}
                            placeholder="Internal or customer-facing notes"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            enumName="proformaStatus"
                            name="__status_picker"
                            initialId={status || null}
                            onChange={(id) => setStatus((id ?? 'Draft') as CrmProformaStatus)}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to proforma
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
