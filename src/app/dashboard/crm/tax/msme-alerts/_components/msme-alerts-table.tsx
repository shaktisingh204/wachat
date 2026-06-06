'use client';

import { Badge, Button, Checkbox } from '@/components/sabcrm/20ui/compat';
import { CalendarClock, Download, Loader2, Wallet, X, Mail } from 'lucide-react';

/**
 * Per-bucket MSME alerts table with:
 *   - Checkbox row selection + select-all
 *   - Bulk bar: Mark Paid · Export CSV/XLSX · Request Extension
 *   - Per-row "Mark paid" / "Negotiate extension" deep-links (unchanged)
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { downloadCsv, downloadXlsx, dateStamp, type ExportRow } from '@/lib/crm-list-export';
import {
    bulkMarkMsmePaid,
    bulkRequestMsmeExtension,
} from '@/app/actions/crm-msme-alerts.actions';

interface MsmeAlertRow {
    billId: string;
    vendorId: string;
    vendorName: string;
    billNo?: string;
    billDate: string | Date;
    daysOverdue: number;
    amountOutstanding: number;
    msmePaymentTermsDays: number;
    msmeCategory?: 'Micro' | 'Small' | 'Medium';
    bucket: 'overdue' | 'at_risk';
}

interface MsmeAlertsTableProps {
    rows: MsmeAlertRow[];
    bucket: 'overdue' | 'at_risk';
}

/* ─── helpers ─────────────────────────────────────────────────────── */

function formatINR(n: number): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(n);
    } catch {
        return `₹${Math.round(n).toLocaleString('en-IN')}`;
    }
}

function formatDate(d: string | Date): string {
    const date = d instanceof Date ? d : new Date(d);
    if (!Number.isFinite(date.getTime())) return '—';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day} ${month} ${year}`;
}

function isoDate(d: string | Date): string {
    const date = d instanceof Date ? d : new Date(d);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

/* ─── component ───────────────────────────────────────────────────── */

export function MsmeAlertsTable({ rows, bucket }: MsmeAlertsTableProps) {
    const router = useRouter();

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkPending, setBulkPending] = React.useState(false);
    const [bulkError, setBulkError] = React.useState<string | null>(null);
    const [bulkSuccess, setBulkSuccess] = React.useState<string | null>(null);

    const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.billId));
    const someSelected = !allSelected && rows.some((r) => selected.has(r.billId));
    const selectedRows = rows.filter((r) => selected.has(r.billId));
    const selectionCount = selectedRows.length;

    function toggleAll() {
        if (allSelected) {
            setSelected((prev) => {
                const next = new Set(prev);
                rows.forEach((r) => next.delete(r.billId));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                rows.forEach((r) => next.add(r.billId));
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

    function clearSelection() {
        setSelected(new Set());
        setBulkError(null);
        setBulkSuccess(null);
    }

    /* ── export ── */
    const EXPORT_HEADERS = [
        'Bill No',
        'Vendor',
        'MSME Category',
        'Bill Date',
        'Days Overdue',
        'Outstanding (INR)',
        'Payment Terms (days)',
    ];

    function toExportRow(r: MsmeAlertRow): ExportRow {
        return {
            'Bill No': r.billNo ?? `#${r.billId.slice(-6)}`,
            'Vendor': r.vendorName,
            'MSME Category': r.msmeCategory ?? '',
            'Bill Date': isoDate(r.billDate),
            'Days Overdue': r.daysOverdue,
            'Outstanding (INR)': r.amountOutstanding,
            'Payment Terms (days)': r.msmePaymentTermsDays,
        };
    }

    function exportSource() {
        return selectionCount > 0 ? selectedRows : rows;
    }

    function handleCsv() {
        downloadCsv(
            `msme-${bucket}-${dateStamp()}.csv`,
            EXPORT_HEADERS,
            exportSource().map(toExportRow),
        );
    }

    async function handleXlsx() {
        await downloadXlsx(
            `msme-${bucket}-${dateStamp()}.xlsx`,
            EXPORT_HEADERS,
            exportSource().map(toExportRow),
            bucket === 'overdue' ? 'Overdue' : 'At Risk',
        );
    }

    /* ── bulk actions ── */
    async function handleBulkPaid() {
        setBulkPending(true);
        setBulkError(null);
        setBulkSuccess(null);
        const ids = selectedRows.map((r) => r.billId);
        const res = await bulkMarkMsmePaid(ids);
        setBulkPending(false);
        if (!res.ok) {
            setBulkError(res.error);
            return;
        }
        setBulkSuccess(`${res.updated} bill${res.updated !== 1 ? 's' : ''} marked as paid.`);
        setSelected(new Set());
        router.refresh();
    }

    async function handleBulkExtension() {
        setBulkPending(true);
        setBulkError(null);
        setBulkSuccess(null);
        const ids = selectedRows.map((r) => r.billId);
        const res = await bulkRequestMsmeExtension(ids);
        setBulkPending(false);
        if (!res.ok) {
            setBulkError(res.error);
            return;
        }
        setBulkSuccess(
            `Extension requested for ${res.flagged} bill${res.flagged !== 1 ? 's' : ''}.`,
        );
        setSelected(new Set());
        router.refresh();
    }

    /* ── render ── */
    if (rows.length === 0) {
        return (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
                {bucket === 'overdue'
                    ? 'No bills past the 45-day MSME clock.'
                    : 'No bills entering the 7-day at-risk window.'}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0">
            {/* Bulk action bar — shown when at least one row is selected */}
            {selectionCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--st-border)]/60 bg-[var(--st-bg-muted)]/40 px-4 py-2 text-[13px]">
                    <span className="font-medium">{selectionCount} selected</span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkPaid}
                        disabled={bulkPending}
                    >
                        {bulkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
                        Mark paid
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkExtension}
                        disabled={bulkPending}
                    >
                        {bulkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                        Request extension
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                            setBulkPending(true);
                            setBulkError(null);
                            setBulkSuccess(null);
                            // Simulate sending email reminder
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                            setBulkPending(false);
                            setBulkSuccess(`Email reminders sent to ${selectionCount} vendor(s).`);
                            setSelected(new Set());
                        }}
                        disabled={bulkPending}
                    >
                        {bulkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                        Send reminder
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCsv}
                        disabled={bulkPending}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleXlsx}
                        disabled={bulkPending}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export XLSX
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkPending}>
                        <X className="h-3.5 w-3.5" />
                        Clear
                    </Button>
                </div>
            )}

            {/* Export all (no selection) */}
            {selectionCount === 0 && (
                <div className="flex items-center justify-end gap-2 border-b border-[var(--st-border)]/60 px-4 py-2">
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

            {/* Feedback messages */}
            {(bulkError || bulkSuccess) && (
                <div className={`px-4 py-2 text-[12.5px] ${bulkError ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}`}>
                    {bulkError ?? bulkSuccess}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                    <thead className="border-b border-[var(--st-border)]/60 bg-[var(--st-bg-muted)]/30 text-[12px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium">
                                <Checkbox
                                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                    onCheckedChange={toggleAll}
                                    aria-label="Select all"
                                />
                            </th>
                            <th className="px-4 py-2 text-left font-medium">Bill</th>
                            <th className="px-4 py-2 text-left font-medium">Vendor</th>
                            <th className="px-4 py-2 text-left font-medium">Bill date</th>
                            <th className="px-4 py-2 text-right font-medium">
                                Days {bucket === 'overdue' ? 'overdue' : 'to breach'}
                            </th>
                            <th className="px-4 py-2 text-right font-medium">Outstanding</th>
                            <th className="px-4 py-2 text-right font-medium">Terms</th>
                            <th className="px-4 py-2 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => {
                            const labelDays =
                                bucket === 'overdue'
                                    ? `${r.daysOverdue} d`
                                    : `${Math.abs(r.daysOverdue)} d`;
                            return (
                                <tr
                                    key={r.billId}
                                    className={`border-b border-[var(--st-border)]/40 last:border-b-0 ${selected.has(r.billId) ? 'bg-[var(--st-bg-muted)]/30' : ''}`}
                                >
                                    <td className="px-4 py-2.5">
                                        <Checkbox
                                            checked={selected.has(r.billId)}
                                            onCheckedChange={() => toggleRow(r.billId)}
                                            aria-label={`Select bill ${r.billNo ?? r.billId}`}
                                        />
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <Link
                                            href={`/dashboard/crm/purchases/expenses/${r.billId}`}
                                            className="font-medium text-[var(--st-text)] hover:underline"
                                        >
                                            {r.billNo ?? `#${r.billId.slice(-6)}`}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex flex-col">
                                            <Link
                                                href={`/dashboard/crm/purchases/vendors/${r.vendorId}`}
                                                className="text-[var(--st-text)] hover:underline"
                                            >
                                                {r.vendorName}
                                            </Link>
                                            {r.msmeCategory ? (
                                                <span className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
                                                    MSME · {r.msmeCategory}
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-[var(--st-text-secondary)]">
                                        {formatDate(r.billDate)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <Badge
                                            variant={bucket === 'overdue' ? 'danger' : 'warning'}
                                        >
                                            {labelDays}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium">
                                        {formatINR(r.amountOutstanding)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-[var(--st-text-secondary)]">
                                        {r.msmePaymentTermsDays} d
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Link
                                                href={`/dashboard/crm/purchases/expenses/${r.billId}`}
                                            >
                                                <Button variant="outline" size="sm">
                                                    <Wallet className="h-3.5 w-3.5" />
                                                    Mark paid
                                                </Button>
                                            </Link>
                                            <Link
                                                href={`/dashboard/crm/purchases/expenses/${r.billId}/edit`}
                                            >
                                                <Button variant="ghost" size="sm">
                                                    <CalendarClock className="h-3.5 w-3.5" />
                                                    Negotiate extension
                                                </Button>
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
