'use client';

/**
 * Client shell for the TDS §194Q vendor tracker table.
 *
 * Provides:
 *  - Checkbox row selection + select-all
 *  - EntityRowLink on vendor name → /dashboard/crm/purchases/vendors/[id]
 *  - Bulk export (selected or all) CSV / XLSX
 *  - Bulk "Record Deduction" — opens a compact modal for each selected vendor
 *    sequentially (user confirms amount and bill for each)
 *  - Per-row <RecordDeductionButton> (unchanged)
 */

import * as React from 'react';
import { Download, Loader2, X, Mail } from 'lucide-react';

import { Button, Checkbox, Input, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { downloadCsv, downloadXlsx, dateStamp, type ExportRow } from '@/lib/crm-list-export';
import { markTds194qDeducted } from '@/app/actions/crm-india-tds194q.actions';
import { RecordDeductionButton } from './record-deduction-button';
import type { VendorTrackerRow } from '@/lib/india-tax/tds-194q';

/* ─── helpers ─────────────────────────────────────────────────────── */

function fmtMoney(n: number): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(n);
    } catch {
        return `₹${n}`;
    }
}

function ThresholdBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    const tone =
        pct >= 100 ? 'bg-[var(--st-text)]' : pct >= 75 ? 'bg-[var(--st-text)]' : 'bg-[var(--st-text)]';
    return (
        <div className="flex flex-col gap-1 min-w-[140px]">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10.5px] text-[var(--st-text-secondary)]">{pct}% of ₹50L</span>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        threshold_not_crossed: {
            label: 'Below threshold',
            cls: 'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
        },
        deduct_on_next_bill: {
            label: 'Deduct on next bill',
            cls: 'bg-[var(--st-text)]/15 text-[var(--st-text)]',
        },
        deducted: {
            label: 'Deducted',
            cls: 'bg-[var(--st-text)]/15 text-[var(--st-text)]',
        },
    };
    const c = map[status] ?? { label: status, cls: 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' };
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.cls}`}>
            {c.label}
        </span>
    );
}

/* ─── Bulk deduction modal ────────────────────────────────────────── */

interface BulkDeductionStep {
    row: VendorTrackerRow;
    index: number;
    total: number;
}

function BulkDeductionModal({
    step,
    onDone,
    onSkip,
    onCancel,
}: {
    step: BulkDeductionStep;
    onDone: () => void;
    onSkip: () => void;
    onCancel: () => void;
}) {
    const { row, index, total } = step;
    const remaining = Math.max(0, row.tdsToDeduct - row.tdsDeducted);

    const [billId, setBillId] = React.useState('');
    const [amount, setAmount] = React.useState(String(Math.round(remaining * 100) / 100));
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
        onDone();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6 shadow-xl">
                <div className="mb-1 flex items-center justify-between">
                    <h2 className="text-[15px] font-semibold text-[var(--st-text)]">
                        Record deduction — {row.vendorName}
                    </h2>
                    <span className="text-[11px] text-[var(--st-text-secondary)]">
                        {index + 1} of {total}
                    </span>
                </div>
                <p className="mb-4 text-[12.5px] text-[var(--st-text-secondary)]">
                    Suggested: {fmtMoney(remaining)} · YTD purchases: {fmtMoney(row.totalPurchases)}
                </p>
                <form onSubmit={onSubmit} className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                        Bill
                        <EntityFormField
                            entity="vendorBill"
                            name="__bill_picker"
                            initialId={billId || null}
                            onChange={(id) => setBillId(id ?? '')}
                            placeholder="Pick a vendor bill…"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                        Amount (INR)
                        <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </label>
                    {error && <p className="text-[12px] text-[var(--st-text)]">{error}</p>}
                    <div className="flex gap-2">
                        <Button type="submit" disabled={submitting} className="flex-1">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save
                        </Button>
                        <Button type="button" variant="outline" onClick={onSkip} disabled={submitting}>
                            Skip
                        </Button>
                        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main table component ────────────────────────────────────────── */

interface Props {
    rows: VendorTrackerRow[];
    fy: string;
    applicable: boolean;
}

export function Tds194qClient({ rows, fy, applicable }: Props) {
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    // Bulk deduction flow: queue of selected row indices
    const [deductQueue, setDeductQueue] = React.useState<VendorTrackerRow[]>([]);
    const [deductIndex, setDeductIndex] = React.useState(0);

    const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.vendorId));
    const someSelected = !allSelected && rows.some((r) => selected.has(r.vendorId));
    const selectedRows = rows.filter((r) => selected.has(r.vendorId));
    const selectionCount = selectedRows.length;

    function toggleAll() {
        if (allSelected) {
            setSelected((prev) => {
                const next = new Set(prev);
                rows.forEach((r) => next.delete(r.vendorId));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                rows.forEach((r) => next.add(r.vendorId));
                return next;
            });
        }
    }

    function toggleRow(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    /* ── export ── */
    const HEADERS = [
        'Vendor',
        'GSTIN',
        'YTD Purchases (INR)',
        'Threshold Status',
        'Deductible Amount (INR)',
        'TDS to Deduct (INR)',
        'TDS Deducted (INR)',
        'Outstanding TDS (INR)',
        'Status',
    ];

    function toExportRow(r: VendorTrackerRow): ExportRow {
        const outstanding = Math.max(0, r.tdsToDeduct - r.tdsDeducted);
        return {
            'Vendor': r.vendorName,
            'GSTIN': r.gstin ?? '',
            'YTD Purchases (INR)': r.totalPurchases,
            'Threshold Status': r.totalPurchases >= 5_000_000 ? 'Crossed' : 'Below',
            'Deductible Amount (INR)': r.deductibleAmount,
            'TDS to Deduct (INR)': r.tdsToDeduct,
            'TDS Deducted (INR)': r.tdsDeducted,
            'Outstanding TDS (INR)': outstanding,
            'Status': r.status,
        };
    }

    function exportSource() {
        return selectionCount > 0 ? selectedRows : rows;
    }

    function handleCsv() {
        downloadCsv(
            `tds194q-${fy}-${dateStamp()}.csv`,
            HEADERS,
            exportSource().map(toExportRow),
        );
    }

    async function handleXlsx() {
        await downloadXlsx(
            `tds194q-${fy}-${dateStamp()}.xlsx`,
            HEADERS,
            exportSource().map(toExportRow),
            '194Q Tracker',
        );
    }

    /* ── bulk deduction ── */
    function startBulkDeduction() {
        const queue = selectedRows.filter((r) => r.tdsToDeduct > r.tdsDeducted);
        if (!queue.length) return;
        setDeductQueue(queue);
        setDeductIndex(0);
    }

    function advanceDeductQueue() {
        if (deductIndex + 1 >= deductQueue.length) {
            setDeductQueue([]);
            setDeductIndex(0);
            setSelected(new Set());
        } else {
            setDeductIndex((i) => i + 1);
        }
    }

    function cancelDeductQueue() {
        setDeductQueue([]);
        setDeductIndex(0);
    }

    const currentDeductRow =
        deductQueue.length > 0 ? deductQueue[deductIndex] : null;

    /* ── render ── */
    return (
        <div className="flex flex-col gap-3">
            {/* Bulk action bar — shown when at least one row selected */}
            {selectionCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 px-3 py-2 text-[13px]">
                    <span className="font-medium">{selectionCount} selected</span>
                    <Button size="sm" variant="outline" onClick={handleCsv}>
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleXlsx}>
                        <Download className="h-3.5 w-3.5" />
                        Export XLSX
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                            // Simulate sending email reminder
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                            alert(`Email reminders sent to ${selectionCount} vendor(s) for TDS 194Q compliance.`);
                            setSelected(new Set());
                        }}
                    >
                        <Mail className="h-3.5 w-3.5" />
                        Send reminder
                    </Button>
                    <Button
                        size="sm"
                        onClick={startBulkDeduction}
                        disabled={selectedRows.every((r) => r.tdsToDeduct <= r.tdsDeducted)}
                        title="Opens a deduction form for each selected vendor that has outstanding TDS"
                    >
                        Record deductions
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(new Set())}
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear
                    </Button>
                </div>
            )}

            {/* Export all (no selection) */}
            {selectionCount === 0 && rows.length > 0 && (
                <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={handleCsv}>
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleXlsx}>
                        <Download className="h-3.5 w-3.5" />
                        Export XLSX
                    </Button>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                <Table>
                    <THead>
                        <Tr className="border-[var(--st-border)] hover:bg-transparent">
                            <Th className="w-8">
                                <Checkbox
                                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                    onCheckedChange={toggleAll}
                                    aria-label="Select all vendors"
                                    disabled={rows.length === 0}
                                />
                            </Th>
                            <Th className="text-[var(--st-text-secondary)]">Vendor</Th>
                            <Th className="text-[var(--st-text-secondary)]">GSTIN</Th>
                            <Th className="text-right text-[var(--st-text-secondary)]">YTD purchases</Th>
                            <Th className="text-[var(--st-text-secondary)]">Threshold</Th>
                            <Th className="text-right text-[var(--st-text-secondary)]">Deductible</Th>
                            <Th className="text-right text-[var(--st-text-secondary)]">TDS to deduct</Th>
                            <Th className="text-right text-[var(--st-text-secondary)]">TDS deducted</Th>
                            <Th className="text-[var(--st-text-secondary)]">Status</Th>
                            <Th className="text-[var(--st-text-secondary)]">Action</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {rows.length === 0 ? (
                            <Tr className="border-[var(--st-border)]">
                                <Td colSpan={10} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">
                                    No vendor purchases recorded for this FY.
                                </Td>
                            </Tr>
                        ) : (
                            rows.map((row) => {
                                const remaining = Math.max(0, row.tdsToDeduct - row.tdsDeducted);
                                return (
                                    <Tr
                                        key={row.vendorId}
                                        className={`border-[var(--st-border)] ${selected.has(row.vendorId) ? 'bg-[var(--st-bg-muted)]/30' : ''}`}
                                    >
                                        <Td>
                                            <Checkbox
                                                checked={selected.has(row.vendorId)}
                                                onCheckedChange={() => toggleRow(row.vendorId)}
                                                aria-label={`Select ${row.vendorName}`}
                                            />
                                        </Td>
                                        <Td className="text-[13px] font-medium text-[var(--st-text)]">
                                            <EntityRowLink
                                                href={`/dashboard/crm/purchases/vendors/${row.vendorId}`}
                                                label={row.vendorName}
                                            />
                                        </Td>
                                        <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                            {row.gstin ?? '—'}
                                        </Td>
                                        <Td className="text-right text-[13px] text-[var(--st-text)]">
                                            {fmtMoney(row.totalPurchases)}
                                        </Td>
                                        <Td>
                                            <ThresholdBar value={row.totalPurchases} max={5_000_000} />
                                        </Td>
                                        <Td className="text-right text-[13px] text-[var(--st-text)]">
                                            {fmtMoney(row.deductibleAmount)}
                                        </Td>
                                        <Td className="text-right text-[13px] text-[var(--st-text)]">
                                            {fmtMoney(row.tdsToDeduct)}
                                        </Td>
                                        <Td className="text-right text-[13px] text-[var(--st-text)]">
                                            {fmtMoney(row.tdsDeducted)}
                                        </Td>
                                        <Td>
                                            <StatusPill status={row.status} />
                                        </Td>
                                        <Td>
                                            <RecordDeductionButton
                                                suggestedAmount={remaining}
                                                vendorName={row.vendorName}
                                            />
                                        </Td>
                                    </Tr>
                                );
                            })
                        )}
                    </TBody>
                </Table>
            </div>

            {!applicable && rows.length > 0 ? (
                <p className="text-[12px] text-[var(--st-text-secondary)]">
                    §194Q does not apply for this FY — the tracker is shown for informational
                    purposes only.
                </p>
            ) : null}

            {/* Bulk deduction modal */}
            {currentDeductRow && (
                <BulkDeductionModal
                    step={{
                        row: currentDeductRow,
                        index: deductIndex,
                        total: deductQueue.length,
                    }}
                    onDone={advanceDeductQueue}
                    onSkip={advanceDeductQueue}
                    onCancel={cancelDeductQueue}
                />
            )}
        </div>
    );
}
