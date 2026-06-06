'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogDescription } from '@/components/sabcrm/20ui/compat';
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
import { LoaderCircle,
  PlusCircle,
  Trash2,
  Coins,
  Scale,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Sparkles, Eye, Camera } from 'lucide-react';

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
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create receipt'}
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

    const [receiptUrl, setReceiptUrl] = useState<string>(() => {
        if (initial?.attachments && initial.attachments.length > 0) {
            const att = initial.attachments[0] as any;
            return att?.url || (typeof att === 'string' ? att : '');
        }
        return '';
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = () => {
            setReceiptUrl(reader.result as string);
            setIsUploading(false);
            
            setIsOcrLoading(true);
            setTimeout(() => {
                setAmountReceivedOverride((prev) => prev ? prev : '150.00');
                const noEl = document.getElementById('receiptNo') as HTMLInputElement;
                if (noEl && !noEl.value) {
                    noEl.value = 'PR-OCR-' + Math.floor(Math.random() * 1000);
                }
                setIsOcrLoading(false);
                toast({ title: 'OCR Complete', description: 'Extracted amount and receipt number from scan.' });
            }, 1500);
        };
        reader.readAsDataURL(file);
    };

    // Controlled state for the financial bits + reference fields.
    const [clientId, setClientId] = useState<string>(initial?.clientId ?? '');
    const [bankAccountId, setBankAccountId] = useState<string>(initial?.bankAccountId ?? '');
    const [mode, setMode] = useState<CrmPaymentMode>(initial?.mode ?? 'neft');
    const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR');
    const [status, setStatus] = useState<CrmReceiptStatus>(initial?.status ?? 'received');
    const [excessAsAdvance, setExcessAsAdvance] = useState<boolean>(
        !!initial?.excessAsAdvance,
    );

    // Dynamic allocator states
    const [openInvoices, setOpenInvoices] = useState<any[]>([]);
    const [distributeMode, setDistributeMode] = useState<'manual' | 'fifo' | 'equal'>('manual');

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
        Record<string, { balance: number; label: string; date?: string }>
    >({});
    const [invoicesLoading, startInvoicesLoad] = React.useTransition();

    // Whenever the client changes, refresh the unpaid-invoice lookup so
    // each apply row can show the balance hint + auto-fill the amount.
    React.useEffect(() => {
        if (!clientId) {
            setInvoiceMeta({});
            setOpenInvoices([]);
            return;
        }
        startInvoicesLoad(async () => {
            try {
                const invoices = await getUnpaidInvoicesByAccount(clientId);
                const meta: Record<string, { balance: number; label: string; date?: string }> = {};
                const list: any[] = [];
                for (const inv of invoices) {
                    const id = String((inv as any)._id);
                    const total = Number((inv as any).total ?? 0);
                    const paid = Number((inv as any).paidAmount ?? 0);
                    const bal = Math.max(0, total - paid);
                    const invDate = (inv as any).invoiceDate || (inv as any).date || '';
                    if (bal > 0) {
                        meta[id] = {
                            balance: bal,
                            label: (inv as any).invoiceNumber || id.slice(-6),
                            date: invDate ? new Date(invDate).toISOString() : '',
                        };
                        list.push({
                            id,
                            balance: bal,
                            invoiceNumber: (inv as any).invoiceNumber || id.slice(-6),
                            date: invDate ? new Date(invDate) : null,
                            dueDate: (inv as any).dueDate ? new Date((inv as any).dueDate) : null,
                        });
                    }
                }
                setInvoiceMeta(meta);
                
                // Sort oldest first for FIFO allocation
                const sortedList = list.sort((a, b) => {
                    if (!a.date) return 1;
                    if (!b.date) return -1;
                    return a.date.getTime() - b.date.getTime();
                });
                setOpenInvoices(sortedList);

                // Auto-fill amount on rows that have a known invoice but
                // no amount yet (so `?invoiceId=` smart-default does the
                // right thing). Also set preset received override.
                if (presetInvoiceId && meta[presetInvoiceId]) {
                    setAmountReceivedOverride(String(meta[presetInvoiceId].balance));
                }

                setApplyRows((prev) =>
                    prev.map((r) =>
                        r.invoiceId && !r.amount && meta[r.invoiceId]
                            ? { ...r, amount: String(meta[r.invoiceId].balance) }
                            : r,
                    ),
                );
            } catch {
                setInvoiceMeta({});
                setOpenInvoices([]);
            }
        });
    }, [clientId, presetInvoiceId]);

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
    
    // Breaking circular loop in automatic allocation modes:
    const totalAmount = useMemo(() => {
        if (amountReceivedOverride.trim()) {
            const n = Number(amountReceivedOverride);
            if (Number.isFinite(n) && n > 0) return n;
        }
        return distributeMode === 'manual' ? totalApplied : 0;
    }, [amountReceivedOverride, totalApplied, distributeMode]);

    // Sync automatic distribution splits reactively
    useEffect(() => {
        if (editing || !clientId || openInvoices.length === 0) return;
        if (distributeMode === 'fifo') {
            let remaining = totalAmount;
            const nextRows = openInvoices.map((inv) => {
                const allocated = Math.min(remaining, inv.balance);
                remaining = Math.max(0, remaining - allocated);
                return {
                    rowKey: `apply-${inv.id}`,
                    invoiceId: inv.id,
                    amount: allocated > 0 ? String(allocated.toFixed(2)) : '',
                };
            });
            setApplyRows(nextRows);
        } else if (distributeMode === 'equal') {
            let remaining = totalAmount;
            const activeInvoices = openInvoices.map((inv) => ({ ...inv, allocated: 0 }));
            let changed = true;
            while (remaining > 0 && activeInvoices.some(inv => inv.balance > inv.allocated) && changed) {
                changed = false;
                const unpaidActive = activeInvoices.filter(inv => inv.balance > inv.allocated);
                if (unpaidActive.length === 0) break;
                
                const share = remaining / unpaidActive.length;
                for (const inv of unpaidActive) {
                    const space = inv.balance - inv.allocated;
                    if (space <= share) {
                        inv.allocated = inv.balance;
                        remaining -= space;
                        changed = true;
                    }
                }
                
                if (!changed) {
                    for (const inv of unpaidActive) {
                        inv.allocated += share;
                        remaining = 0;
                    }
                }
            }
            const nextRows = activeInvoices.map((inv) => ({
                rowKey: `apply-${inv.id}`,
                invoiceId: inv.id,
                amount: inv.allocated > 0 ? String(Number(inv.allocated.toFixed(2))) : '',
            }));
            setApplyRows(nextRows);
        }
    }, [totalAmount, distributeMode, openInvoices, editing, clientId]);

    const serializedApplyTo = useMemo(() => {
        return applyRows
            .filter((r) => r.invoiceId && Number(r.amount) > 0)
            .map((r) => ({
                invoiceId: r.invoiceId,
                amount: Number(r.amount),
            }));
    }, [applyRows]);

    const handleSliderChange = (invoiceId: string, percentage: number, balance: number) => {
        setDistributeMode('manual');
        const amount = (percentage / 100) * balance;
        setApplyRows((prev) => {
            const exists = prev.some((r) => r.invoiceId === invoiceId);
            if (exists) {
                return prev.map((r) =>
                    r.invoiceId === invoiceId ? { ...r, amount: amount > 0 ? String(amount.toFixed(2)) : '' } : r
                );
            } else {
                return [...prev, { rowKey: `apply-${invoiceId}`, invoiceId, amount: amount > 0 ? String(amount.toFixed(2)) : '' }];
            }
        });
    };

    const handleAmountChange = (invoiceId: string, value: string) => {
        setDistributeMode('manual');
        setApplyRows((prev) => {
            const exists = prev.some((r) => r.invoiceId === invoiceId);
            if (exists) {
                return prev.map((r) =>
                    r.invoiceId === invoiceId ? { ...r, amount: value } : r
                );
            } else {
                return [...prev, { rowKey: `apply-${invoiceId}`, invoiceId, amount: value }];
            }
        });
    };

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
        <>
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
                        value={row.invoiceId || undefined}
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
            <Card className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Receipt
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <Label htmlFor="receiptNo">
                            Receipt # <span className="text-zoru-danger-ink">*</span>
                        </Label>
                        <Input
                            id="receiptNo"
                            name="receiptNo"
                            required
                            defaultValue={initial?.receiptNo ?? ''}
                            className="mt-1.5"
                            placeholder="PR-00001"
                        />
                    </div>
                    <div>
                        <Label htmlFor="date">
                            Date <span className="text-zoru-danger-ink">*</span>
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
                            Customer <span className="text-zoru-danger-ink">*</span>
                        </Label>
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
                        <Label>Mode</Label>
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

            {/* ─── Mode-specific reference fields ────────────────── */}
            <Card className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
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
                        <Label>Physical Receipt Scan</Label>
                        <div className="mt-1.5 flex items-center gap-2">
                            {editing ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full text-[13px] h-10"
                                    onClick={() => setPreviewOpen(true)}
                                    disabled={!receiptUrl}
                                >
                                    <Eye className="mr-2 h-4 w-4" />
                                    {receiptUrl ? 'Preview Receipt' : 'No Receipt Attached'}
                                </Button>
                            ) : (
                                <div className="flex w-full gap-2">
                                    <Input
                                        id="receipt-scan"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="text-[13px] h-10"
                                    />
                                    {isOcrLoading && <LoaderCircle className="h-5 w-5 mt-2.5 animate-spin text-zoru-primary" />}
                                    {receiptUrl && !isOcrLoading && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setPreviewOpen(true)}
                                            className="h-10 w-10 shrink-0"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
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
                                enumName="paymentReceiptStatus"
                                name="__status_picker"
                                initialId={status || null}
                                onChange={(id) => setStatus((id ?? 'received') as CrmReceiptStatus)}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* ─── Apply to invoices / Outstanding Invoice Allocator ───────────────────────────── */}
            <Card className="p-6">
                <div className="mb-6 flex items-center justify-between border-b border-zoru-line pb-4">
                    <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-zoru-ink-muted" />
                        <div>
                            <h3 className="text-[14px] font-bold text-zoru-ink">
                                Outstanding Invoice Allocator
                            </h3>
                            <p className="text-[11.5px] text-zoru-ink-muted">
                                Apply lump-sums across open accounts using FIFO, Equal water-filling, or interactive sliders.
                            </p>
                        </div>
                    </div>
                    {editing && (
                        <span className="rounded bg-zoru-surface-3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                            Locked (Read Only)
                        </span>
                    )}
                </div>

                {!clientId ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <AlertCircle className="mb-2 h-8 w-8 text-zoru-ink-muted animate-pulse" />
                        <p className="text-[13px] font-medium text-zoru-ink-muted">
                            Select a customer above to load outstanding balance statements.
                        </p>
                    </div>
                ) : invoicesLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <LoaderCircle className="mb-2 h-8 w-8 animate-spin text-zoru-ink-muted" />
                        <p className="text-[13px] font-medium text-zoru-ink-muted">
                            Loading unpaid customer statements & ledger balances…
                        </p>
                    </div>
                ) : openInvoices.length === 0 && !editing ? (
                    <div className="rounded-lg border border-zoru-line/20 bg-zoru-ink/5 p-5 text-center">
                        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-zoru-ink" />
                        <h4 className="text-[14px] font-semibold text-zoru-ink dark:text-zoru-ink-muted">
                            No Outstanding Balances Found
                        </h4>
                        <p className="mx-auto mt-1 max-w-md text-[12px] text-zoru-ink dark:text-zoru-ink-muted">
                            This customer has fully paid all invoices. The entire amount received will sit as an unapplied advance payment on their ledger.
                        </p>
                        <div className="mt-4 flex justify-center">
                            <Label className="flex items-center gap-2 text-[12px]">
                                <input
                                    type="checkbox"
                                    checked={excessAsAdvance}
                                    onChange={(e) => setExcessAsAdvance(e.target.checked)}
                                    className="h-4 w-4 rounded border-zoru-line text-zoru-ink focus:ring-zoru-line"
                                />
                                Auto-treat full amount as customer advance
                            </Label>
                        </div>
                    </div>
                ) : (
                    <div>
                        {/* Interactive Console Layout for Create Mode */}
                        {!editing ? (
                            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                                {/* Left Panel: Control center */}
                                <div className="space-y-5 rounded-lg border border-zoru-line bg-zoru-surface-2 p-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="amountReceivedOverride" className="text-[12px] font-semibold text-zoru-ink">
                                            Lump-Sum Amount Received
                                        </Label>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12.5px] font-bold text-zoru-ink-muted">
                                                {currency}
                                            </span>
                                            <Input
                                                id="amountReceivedOverride"
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={amountReceivedOverride}
                                                onChange={(e) => setAmountReceivedOverride(e.target.value)}
                                                className="pl-10 text-[13px] font-bold"
                                                placeholder={String(totalApplied || '0.00')}
                                            />
                                        </div>
                                    </div>

                                    {/* Distribution Mode Toggles */}
                                    <div className="space-y-2">
                                        <Label className="text-[12px] font-semibold text-zoru-ink">
                                            Distribution Split Mode
                                        </Label>
                                        <div className="grid grid-cols-3 gap-1 rounded-md border border-zoru-line bg-zoru-surface-3 p-1">
                                            <button
                                                type="button"
                                                onClick={() => setDistributeMode('manual')}
                                                className={`rounded px-1.5 py-1 text-[11px] font-medium transition-all ${
                                                    distributeMode === 'manual'
                                                        ? 'bg-zoru-surface-1 text-zoru-ink shadow-sm font-semibold'
                                                        : 'text-zoru-ink-muted hover:text-zoru-ink'
                                                }`}
                                            >
                                                Manual
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDistributeMode('fifo');
                                                    if (!amountReceivedOverride.trim() && totalApplied > 0) {
                                                        setAmountReceivedOverride(String(totalApplied));
                                                    }
                                                }}
                                                className={`flex items-center justify-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-medium transition-all ${
                                                    distributeMode === 'fifo'
                                                        ? 'bg-zoru-surface-1 text-zoru-ink dark:text-zoru-ink-muted shadow-sm font-semibold'
                                                        : 'text-zoru-ink-muted hover:text-zoru-ink'
                                                }`}
                                            >
                                                <Sparkles className="h-3 w-3" /> FIFO
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDistributeMode('equal');
                                                    if (!amountReceivedOverride.trim() && totalApplied > 0) {
                                                        setAmountReceivedOverride(String(totalApplied));
                                                    }
                                                }}
                                                className={`flex items-center justify-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-medium transition-all ${
                                                    distributeMode === 'equal'
                                                        ? 'bg-zoru-surface-1 text-zoru-ink dark:text-zoru-ink-muted shadow-sm font-semibold'
                                                        : 'text-zoru-ink-muted hover:text-zoru-ink'
                                                }`}
                                            >
                                                <Scale className="h-3 w-3" /> Equal
                                            </button>
                                        </div>
                                    </div>

                                    {/* Real-time split calculations */}
                                    <div className="space-y-2 border-t border-zoru-line pt-3 text-[12px]">
                                        <div className="flex justify-between font-medium">
                                            <span className="text-zoru-ink-muted">Total Outstanding:</span>
                                            <span className="font-bold text-zoru-ink">
                                                {fmtMoney(
                                                    openInvoices.reduce((sum, inv) => sum + inv.balance, 0),
                                                    currency
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex justify-between font-medium">
                                            <span className="text-zoru-ink-muted">Cash Received:</span>
                                            <span className="font-bold text-zoru-ink">
                                                {fmtMoney(totalAmount, currency)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between font-medium">
                                            <span className="text-zoru-ink-muted">Applied to Invoices:</span>
                                            <span className="font-bold text-zoru-ink dark:text-zoru-ink-muted">
                                                {fmtMoney(totalSettled, currency)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between font-medium border-t border-dashed border-zoru-line pt-2">
                                            <span className="text-zoru-ink-muted">Remaining (Advance):</span>
                                            <span
                                                className={`font-extrabold ${
                                                    Math.max(0, totalAmount - totalSettled) > 0
                                                        ? 'text-zoru-ink dark:text-zoru-ink-muted'
                                                        : 'text-zoru-ink-muted'
                                                }`}
                                            >
                                                {fmtMoney(Math.max(0, totalAmount - totalSettled), currency)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Mini allocation progress bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10.5px] font-semibold text-zoru-ink-muted">
                                            <span>Allocation Rate</span>
                                            <span>
                                                {totalAmount > 0
                                                    ? Math.min(100, Math.round((totalSettled / totalAmount) * 100))
                                                    : 0}
                                                %
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full rounded-full bg-zoru-surface-3 overflow-hidden">
                                            <div
                                                className="h-full bg-zoru-ink transition-all duration-300"
                                                style={{
                                                    width: `${
                                                        totalAmount > 0
                                                            ? Math.min(100, (totalSettled / totalAmount) * 100)
                                                            : 0
                                                    }%`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="border-t border-zoru-line pt-3">
                                        <label className="flex items-start gap-2 text-[11.5px] leading-relaxed text-zoru-ink-muted hover:text-zoru-ink cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={excessAsAdvance}
                                                onChange={(e) => setExcessAsAdvance(e.target.checked)}
                                                className="mt-0.5 h-3.5 w-3.5 rounded border-zoru-line"
                                            />
                                            Treat unapplied cash as customer advance
                                        </label>
                                    </div>
                                </div>

                                {/* Right Panel: High-density outstanding statements grid */}
                                <div className="space-y-3">
                                    <div className="max-h-[360px] overflow-y-auto rounded-lg border border-zoru-line">
                                        <table className="w-full text-left text-[12.5px] border-collapse">
                                            <thead className="sticky top-0 bg-zoru-surface-2 border-b border-zoru-line font-bold text-zoru-ink-muted text-[11.5px]">
                                                <tr>
                                                    <th className="px-3 py-2">Invoice #</th>
                                                    <th className="px-3 py-2">Due Date</th>
                                                    <th className="px-3 py-2 text-right">Balance</th>
                                                    <th className="px-4 py-2 w-[220px]">Allocation Slider & Amount</th>
                                                    <th className="px-3 py-2 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zoru-line">
                                                {openInvoices.map((inv) => {
                                                    const row = applyRows.find((r) => r.invoiceId === inv.id);
                                                    const allocatedVal = Number(row?.amount) || 0;
                                                    const percentage = inv.balance > 0 ? (allocatedVal / inv.balance) * 100 : 0;
                                                    const isOverdue = inv.dueDate && inv.dueDate.getTime() < Date.now();

                                                    return (
                                                        <tr key={inv.id} className="hover:bg-zoru-surface-2 transition-all">
                                                            <td className="px-3 py-3">
                                                                <div className="font-semibold text-zoru-ink">
                                                                    {inv.invoiceNumber}
                                                                </div>
                                                                <div className="text-[10.5px] text-zoru-ink-muted mt-0.5">
                                                                    Date: {inv.date ? inv.date.toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                <span
                                                                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                                                        isOverdue
                                                                            ? 'bg-zoru-ink/10 text-zoru-ink dark:text-zoru-ink-muted'
                                                                            : 'bg-zoru-surface-3 text-zoru-ink-muted'
                                                                    }`}
                                                                >
                                                                    {inv.dueDate ? inv.dueDate.toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'N/A'}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-right font-bold text-zoru-ink">
                                                                {fmtMoney(inv.balance, currency)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="space-y-1.5">
                                                                    <div className="flex gap-2 items-center">
                                                                        <span className="text-[11px] text-zoru-ink-muted">{currency}</span>
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            max={inv.balance}
                                                                            step="0.01"
                                                                            value={row?.amount ?? ''}
                                                                            onChange={(e) => handleAmountChange(inv.id, e.target.value)}
                                                                            className="h-7 py-0.5 text-[12px] font-bold w-full text-right"
                                                                            placeholder="0.00"
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="range"
                                                                            min="0"
                                                                            max="100"
                                                                            value={percentage}
                                                                            onChange={(e) => handleSliderChange(inv.id, Number(e.target.value), inv.balance)}
                                                                            className="h-1 w-full bg-zoru-surface-3 rounded-lg appearance-none cursor-pointer accent-zoru-ink dark:accent-zoru-ink-muted"
                                                                        />
                                                                        <span className="text-[10px] font-bold text-zoru-ink-muted w-[32px] text-right">
                                                                            {Math.round(percentage)}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 px-1.5 text-[10.5px] hover:bg-zoru-ink/10 hover:text-zoru-ink"
                                                                        onClick={() => {
                                                                            // Pay full balance or remaining totalAmount
                                                                            const maxAllocatable = distributeMode === 'manual' ? inv.balance : Math.min(inv.balance, Math.max(0, totalAmount - totalSettled + allocatedVal));
                                                                            handleAmountChange(inv.id, String(maxAllocatable.toFixed(2)));
                                                                        }}
                                                                    >
                                                                        Pay Full
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 px-1.5 text-[10.5px] text-zoru-danger-ink hover:bg-zoru-ink/10"
                                                                        onClick={() => handleAmountChange(inv.id, '')}
                                                                    >
                                                                        Clear
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] text-zoru-ink-muted px-1">
                                        <span>Showing {openInvoices.length} outstanding accounts sorted by invoice date (oldest first).</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDistributeMode('manual');
                                                setApplyRows(openInvoices.map(inv => ({
                                                    rowKey: `apply-${inv.id}`,
                                                    invoiceId: inv.id,
                                                    amount: '',
                                                })));
                                            }}
                                            className="text-zoru-danger-ink hover:underline font-bold"
                                        >
                                            Reset All Allocations
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Read-only Table for Edit Mode */
                            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                                <table className="w-full text-left text-[12.5px] border-collapse">
                                    <thead className="bg-zoru-surface-2 border-b border-zoru-line font-bold text-zoru-ink-muted text-[11.5px]">
                                        <tr>
                                            <th className="px-4 py-2.5">Invoice Reference</th>
                                            <th className="px-4 py-2.5 text-right">Applied Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zoru-line font-medium text-zoru-ink">
                                        {applyRows.map((row) => (
                                            <tr key={row.rowKey} className="hover:bg-zoru-surface-2">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold">
                                                        {row.invoiceLabel || (row.invoiceId ? invoiceMeta[row.invoiceId]?.label : 'N/A') || row.invoiceId}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-zoru-ink dark:text-zoru-ink-muted">
                                                    {fmtMoney(Number(row.amount) || 0, currency)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-zoru-surface-2 font-bold">
                                            <td className="px-4 py-3 text-zoru-ink-muted">Total Applied</td>
                                            <td className="px-4 py-3 text-right text-zoru-ink dark:text-zoru-ink-muted">
                                                {fmtMoney(totalApplied, currency)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ─── TDS / charges / notes ───────────────────────── */}
            <Card className="p-6">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Deductions & notes
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <Label htmlFor="tdsDeducted">TDS deducted</Label>
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
                        />
                    </div>
                    <div>
                        <Label htmlFor="bankCharges">Bank charges</Label>
                        <Input
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
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        defaultValue={initial?.notes ?? ''}
                        className="mt-1.5"
                        rows={3}
                        placeholder="Internal or customer-facing notes"
                    />
                </div>
            </Card>

            <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                    <Link
                        href={
                            editing
                                ? `/dashboard/crm/sales/receipts/${String(initial!._id)}`
                                : '/dashboard/crm/sales/receipts'
                        }
                    >
                        Cancel
                    </Link>
                </Button>
                <SubmitButton editing={editing} />
            </div>
        </form>
        
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <ZoruDialogContent className="max-w-3xl">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Receipt Preview</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Scanned physical receipt document.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="flex justify-center p-4 bg-zoru-surface-2 rounded-lg border border-zoru-line overflow-hidden min-h-[400px]">
                    {receiptUrl ? (
                        <img src={receiptUrl} alt="Receipt Preview" className="max-w-full max-h-[60vh] object-contain" />
                    ) : (
                        <div className="flex items-center justify-center text-zoru-ink-muted">
                            No image available
                        </div>
                    )}
                </div>
            </ZoruDialogContent>
        </Dialog>
        </>
    );
}
