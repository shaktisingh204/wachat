'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState,
  useMemo } from 'react';
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
import { CrmStatutoryCalculator, type CalculatorItem } from '@/components/crm/crm-statutory-calculator';

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
    discountPct?: number;
    hsnSac?: string;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
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
        unit: 'PCS',
        taxPct: 18,
        amount: 0,
        discountPct: 0,
        hsnSac: '',
    };
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create proforma'}
        </Button>
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

    // Statutory Calculator States
    const [placeOfSupply, setPlaceOfSupply] = useState<string>(initialData?.placeOfSupply || 'Maharashtra');
    const [companyBaseState] = useState<string>('Maharashtra');
    const [tdsPercent, setTdsPercent] = useState<number>(initialData?.tdsPct ?? 0);
    const [tcsPercent, setTcsPercent] = useState<number>(initialData?.tcsPct ?? 0);
    const [discountOverall, setDiscountOverall] = useState<number>(initialData?.discountOverall ?? 0);
    const [shippingCharge, setShippingCharge] = useState<number>(initialData?.shippingCharge ?? 0);
    const [adjustment, setAdjustment] = useState<number>(initialData?.adjustment ?? 0);
    const [roundOff, setRoundOff] = useState<number>(initialData?.roundOff ?? 0);

    const [rows, setRows] = useState<LineRow[]>(() => {
        const items = initialData?.lineItems ?? [];
        if (items.length === 0) return [newRow()];
        return items.map((it, i) => ({
            rowId: `r-${i}-${Math.random().toString(36).slice(2, 6)}`,
            description: it.description ?? '',
            quantity: it.quantity ?? 1,
            rate: it.rate ?? 0,
            unit: it.unit ?? '',
            discountPct: (it as any).discountPct ?? 0,
            taxPct: it.taxPct ?? 18,
            amount: (it.quantity ?? 1) * (it.rate ?? 0),
            itemId: it.itemId,
            hsnSac: (it as any).hsnSac ?? '',
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

    const calculatorItems: CalculatorItem[] = useMemo(() => {
        return rows.map((row) => ({
            itemId: row.rowId,
            name: row.description || '',
            qty: row.quantity,
            rate: row.rate,
            discountPercent: row.discountPct ?? 0,
            taxRatePercent: row.taxPct ?? 18,
            hsnSac: row.hsnSac,
        }));
    }, [rows]);

    const handleCalculatorItemsChange = (newItems: CalculatorItem[]) => {
        const isIntra = placeOfSupply.toLowerCase().trim() === companyBaseState.toLowerCase().trim();
        const nextRows = newItems.map((item) => {
            const existing = rows.find((r) => r.rowId === item.itemId);
            const qty = item.qty;
            const rate = item.rate;
            const discountPct = item.discountPercent;
            const taxRatePct = item.taxRatePercent;
            const baseLine = qty * rate;
            const rowTaxable = Math.max(0, baseLine * (1 - discountPct / 100));
            const taxAmount = rowTaxable * (taxRatePct / 100);
            const cgstAmount = isIntra ? taxAmount / 2 : 0;
            const sgstAmount = isIntra ? taxAmount / 2 : 0;
            const igstAmount = isIntra ? 0 : taxAmount;
            const total = rowTaxable + taxAmount;

            return {
                rowId: item.itemId,
                itemId: existing?.itemId,
                description: item.name,
                quantity: qty,
                rate: rate,
                unit: existing?.unit ?? 'PCS',
                discountPct,
                taxPct: taxRatePct,
                cgstAmount,
                sgstAmount,
                igstAmount,
                amount: rowTaxable,
                hsnSac: item.hsnSac,
            };
        });
        setRows(nextRows);
    };

    const lineItemsJson = JSON.stringify(
        rows.map(({ rowId: _drop, amount: _a, ...rest }) => ({
            ...rest,
            quantity: Number(rest.quantity) || 0,
            rate: Number(rest.rate) || 0,
            taxPct: Number(rest.taxPct) || 0,
            discountPct: Number(rest.discountPct) || 0,
            amount: (Number(rest.quantity) || 0) * (Number(rest.rate) || 0) * (1 - (Number(rest.discountPct) || 0) / 100),
        })),
    );
    const termsJson = JSON.stringify(terms.map((t) => t.trim()).filter(Boolean));

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="proformaId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="accountId" value={accountId ?? ''} />
                <input type="hidden" name="currency" value={currency} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="lineItems" value={lineItemsJson} />
                <input type="hidden" name="termsAndConditions" value={termsJson} />

                {/* Hidden inputs to capture statutory calculator and placeOfSupply state in FormData */}
                <input type="hidden" name="placeOfSupply" value={placeOfSupply} />
                <input type="hidden" name="discountOverall" value={discountOverall} />
                <input type="hidden" name="shippingCharge" value={shippingCharge} />
                <input type="hidden" name="adjustment" value={adjustment} />
                <input type="hidden" name="roundOff" value={roundOff} />
                <input type="hidden" name="tdsPct" value={tdsPercent} />
                <input type="hidden" name="tcsPct" value={tcsPercent} />

                {/* Row 1: Number + Customer */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="proformaNumber">Proforma #</Label>
                        <Input
                            id="proformaNumber"
                            name="proformaNumber"
                            placeholder="Auto-generated if empty"
                            defaultValue={initialData?.proformaNumber ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Customer *</Label>
                        <EntityFormField
                            entity="client"
                            name="accountIdPicker"
                            initialId={accountId}
                            onChange={(id) => setAccountId(id ?? null)}
                            placeholder="Pick a client…"
                        />
                    </div>
                </div>

                {/* Row 2: Dates + Currency + Place of Supply */}
                <div className="grid gap-4 sm:grid-cols-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="proformaDate">Proforma date *</Label>
                        <Input
                            id="proformaDate"
                            name="proformaDate"
                            type="date"
                            required
                            defaultValue={toDateInput(initialData?.proformaDate) || toDateInput(new Date().toISOString())}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="validTillDate">Valid till</Label>
                        <Input
                            id="validTillDate"
                            name="validTillDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.validTillDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Currency</Label>
                        <EntityFormField
                            entity="currency"
                            name="__currency_picker"
                            initialId={currency}
                            onChange={(id) => setCurrency(id ?? 'INR')}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="placeOfSupply">Place of supply</Label>
                        <Input
                            id="placeOfSupply"
                            name="placeOfSupply"
                            value={placeOfSupply}
                            onChange={(e) => setPlaceOfSupply(e.target.value)}
                            placeholder="State code (e.g. Maharashtra)"
                        />
                    </div>
                </div>

                {/* Statutory Calculator Panel */}
                <div className="space-y-2">
                    <Label className="text-base font-semibold">Statutory Value Compute Engine</Label>
                    <CrmStatutoryCalculator
                        items={calculatorItems}
                        onChangeItems={handleCalculatorItemsChange}
                        placeOfSupplyState={placeOfSupply}
                        companyBaseState={companyBaseState}
                        tdsPercent={tdsPercent}
                        onChangeTdsPercent={setTdsPercent}
                        tcsPercent={tcsPercent}
                        onChangeTcsPercent={setTcsPercent}
                        discountOverallVal={discountOverall}
                        onChangeDiscountOverallVal={setDiscountOverall}
                        shippingCharge={shippingCharge}
                        onChangeShippingCharge={setShippingCharge}
                        adjustment={adjustment}
                        onChangeAdjustment={setAdjustment}
                        onTotalsChange={(t) => {
                            setRoundOff(t.roundOff);
                        }}
                    />
                </div>

                {/* Terms & conditions repeater */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Terms &amp; conditions</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setTerms((p) => [...p, ''])}
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add term
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {terms.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    value={t}
                                    placeholder={`Term ${i + 1}`}
                                    onChange={(e) =>
                                        setTerms((p) => p.map((v, idx) => (idx === i ? e.target.value : v)))
                                    }
                                />
                                <Button
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
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Notes + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            rows={3}
                            defaultValue={initialData?.notes ?? ''}
                            placeholder="Internal or customer-facing notes"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
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
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to proforma
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
