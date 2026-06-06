'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter,
  useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

/**
 * <PayoutForm> — single source of truth for both Create and Edit
 * flows of vendor Payouts.
 *
 * Server-action driven via `savePayoutAction`. Reference fields
 * (vendor, bank account, currency) go through `<EntityFormField>`.
 *
 * Multi-bill apply rows: each row keys hidden inputs as
 * `applyTo[N].billId` and `applyTo[N].amount` AND also writes a
 * combined `applyTo` JSON blob — the server action accepts either
 * shape. The picker is a plain `<Input>` for the bill id because
 * `bill` is not yet a registered `EntityKey`. The bill catalogue is
 * loaded server-side for the selected vendor (via
 * `getUnpaidBillsByVendor`) and rendered as a `<datalist>` so users
 * can pick from open bills with a balance hint.
 *
 * Smart defaults via `?billId=` query param: pre-fills the apply table
 * with one row pointing at that bill and amount = balance.
 *
 * Per the Rust DTO, financial fields (`amount`, `applyTo`, `mode`,
 * `vendorId`, `currency`) are NOT patchable on edit — those inputs
 * are disabled in Edit mode.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
    savePayoutAction,
    getUnpaidBillsByVendor,
    type UnpaidBillRow,
} from '@/app/actions/crm/payouts.actions';
import type {
    CrmPayoutDoc,
    CrmPayoutMode,
    CrmPayoutStatus,
} from '@/lib/rust-client/crm-payouts';
import { PayoutApplyRows, type PayoutApplyRow } from './payout-apply-rows';

const PAYMENT_MODES: Array<{ value: CrmPayoutMode; label: string }> = [
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'upi', label: 'UPI' },
    { value: 'neft', label: 'NEFT' },
    { value: 'rtgs', label: 'RTGS' },
    { value: 'imps', label: 'IMPS' },
    { value: 'card', label: 'Card' },
    { value: 'wallet', label: 'Wallet' },
];

const STATUSES: Array<{ value: CrmPayoutStatus; label: string }> = [
    { value: 'sent', label: 'Sent' },
    { value: 'cleared', label: 'Cleared' },
    { value: 'failed', label: 'Failed' },
];

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function makeRowKey(): string {
    return `apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankRow(): PayoutApplyRow {
    return { rowKey: makeRowKey(), billId: '', amount: '' };
}

function SubmitButton({ editing }: { editing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create payout'}
        </Button>
    );
}

function fmtMoney(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${currency || 'INR'} ${value.toFixed(2)}`;
    }
}

export interface PayoutFormProps {
    /** Existing payout — present in Edit mode, omit for Create. */
    initial?: CrmPayoutDoc | null;
}

export function PayoutForm({ initial }: PayoutFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [state, formAction] = useActionState(savePayoutAction, INITIAL_STATE);
    const editing = !!initial?._id;

    const [vendorId, setVendorId] = useState<string>(initial?.vendorId ?? '');
    const [bankAccountId, setBankAccountId] = useState<string>(
        initial?.bankAccountId ?? '',
    );
    const [mode, setMode] = useState<CrmPayoutMode>(initial?.mode ?? 'neft');
    const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
    const [status, setStatus] = useState<CrmPayoutStatus>(initial?.status ?? 'sent');
    const [excessAsAdvance, setExcessAsAdvance] = useState<boolean>(
        !!initial?.excessAsAdvance,
    );
    const [tdsDeductedFlag, setTdsDeductedFlag] = useState<boolean>(
        typeof initial?.tdsDeducted === 'number' && initial.tdsDeducted > 0,
    );

    // Apply-to rows. Seed from the existing payout or from `?billId=`.
    const presetBillId = searchParams?.get('billId') ?? '';
    const [applyRows, setApplyRows] = useState<PayoutApplyRow[]>(() => {
        if (initial?.applyTo && initial.applyTo.length > 0) {
            return initial.applyTo.map((r) => ({
                rowKey: makeRowKey(),
                billId: r.billId,
                amount: String(r.amount),
            }));
        }
        if (presetBillId) {
            return [
                {
                    rowKey: makeRowKey(),
                    billId: presetBillId,
                    amount: '',
                },
            ];
        }
        return [blankRow()];
    });

    // Unpaid-bill cache, keyed by bill id → { balance, label }.
    const [billMeta, setBillMeta] = useState<
        Record<string, { balance: number; label: string }>
    >({});
    const [billsLoading, startBillsLoad] = React.useTransition();
    const [billsCatalog, setBillsCatalog] = useState<UnpaidBillRow[]>([]);

    // Whenever the vendor changes, refresh the unpaid-bill lookup so each
    // apply row can show the balance hint + auto-fill the amount.
    useEffect(() => {
        if (!vendorId) {
            setBillMeta({});
            setBillsCatalog([]);
            return;
        }
        startBillsLoad(async () => {
            try {
                const bills = await getUnpaidBillsByVendor(vendorId);
                setBillsCatalog(bills);
                const meta: Record<string, { balance: number; label: string }> = {};
                for (const b of bills) {
                    meta[b._id] = {
                        balance: b.balance,
                        label: b.billNo || b._id.slice(-6),
                    };
                }
                setBillMeta(meta);
                // Auto-fill amount on rows that have a known bill but no
                // amount yet (`?billId=` smart-default).
                setApplyRows((prev) =>
                    prev.map((r) =>
                        r.billId && !r.amount && meta[r.billId]
                            ? { ...r, amount: String(meta[r.billId].balance) }
                            : r,
                    ),
                );
            } catch {
                setBillMeta({});
                setBillsCatalog([]);
            }
        });
    }, [vendorId]);

    const totalAmount = useMemo(() => {
        return applyRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    }, [applyRows]);

    const serializedApplyTo = useMemo(() => {
        return applyRows
            .filter((r) => r.billId && Number(r.amount) > 0)
            .map((r) => ({
                billId: r.billId,
                amount: Number(r.amount),
            }));
    }, [applyRows]);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push(
                state.id
                    ? `/dashboard/crm/purchases/payouts/${state.id}`
                    : '/dashboard/crm/purchases/payouts',
            );
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const addRow = () => setApplyRows((prev) => [...prev, blankRow()]);
    const removeRow = (rowKey: string) =>
        setApplyRows((prev) =>
            prev.length > 1 ? prev.filter((r) => r.rowKey !== rowKey) : prev,
        );
    const updateRow = (rowKey: string, patch: Partial<PayoutApplyRow>) =>
        setApplyRows((prev) =>
            prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)),
        );

    const dateDefault = (() => {
        if (initial?.date) {
            const d = new Date(initial.date);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        }
        return new Date().toISOString().slice(0, 10);
    })();

    const totalSettled = totalAmount;

    // Datalist id for the open-bills picker — reused across rows.
    const billsDatalistId = 'open-bills-datalist';

    return (
        <form ref={formRef} action={formAction} className="space-y-6">
            {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="excessAsAdvance" value={excessAsAdvance ? 'true' : 'false'} />
            {/*
              Two-way apply-row serialization:
                • `applyTo` (JSON blob) — primary, the action prefers this.
                • `applyTo[N].billId` / `applyTo[N].amount` flat keys —
                  legacy fallback.
            */}
            <input type="hidden" name="applyTo" value={JSON.stringify(serializedApplyTo)} />
            {serializedApplyTo.map((row, idx) => (
                <React.Fragment key={`row-${idx}`}>
                    <input
                        type="hidden"
                        name={`applyTo[${idx}].billId`}
                        value={row.billId}
                    />
                    <input
                        type="hidden"
                        name={`applyTo[${idx}].amount`}
                        value={String(row.amount)}
                    />
                </React.Fragment>
            ))}
            {/* Amount is the sum of apply rows for create. On edit we
                send the existing amount untouched. */}
            {!editing ? (
                <input type="hidden" name="amount" value={String(totalAmount)} />
            ) : null}

            {/* ─── Header ─────────────────────────────────────────── */}
            <Card className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Payout
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <Label htmlFor="paymentNo">
                            Payment # <span className="text-[var(--st-danger)]">*</span>
                        </Label>
                        <Input
                            id="paymentNo"
                            name="paymentNo"
                            required
                            defaultValue={initial?.paymentNo ?? ''}
                            className="mt-1.5"
                            placeholder="PAY-00001"
                        />
                    </div>
                    <div>
                        <Label htmlFor="date">
                            Date <span className="text-[var(--st-danger)]">*</span>
                        </Label>
                        <Input
                            id="date"
                            name="date"
                            type="date"
                            required
                            defaultValue={dateDefault}
                            className="mt-1.5"
                        />
                    </div>
                    <div>
                        <Label>
                            Vendor <span className="text-[var(--st-danger)]">*</span>
                        </Label>
                        <div className="mt-1.5">
                            <EntityFormField
                                entity="vendor"
                                name="vendorId"
                                initialId={vendorId || null}
                                required
                                disabled={editing}
                                onChange={(id) => setVendorId(id ?? '')}
                            />
                        </div>
                        {editing ? (
                            <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                                Vendor is locked after creation. Void and recreate the
                                payout if it must be reassigned.
                            </p>
                        ) : null}
                    </div>
                    <div>
                        <Label>Mode</Label>
                        <div className="mt-1.5">
                            <EnumFormField
                                enumName="paymentMode"
                                name="__mode_picker"
                                initialId={mode || null}
                                disabled={editing}
                                onChange={(id) => setMode((id ?? 'cash') as CrmPayoutMode)}
                            />
                        </div>
                    </div>
                    <div>
                        <Label>Bank account</Label>
                        <div className="mt-1.5">
                            <EntityFormField
                                entity="bankAccount"
                                name="bankAccountId"
                                initialId={bankAccountId || null}
                                onChange={(id) => setBankAccountId(id ?? '')}
                            />
                        </div>
                    </div>
                    <div>
                        <Label>Currency</Label>
                        <div className="mt-1.5">
                            <EntityFormField
                                entity="currency"
                                name="currency"
                                initialId={currency}
                                onChange={(next) => setCurrency(next ?? 'INR')}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* ─── Mode-specific reference fields ─────────────────── */}
            <Card className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Reference
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <Label htmlFor="chequeNo">Cheque #</Label>
                        <Input
                            id="chequeNo"
                            name="chequeNo"
                            defaultValue={initial?.chequeNo ?? ''}
                            className="mt-1.5"
                            placeholder="CHQ-…"
                            disabled={mode !== 'cheque' && !initial?.chequeNo}
                        />
                    </div>
                    <div>
                        <Label htmlFor="chequeDate">Cheque date</Label>
                        <Input
                            id="chequeDate"
                            name="chequeDate"
                            type="date"
                            defaultValue={
                                initial?.chequeDate
                                    ? new Date(initial.chequeDate).toISOString().slice(0, 10)
                                    : ''
                            }
                            className="mt-1.5"
                            disabled={mode !== 'cheque' && !initial?.chequeDate}
                        />
                    </div>
                    <div>
                        <Label htmlFor="txnId">Transaction ID</Label>
                        <Input
                            id="txnId"
                            name="txnId"
                            defaultValue={initial?.txnId ?? ''}
                            className="mt-1.5"
                            placeholder="TXN-…"
                        />
                    </div>
                    <div>
                        <Label htmlFor="reference">Reference / note</Label>
                        <Input
                            id="reference"
                            name="reference"
                            defaultValue={initial?.reference ?? ''}
                            className="mt-1.5"
                            placeholder="Free-text reference"
                        />
                    </div>
                    <div>
                        <Label htmlFor="exchangeRate">Exchange rate</Label>
                        <Input
                            id="exchangeRate"
                            name="exchangeRate"
                            type="number"
                            min={0}
                            step="0.0001"
                            defaultValue={
                                initial?.exchangeRate != null ? String(initial.exchangeRate) : ''
                            }
                            className="mt-1.5"
                            placeholder="1.0000"
                        />
                    </div>
                    <div>
                        <Label>Status</Label>
                        <div className="mt-1.5">
                            <EnumFormField
                                enumName="payoutStatus"
                                name="__status_picker"
                                initialId={status || null}
                                onChange={(id) => setStatus((id ?? 'sent') as CrmPayoutStatus)}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* ─── Apply to bills ─────────────────────────────────── */}
            <Card className="p-6">
                <PayoutApplyRows
                    rows={applyRows}
                    onAdd={addRow}
                    onRemove={removeRow}
                    onUpdate={updateRow}
                    billsCatalog={billsCatalog}
                    billMeta={billMeta}
                    billsDatalistId={billsDatalistId}
                    disabled={editing}
                    vendorPicked={!!vendorId}
                    busy={billsLoading}
                    currency={currency}
                    excessAsAdvance={excessAsAdvance}
                    onToggleExcess={setExcessAsAdvance}
                    fmtMoney={fmtMoney}
                    totalSettled={totalSettled}
                />
            </Card>

            {/* ─── TDS / notes ────────────────────────────────────── */}
            <Card className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Deductions & notes
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                            <input
                                type="checkbox"
                                checked={tdsDeductedFlag}
                                onChange={(e) => setTdsDeductedFlag(e.target.checked)}
                                className="h-4 w-4 rounded border-[var(--st-border)]"
                            />
                            TDS deducted
                        </label>
                    </div>
                    <div>
                        <Label htmlFor="tdsDeducted">TDS amount</Label>
                        <Input
                            id="tdsDeducted"
                            name="tdsDeducted"
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={
                                initial?.tdsDeducted != null ? String(initial.tdsDeducted) : ''
                            }
                            className="mt-1.5"
                            disabled={!tdsDeductedFlag}
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        defaultValue={initial?.notes ?? ''}
                        className="mt-1.5"
                        rows={3}
                        placeholder="Internal or vendor-facing notes"
                    />
                </div>
            </Card>

            <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                    <Link
                        href={
                            editing
                                ? `/dashboard/crm/purchases/payouts/${String(initial!._id)}`
                                : '/dashboard/crm/purchases/payouts'
                        }
                    >
                        Cancel
                    </Link>
                </Button>
                <SubmitButton editing={editing} />
            </div>
        </form>
    );
}
