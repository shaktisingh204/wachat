'use client';

import { Button, Card, CardBody, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, Table, TBody, Td, Th, THead, Tr, toast, Checkbox } from '@/components/sabcrm/20ui';
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
    const [restockInventory, setRestockInventory] = React.useState(true);
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
            toast.error('Pick at least one line and qty to refund.');
            return;
        }
        if (!reason.trim()) {
            toast.error('A refund reason is required.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await refundPosTransaction({
                originalTransactionId: original._id,
                reason: reason.trim(),
                refundedLineItems,
                refundMethod: method,
                restockInventory,
                requestApproval: total > 10000,
            });
            if (res.success) {
                toast.success(total > 10000 ? 'Refund approval requested.' : 'Refund recorded.');
                router.push('/dashboard/crm/pos/refunds');
            } else {
                toast.error(res.error ?? 'Refund failed.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card>
            <CardBody className="flex flex-col gap-4 p-5">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                            Transaction
                        </span>
                        <span className="font-mono text-[13px]">
                            {original.transactionNumber}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                            Original method
                        </span>
                        <span className="text-[13px] capitalize">
                            {original.paymentMethod}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                            Original total
                        </span>
                        <span className="text-[13px] tabular-nums">
                            {fmtMoney(original.total)}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                            Customer
                        </span>
                        <span className="text-[13px]">
                            {original.customerName || 'Walk-in'}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <Th>Line</Th>
                                <Th className="text-right">
                                    Sold qty
                                </Th>
                                <Th className="text-right">
                                    Rate
                                </Th>
                                <Th className="text-right">
                                    Refund qty
                                </Th>
                                <Th className="text-right">
                                    Refund amount
                                </Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {lines.map((l, idx) => (
                                <Tr key={idx}>
                                    <Td>{l.name}</Td>
                                    <Td className="text-right tabular-nums">
                                        {l.maxQty}
                                    </Td>
                                    <Td className="text-right tabular-nums">
                                        {fmtMoney(l.rate)}
                                    </Td>
                                    <Td className="text-right">
                                        <Input
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
                                    </Td>
                                    <Td className="text-right">
                                        <Input
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
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="reason">Refund reason</Label>
                        <Textarea
                            id="reason"
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Customer returned damaged item."
                            required
                        />
                        <div className="flex items-center gap-2 mt-1">
                            <Checkbox 
                                id="restock" 
                                checked={restockInventory}
                                onCheckedChange={(c) => setRestockInventory(Boolean(c))}
                            />
                            <Label htmlFor="restock" className="text-[13px] font-normal cursor-pointer">
                                Restock returned items to inventory
                            </Label>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="refundMethod">
                            Refund method
                        </Label>
                        <Select
                            value={method}
                            onValueChange={(v) =>
                                setMethod(v as PosPaymentMethod)
                            }
                        >
                            <SelectTrigger id="refundMethod" className="h-9">
                                <SelectValue placeholder="Method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="upi">UPI</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[13px]">
                            <span className="text-[var(--st-text-secondary)]">
                                Refund total
                            </span>
                            <span className="font-semibold tabular-nums">
                                {fmtMoney(total)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={submitting || total <= 0}
                        onClick={onSubmit}
                    >
                        {submitting ? 'Processing…' : total > 10000 ? 'Request Approval' : 'Issue refund'}
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}
