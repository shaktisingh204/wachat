'use client';

/**
 * Inline "Record deduction" control for the §194Q vendor tracker.
 *
 * Keeps the page itself a server component — this client island just
 * wraps the small form that calls `markTds194qDeducted` and refreshes
 * the route.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { EntityFormField } from '@/components/crm/entity-form-field';

import { markTds194qDeducted } from '@/app/actions/crm-india-tds194q.actions';

export function RecordDeductionButton({
    suggestedAmount,
    vendorName,
}: {
    suggestedAmount: number;
    vendorName: string;
}) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [billId, setBillId] = React.useState('');
    const [amount, setAmount] = React.useState(String(Math.round(suggestedAmount * 100) / 100));
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!billId.trim()) {
            setError('Bill id is required.');
            return;
        }
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) {
            setError('Amount must be a positive number.');
            return;
        }
        setSubmitting(true);
        setError(null);
        const res = await markTds194qDeducted(billId.trim(), n);
        setSubmitting(false);
        if (!res.ok) {
            setError(res.error);
            return;
        }
        setOpen(false);
        router.refresh();
    }

    if (!open) {
        return (
            <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-zoru-line bg-zoru-surface px-3 text-[12.5px] font-medium text-zoru-ink hover:bg-zoru-surface-2"
                onClick={() => setOpen(true)}
                disabled={suggestedAmount <= 0}
                title={
                    suggestedAmount <= 0
                        ? 'No deduction required yet.'
                        : `Record §194Q TDS for ${vendorName}`
                }
            >
                Record deduction
            </button>
        );
    }

    return (
        <form
            onSubmit={onSubmit}
            className="flex flex-col gap-2 rounded-md border border-zoru-line bg-zoru-surface p-2"
        >
            <div className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Bill
                <EntityFormField
                    entity="vendorBill"
                    name="__bill_picker"
                    initialId={billId || null}
                    onChange={(id) => setBillId(id ?? '')}
                    placeholder="Pick a vendor bill…"
                />
            </div>
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Amount (INR)
                <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-8 rounded-md border border-zoru-line bg-zoru-surface px-2 text-[12.5px] text-zoru-ink"
                />
            </label>
            {error ? (
                <p className="text-[11.5px] text-zoru-ink">{error}</p>
            ) : null}
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={submitting}
                    className="h-8 flex-1 rounded-md bg-zoru-ink px-3 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                    {submitting ? 'Saving…' : 'Save'}
                </button>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-8 rounded-md border border-zoru-line bg-zoru-surface px-3 text-[12.5px] text-zoru-ink hover:bg-zoru-surface-2"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
