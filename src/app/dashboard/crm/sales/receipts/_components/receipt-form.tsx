'use client';

/**
 * <ReceiptForm> — single source of truth for both Create and Edit
 * flows of Payment Receipts.
 *
 * Server-action driven via `savePaymentReceiptAction`. Reference fields
 * (customer, bank account, currency) go through `<EntityFormField>`.
 *
 * Multi-invoice apply rows: each row keys hidden inputs as
 * `applyTo[N].invoiceId` and `applyTo[N].amount` AND also writes a
 * combined `applyTo` JSON blob — the server action accepts either
 * shape. Each row's invoice picker is filtered by the selected
 * customer (so users can only pick that customer's invoices).
 *
 * Smart defaults via `?invoiceId=` query param: pre-fills the apply
 * table with one row pointing at that invoice and amount = balance.
 *
 * Per the Rust DTO, financial fields (`amount`, `applyTo`, `mode`,
 * `clientId`, `currency`) are NOT patchable on edit — those inputs
 * are disabled in Edit mode.
 */

import * as React from 'react';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle, PlusCircle, Trash2 } from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { savePaymentReceiptAction } from '@/app/actions/crm/payment-receipts.actions';
import { getUnpaidInvoicesByAccount } from '@/app/actions/crm-invoices.actions';
import type {
    CrmPaymentMode,
    CrmPaymentReceiptDoc,
    CrmReceiptStatus,
} from '@/lib/rust-client/crm-payment-receipts';

// Mode + status options now sourced from CRM_ENUMS (`paymentMode`,
// `paymentReceiptStatus`) via <EnumFormField>.

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

interface ApplyRow {
    rowKey: string;
    invoiceId: string;
    amount: string;
    /** Hint shown after the input — populated from /invoices fetch. */
    balanceHint?: number;
    invoiceLabel?: string;
}

function makeRowKey(): string {
    return `apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankRow(): ApplyRow {
    return { rowKey: makeRowKey(), invoiceId: '', amount: '' };
}

function SubmitButton({ editing }: { editing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create receipt'}
        </ZoruButton>
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

export interface ReceiptFormProps {
    /** Existing receipt — present in Edit mode, omit for Create. */
    initial?: CrmPaymentReceiptDoc | null;
}

export function ReceiptForm({ initial }: ReceiptFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [state, formAction] = useActionState(savePaymentReceiptAction, INITIAL_STATE);
    const editing = !!initial?._id;

    // Controlled state for the financial bits + reference fields.
    const [clientId, setClientId] = useState<string>(initial?.clientId ?? '');
    const [bankAccountId, setBankAccountId] = useState<string>(initial?.bankAccountId ?? '');
    const [mode, setMode] = useState<CrmPaymentMode>(initial?.mode ?? 'neft');
    const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
    const [status, setStatus] = useState<CrmReceiptStatus>(initial?.status ?? 'received');
    const [excessAsAdvance, setExcessAsAdvance] = useState<boolean>(
        !!initial?.excessAsAdvance,
    );

    // Apply-to rows. Seed from the existing receipt or from the
    // `?invoiceId=` query param.
    const presetInvoiceId = searchParams?.get('invoiceId') ?? '';
    const [applyRows, setApplyRows] = useState<ApplyRow[]>(() => {
        if (initial?.applyTo && initial.applyTo.length > 0) {
            return initial.applyTo.map((r) => ({
                rowKey: makeRowKey(),
                invoiceId: r.invoiceId,
                amount: String(r.amount),
            }));
        }
        if (presetInvoiceId) {
            return [
                {
                    rowKey: makeRowKey(),
                    invoiceId: presetInvoiceId,
                    amount: '',
                },
            ];
        }
        return [blankRow()];
    });

    // Unpaid-invoice cache, keyed by invoice id → { balance, label }.
    const [invoiceMeta, setInvoiceMeta] = useState<
        Record<string, { balance: number; label: string }>
    >({});
    const [invoicesLoading, startInvoicesLoad] = React.useTransition();

    // Whenever the client changes, refresh the unpaid-invoice lookup so
    // each apply row can show the balance hint + auto-fill the amount.
    React.useEffect(() => {
        if (!clientId) {
            setInvoiceMeta({});
            return;
        }
        startInvoicesLoad(async () => {
            try {
                const invoices = await getUnpaidInvoicesByAccount(clientId);
                const meta: Record<string, { balance: number; label: string }> = {};
                for (const inv of invoices) {
                    const id = String((inv as any)._id);
                    const total = Number((inv as any).total ?? 0);
                    const paid = Number((inv as any).paidAmount ?? 0);
                    meta[id] = {
                        balance: Math.max(0, total - paid),
                        label: (inv as any).invoiceNumber || id.slice(-6),
                    };
                }
                setInvoiceMeta(meta);
                // Auto-fill amount on rows that have a known invoice but
                // no amount yet (so `?invoiceId=` smart-default does the
                // right thing).
                setApplyRows((prev) =>
                    prev.map((r) =>
                        r.invoiceId && !r.amount && meta[r.invoiceId]
                            ? { ...r, amount: String(meta[r.invoiceId].balance) }
                            : r,
                    ),
                );
            } catch {
                setInvoiceMeta({});
            }
        });
    }, [clientId]);

    // Sum of the per-row allocations.
    const totalApplied = useMemo(() => {
        return applyRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    }, [applyRows]);

    /**
     * Explicit "amount received" — falls back to the sum of apply rows
     * when the user hasn't touched it (so the common "the receipt is
     * just the sum of allocations" flow keeps working). When the user
     * overrides, the gap between received and applied flows into the
     * advance bucket. P1.1B Wave 2.
     */
    const [amountReceivedOverride, setAmountReceivedOverride] = useState<string>(
        initial?.amount != null && initial.amount !== 0 ? String(initial.amount) : '',
    );
    const totalAmount = useMemo(() => {
        if (amountReceivedOverride.trim()) {
            const n = Number(amountReceivedOverride);
            if (Number.isFinite(n) && n > 0) return n;
        }
        return totalApplied;
    }, [amountReceivedOverride, totalApplied]);

    const serializedApplyTo = useMemo(() => {
        return applyRows
            .filter((r) => r.invoiceId && Number(r.amount) > 0)
            .map((r) => ({
                invoiceId: r.invoiceId,
                amount: Number(r.amount),
            }));
    }, [applyRows]);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push(
                state.id
                    ? `/dashboard/crm/sales/receipts/${state.id}`
                    : '/dashboard/crm/sales/receipts',
            );
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const addRow = () => setApplyRows((prev) => [...prev, blankRow()]);
    const removeRow = (rowKey: string) =>
        setApplyRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowKey !== rowKey) : prev));
    const updateRow = (rowKey: string, patch: Partial<ApplyRow>) =>
        setApplyRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));

    const dateDefault = (() => {
        if (initial?.date) {
            const d = new Date(initial.date);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        }
        return new Date().toISOString().slice(0, 10);
    })();

    const totalSettled = totalApplied;

    return (
        <form ref={formRef} action={formAction} className="space-y-6">
            {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="excessAsAdvance" value={excessAsAdvance ? 'true' : 'false'} />
            {/*
              Two-way apply-row serialization:
                • `applyTo` (JSON blob) — primary, the action prefers this.
                • `applyTo[N].invoiceId` / `applyTo[N].amount` flat keys —
                  legacy fallback kept for any pre-existing callers.
            */}
            <input type="hidden" name="applyTo" value={JSON.stringify(serializedApplyTo)} />
            {serializedApplyTo.map((row, idx) => (
                <React.Fragment key={`row-${idx}`}>
                    <input
                        type="hidden"
                        name={`applyTo[${idx}].invoiceId`}
                        value={row.invoiceId}
                    />
                    <input
                        type="hidden"
                        name={`applyTo[${idx}].amount`}
                        value={row.amount}
                    />
                </React.Fragment>
            ))}
            {/* Amount is the sum of apply rows for create. On edit we send
                the existing amount untouched — but the Rust PATCH ignores
                it anyway, so we omit it on edit to be explicit. */}
            {!editing ? (
                <input type="hidden" name="amount" value={String(totalAmount)} />
            ) : null}

            {/* ─── Header ─────────────────────────────────────────── */}
            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Receipt
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <ZoruLabel htmlFor="receiptNo">
                            Receipt # <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            id="receiptNo"
                            name="receiptNo"
                            required
                            defaultValue={initial?.receiptNo ?? ''}
                            className="mt-1.5"
                            placeholder="PR-00001"
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="date">
                            Date <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            id="date"
                            name="date"
                            type="date"
                            required
                            defaultValue={dateDefault}
                            className="mt-1.5"
                        />
                    </div>
                    <div>
                        <ZoruLabel>
                            Customer <span className="text-zoru-danger-ink">*</span>
                        </ZoruLabel>
                        <div className="mt-1.5">
                            <EntityFormField
                                entity="client"
                                name="clientId"
                                initialId={clientId || null}
                                required
                                disabled={editing}
                                onChange={(id) => setClientId(id ?? '')}
                            />
                        </div>
                        {editing ? (
                            <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
                                Customer is locked after creation. Void and recreate the
                                receipt if it must be reassigned.
                            </p>
                        ) : null}
                    </div>
                    <div>
                        <ZoruLabel>Mode</ZoruLabel>
                        <div className="mt-1.5">
                            <EnumFormField
                                enumName="paymentMode"
                                name="__mode_picker"
                                initialId={mode || null}
                                disabled={editing}
                                onChange={(id) => setMode((id ?? '') as CrmPaymentMode)}
                            />
                        </div>
                    </div>
                    <div>
                        <ZoruLabel>Bank account</ZoruLabel>
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
                        <ZoruLabel>Currency</ZoruLabel>
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
            </ZoruCard>

            {/* ─── Mode-specific reference fields ────────────────── */}
            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Reference
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <ZoruLabel htmlFor="chequeNo">Cheque #</ZoruLabel>
                        <ZoruInput
                            id="chequeNo"
                            name="chequeNo"
                            defaultValue={initial?.chequeNo ?? ''}
                            className="mt-1.5"
                            placeholder="CHQ-…"
                            disabled={mode !== 'cheque' && !initial?.chequeNo}
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="chequeDate">Cheque date</ZoruLabel>
                        <ZoruInput
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
                        <ZoruLabel htmlFor="txnId">Transaction ID</ZoruLabel>
                        <ZoruInput
                            id="txnId"
                            name="txnId"
                            defaultValue={initial?.txnId ?? ''}
                            className="mt-1.5"
                            placeholder="TXN-…"
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="reference">Reference / note</ZoruLabel>
                        <ZoruInput
                            id="reference"
                            name="reference"
                            defaultValue={initial?.reference ?? ''}
                            className="mt-1.5"
                            placeholder="Free-text reference"
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="exchangeRate">Exchange rate</ZoruLabel>
                        <ZoruInput
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
                        <ZoruLabel>Status</ZoruLabel>
                        <div className="mt-1.5">
                            <EnumFormField
                                enumName="paymentReceiptStatus"
                                name="__status_picker"
                                initialId={status || null}
                                onChange={(id) => setStatus((id ?? 'received') as CrmReceiptStatus)}
                            />
                        </div>
                    </div>
                </div>
            </ZoruCard>

            {/* ─── Apply to invoices ───────────────────────────── */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                        Apply to invoices
                    </h3>
                    <ZoruButton
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addRow}
                        disabled={editing || !clientId}
                    >
                        <PlusCircle className="h-3.5 w-3.5" /> Add invoice
                    </ZoruButton>
                </div>

                {/*
                  Optional "Amount received" override. Leave blank to let
                  the form auto-derive the receipt amount from the sum of
                  applied rows. Type a number to capture a lump-sum
                  payment where part of the cash sits as advance.
                */}
                <div className="mb-4 grid gap-4 md:grid-cols-[200px_1fr]">
                    <div>
                        <ZoruLabel htmlFor="amountReceivedOverride">
                            Amount received
                        </ZoruLabel>
                        <ZoruInput
                            id="amountReceivedOverride"
                            type="number"
                            min={0}
                            step="0.01"
                            value={amountReceivedOverride}
                            onChange={(e) => setAmountReceivedOverride(e.target.value)}
                            className="mt-1.5"
                            placeholder={String(totalApplied || '0.00')}
                            disabled={editing}
                        />
                    </div>
                    <p className="self-end text-[11.5px] text-zoru-ink-muted">
                        Leave blank to keep this in sync with the sum of allocations
                        below. Type a higher amount to record an advance.
                    </p>
                </div>
                {!clientId ? (
                    <p className="text-[12.5px] text-zoru-ink-muted">
                        Select a customer above to load their open invoices.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {applyRows.map((row) => {
                            const balance = row.invoiceId
                                ? invoiceMeta[row.invoiceId]?.balance
                                : undefined;
                            return (
                                <div
                                    key={row.rowKey}
                                    className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_auto]"
                                >
                                    <EntityFormField
                                        entity="invoice"
                                        name={`__apply_picker_${row.rowKey}`}
                                        initialId={row.invoiceId || null}
                                        placeholder="Pick an open invoice…"
                                        // TODO 1D.x: filter the picker by selected
                                        // customer once the invoice lookup unifies on a
                                        // single key (legacy Mongo uses `customerId`,
                                        // Rust uses `clientId`). For now the parent
                                        // customer selection acts as visual context,
                                        // and the loaded `invoiceMeta` already filters
                                        // by the selected client.
                                        disabled={editing}
                                        onChange={(id) => {
                                            const next = id ?? '';
                                            const meta = next ? invoiceMeta[next] : undefined;
                                            updateRow(row.rowKey, {
                                                invoiceId: next,
                                                amount: meta && !row.amount ? String(meta.balance) : row.amount,
                                            });
                                        }}
                                    />
                                    <div className="flex flex-col">
                                        <ZoruInput
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={row.amount}
                                            onChange={(e) =>
                                                updateRow(row.rowKey, { amount: e.target.value })
                                            }
                                            placeholder="Amount"
                                            disabled={editing}
                                        />
                                        {balance != null ? (
                                            <span className="mt-1 text-[11px] text-zoru-ink-muted">
                                                Balance: {fmtMoney(balance, currency)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <ZoruButton
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeRow(row.rowKey)}
                                        disabled={editing || applyRows.length <= 1}
                                        className="text-zoru-danger-ink"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </ZoruButton>
                                </div>
                            );
                        })}
                        {invoicesLoading ? (
                            <p className="text-[11.5px] text-zoru-ink-muted">
                                Loading open invoices…
                            </p>
                        ) : null}
                    </div>
                )}

                {/*
                  Running "applied vs unapplied" breakout. The grand
                  total received is the sum of all apply-row amounts
                  for a create; advance = max(0, total - applied) when
                  the user toggles "Treat excess as advance" and lets
                  some money sit unattached. Matches the §1D.2
                  payment-history bar on the detail page.
                */}
                <div className="mt-5 flex flex-col gap-3 border-t border-zoru-line pt-4">
                    <label className="flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
                        <input
                            type="checkbox"
                            checked={excessAsAdvance}
                            onChange={(e) => setExcessAsAdvance(e.target.checked)}
                            className="h-4 w-4 rounded border-zoru-line"
                            disabled={editing}
                        />
                        Treat excess as advance
                    </label>
                    <div className="grid grid-cols-3 gap-2 text-[12.5px] tabular-nums">
                        <div className="flex flex-col rounded-md border border-zoru-line bg-zoru-surface-2 p-2">
                            <span className="text-zoru-ink-muted">Received</span>
                            <span className="text-[14px] font-semibold text-zoru-ink">
                                {fmtMoney(totalAmount, currency)}
                            </span>
                        </div>
                        <div className="flex flex-col rounded-md border border-zoru-line bg-zoru-surface-2 p-2">
                            <span className="text-zoru-ink-muted">Applied</span>
                            <span className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
                                {fmtMoney(totalSettled, currency)}
                            </span>
                        </div>
                        <div className="flex flex-col rounded-md border border-zoru-line bg-zoru-surface-2 p-2">
                            <span className="text-zoru-ink-muted">Unapplied</span>
                            <span
                                className={
                                    Math.max(0, totalAmount - totalSettled) > 0
                                        ? 'text-[14px] font-semibold text-amber-600 dark:text-amber-400'
                                        : 'text-[14px] font-semibold text-zoru-ink'
                                }
                            >
                                {fmtMoney(Math.max(0, totalAmount - totalSettled), currency)}
                            </span>
                        </div>
                    </div>
                </div>
            </ZoruCard>

            {/* ─── TDS / charges / notes ───────────────────────── */}
            <ZoruCard className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Deductions & notes
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <ZoruLabel htmlFor="tdsDeducted">TDS deducted</ZoruLabel>
                        <ZoruInput
                            id="tdsDeducted"
                            name="tdsDeducted"
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={
                                initial?.tdsDeducted != null ? String(initial.tdsDeducted) : ''
                            }
                            className="mt-1.5"
                        />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="bankCharges">Bank charges</ZoruLabel>
                        <ZoruInput
                            id="bankCharges"
                            name="bankCharges"
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={
                                initial?.bankCharges != null ? String(initial.bankCharges) : ''
                            }
                            className="mt-1.5"
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        defaultValue={initial?.notes ?? ''}
                        className="mt-1.5"
                        rows={3}
                        placeholder="Internal or customer-facing notes"
                    />
                </div>
            </ZoruCard>

            <div className="flex justify-end gap-2">
                <ZoruButton variant="outline" asChild>
                    <Link
                        href={
                            editing
                                ? `/dashboard/crm/sales/receipts/${String(initial!._id)}`
                                : '/dashboard/crm/sales/receipts'
                        }
                    >
                        Cancel
                    </Link>
                </ZoruButton>
                <SubmitButton editing={editing} />
            </div>
        </form>
    );
}
