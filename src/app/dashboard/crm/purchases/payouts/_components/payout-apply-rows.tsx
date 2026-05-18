'use client';

import { ZoruButton, ZoruInput } from '@/components/zoruui';
import { PlusCircle, Trash2 } from 'lucide-react';

/**
 * Multi-bill apply-rows sub-component for `<PayoutForm>`. Extracted to
 * its own file to keep the parent form under the 600-line cap.
 *
 * Each row carries `{ billId, amount }`. The parent form serialises
 * these into a single JSON blob on the `applyTo` FormData entry plus
 * flat `applyTo[N].billId` / `applyTo[N].amount` keys for the legacy
 * fallback.
 */

import * as React from 'react';

import type { UnpaidBillRow } from '@/app/actions/crm/payouts.actions';

export interface PayoutApplyRow {
    rowKey: string;
    billId: string;
    amount: string;
}

interface PayoutApplyRowsProps {
    rows: PayoutApplyRow[];
    onAdd: () => void;
    onRemove: (rowKey: string) => void;
    onUpdate: (rowKey: string, patch: Partial<PayoutApplyRow>) => void;
    /** Loaded open-bill catalogue, used to populate the bill datalist
     *  and surface a balance hint. */
    billsCatalog: UnpaidBillRow[];
    billMeta: Record<string, { balance: number; label: string }>;
    billsDatalistId: string;
    /** Whether financial inputs are locked (Edit mode). */
    disabled: boolean;
    /** Whether the vendor has been picked yet. */
    vendorPicked: boolean;
    busy: boolean;
    currency: string;
    excessAsAdvance: boolean;
    onToggleExcess: (v: boolean) => void;
    fmtMoney: (value: number, currency: string) => string;
    totalSettled: number;
}

export function PayoutApplyRows({
    rows,
    onAdd,
    onRemove,
    onUpdate,
    billsCatalog,
    billMeta,
    billsDatalistId,
    disabled,
    vendorPicked,
    busy,
    currency,
    excessAsAdvance,
    onToggleExcess,
    fmtMoney,
    totalSettled,
}: PayoutApplyRowsProps) {
    return (
        <>
            {/* Open-bills datalist — shared by every row's bill input. */}
            <datalist id={billsDatalistId}>
                {billsCatalog.map((b) => (
                    <option key={b._id} value={b._id}>
                        {(b.billNo || b._id.slice(-6)) +
                            ` — ${fmtMoney(b.balance, currency)} due`}
                    </option>
                ))}
            </datalist>

            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Apply to bills
                </h3>
                <ZoruButton
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onAdd}
                    disabled={disabled || !vendorPicked}
                >
                    <PlusCircle className="h-3.5 w-3.5" /> Add bill
                </ZoruButton>
            </div>
            {!vendorPicked ? (
                <p className="text-[12.5px] text-zoru-ink-muted">
                    Select a vendor above to load their open bills.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {rows.map((row) => {
                        const balance = row.billId
                            ? billMeta[row.billId]?.balance
                            : undefined;
                        const billLabel = row.billId
                            ? billMeta[row.billId]?.label
                            : undefined;
                        return (
                            <div
                                key={row.rowKey}
                                className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_auto]"
                            >
                                <div className="flex flex-col">
                                    <ZoruInput
                                        value={row.billId}
                                        list={billsDatalistId}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            const meta = next ? billMeta[next] : undefined;
                                            onUpdate(row.rowKey, {
                                                billId: next,
                                                amount:
                                                    meta && !row.amount
                                                        ? String(meta.balance)
                                                        : row.amount,
                                            });
                                        }}
                                        placeholder="Pick an open bill id…"
                                        disabled={disabled}
                                    />
                                    {billLabel ? (
                                        <span className="mt-1 text-[11px] text-zoru-ink-muted">
                                            {billLabel}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="flex flex-col">
                                    <ZoruInput
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={row.amount}
                                        onChange={(e) =>
                                            onUpdate(row.rowKey, { amount: e.target.value })
                                        }
                                        placeholder="Amount"
                                        disabled={disabled}
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
                                    onClick={() => onRemove(row.rowKey)}
                                    disabled={disabled || rows.length <= 1}
                                    className="text-zoru-danger-ink"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </ZoruButton>
                            </div>
                        );
                    })}
                    {busy ? (
                        <p className="text-[11.5px] text-zoru-ink-muted">
                            Loading open bills…
                        </p>
                    ) : null}
                </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-zoru-line pt-4">
                <label className="flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
                    <input
                        type="checkbox"
                        checked={excessAsAdvance}
                        onChange={(e) => onToggleExcess(e.target.checked)}
                        className="h-4 w-4 rounded border-zoru-line"
                        disabled={disabled}
                    />
                    Treat excess as advance
                </label>
                <div className="text-[14px] tabular-nums">
                    <span className="text-zoru-ink-muted">Total settled: </span>
                    <span className="font-semibold text-zoru-ink">
                        {fmtMoney(totalSettled, currency)}
                    </span>
                </div>
            </div>
        </>
    );
}
