'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';

/**
 * POS refund form — client island.
 *
 * Loads an existing transaction (passed from the server shell), shows
 * each line with editable refund-qty + amount columns, and posts to
 * `refundPosTransaction` on submit.
 */

import * as React from 'react';

import {
    refundPosTransaction,
    type PosTransactionDoc,
    type PosPaymentMethod,
    type PosLineItem,
} from '@/app/actions/crm-pos.actions';

interface Props {
    original: PosTransactionDoc;
}

interface RefundLineState {
    sourceIndex: number;
    name: string;
    maxQty: number;
    qty: number;
    rate: number;
    refundAmount: number;
    taxRate?: number;
}

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
});

function fmtMoney(v: number): string {
    return inr.format(v);
}

export function PosRefundForm({ original }: Props) {
    const router = useRouter();

    const [lines, setLines] = React.useState<RefundLineState[]>(() =>
        original.lineItems.map((li, idx) => ({
            sourceIndex: idx,
            name: li.name,
            maxQty: li.qty,
            qty: 0,
            rate: li.rate,
            refundAmount: 0,
            taxRate: li.taxRate,
        })),
    );
    const [reason, setReason] = React.useState('');
    const [method, setMethod] = React.useState<PosPaymentMethod>(
        original.paymentMethod === 'split'
            ? 'cash'
            : original.paymentMethod,
    );
    const [submitting, setSubmitting] = React.useState(false);

    const updateLine = (idx: number, patch: Partial<RefundLineState>) => {
        setLines((prev) =>
            prev.map((l, i) => {
                if (i !== idx) return l;
                const merged = { ...l, ...patch };
                if (patch.qty !== undefined) {
                    merged.refundAmount = Math.round(merged.qty * merged.rate * 100) / 100;
                }
                return merged;
            }),
        );
    };

    const total = React.useMemo(
        () => lines.reduce((sum, l) => sum + (l.refundAmount || 0), 0),
        [lines],
    );

    const onSubmit = async () => {
        const refundedLineItems: Array<Partial<PosLineItem>> = lines
            .filter((l) => l.qty > 0 && l.refundAmount > 0)
            .map((l) => ({
                itemId: original.lineItems[l.sourceIndex]?.itemId ?? null,
                name: l.name,
                qty: l.qty,
                rate: l.rate,
                taxRate: l.taxRate ?? 0,
                total: l.refundAmount,
            }));
        if (refundedLineItems.length === 0) {
            zoruSonnerToast.error('Pick at least one line and qty to refund.');
            return;
        }
        if (!reason.trim()) {
            zoruSonnerToast.error('A refund reason is required.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await refundPosTransaction({
                originalTransactionId: original._id,
                reason: reason.trim(),
                refundedLineItems,
                refundMethod: method,
            });
            if (res.success) {
                zoruSonnerToast.success('Refund recorded.');
                router.push('/dashboard/crm/pos/refunds');
            } else {
                zoruSonnerToast.error(res.error ?? 'Refund failed.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ZoruCard>
            <ZoruCardContent className="flex flex-col gap-4 p-5">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                            Transaction
                        </span>
                        <span className="font-mono text-[13px]">
                            {original.transactionNumber}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                            Original method
                        </span>
                        <span className="text-[13px] capitalize">
                            {original.paymentMethod}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                            Original total
                        </span>
                        <span className="text-[13px] tabular-nums">
                            {fmtMoney(original.total)}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                            Customer
                        </span>
                        <span className="text-[13px]">
                            {original.customerName || 'Walk-in'}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead>Line</ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Sold qty
                                </ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Rate
                                </ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Refund qty
                                </ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Refund amount
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {lines.map((l, idx) => (
                                <ZoruTableRow key={idx}>
                                    <ZoruTableCell>{l.name}</ZoruTableCell>
                                    <ZoruTableCell className="text-right tabular-nums">
                                        {l.maxQty}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right tabular-nums">
                                        {fmtMoney(l.rate)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruInput
                                            type="number"
                                            min={0}
                                            max={l.maxQty}
                                            step="1"
                                            value={String(l.qty)}
                                            onChange={(e) => {
                                                const next = Math.max(
                                                    0,
                                                    Math.min(
                                                        l.maxQty,
                                                        Number(e.target.value),
                                                    ),
                                                );
                                                updateLine(idx, { qty: next });
                                            }}
                                            className="h-8 w-20 text-right text-[12.5px]"
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruInput
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={String(l.refundAmount)}
                                            onChange={(e) =>
                                                updateLine(idx, {
                                                    refundAmount:
                                                        Math.max(
                                                            0,
                                                            Number(e.target.value),
                                                        ),
                                                })
                                            }
                                            className="h-8 w-24 text-right text-[12.5px]"
                                        />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <ZoruLabel htmlFor="reason">Refund reason</ZoruLabel>
                        <ZoruTextarea
                            id="reason"
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Customer returned damaged item."
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <ZoruLabel htmlFor="refundMethod">
                            Refund method
                        </ZoruLabel>
                        <ZoruSelect
                            value={method}
                            onValueChange={(v) =>
                                setMethod(v as PosPaymentMethod)
                            }
                        >
                            <ZoruSelectTrigger id="refundMethod" className="h-9">
                                <ZoruSelectValue placeholder="Method" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="cash">Cash</ZoruSelectItem>
                                <ZoruSelectItem value="card">Card</ZoruSelectItem>
                                <ZoruSelectItem value="upi">UPI</ZoruSelectItem>
                                <ZoruSelectItem value="other">Other</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <div className="flex items-center justify-between rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[13px]">
                            <span className="text-zoru-ink-muted">
                                Refund total
                            </span>
                            <span className="font-semibold tabular-nums">
                                {fmtMoney(total)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <ZoruButton
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                    >
                        Cancel
                    </ZoruButton>
                    <ZoruButton
                        type="button"
                        disabled={submitting || total <= 0}
                        onClick={onSubmit}
                    >
                        {submitting ? 'Processing…' : 'Issue refund'}
                    </ZoruButton>
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}
