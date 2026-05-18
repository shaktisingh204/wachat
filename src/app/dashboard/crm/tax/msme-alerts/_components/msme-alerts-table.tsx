'use client';

import { ZoruBadge, ZoruButton } from '@/components/zoruui';
import { CalendarClock, Wallet } from 'lucide-react';

/**
 * Per-bucket MSME alerts table. Renders the rows that
 * `computeMsmeOverduebills` returned for one bucket
 * (`overdue` or `at_risk`).
 *
 * The "Mark paid" / "Negotiate extension" buttons deep-link into the
 * bill detail page so the user records the outcome there — we
 * intentionally don't write-back from this page yet (out of scope per
 * §6.10 deliverable; see ticket follow-ups for the inline-action
 * shortcuts).
 */

import * as React from 'react';
import Link from 'next/link';

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
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function MsmeAlertsTable({ rows, bucket }: MsmeAlertsTableProps) {
    if (rows.length === 0) {
        return (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                {bucket === 'overdue'
                    ? 'No bills past the 45-day MSME clock. 🎉'
                    : 'No bills entering the 7-day at-risk window.'}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
                <thead className="border-b border-border/60 bg-muted/30 text-[12px] uppercase tracking-wide text-muted-foreground">
                    <tr>
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
                            <tr key={r.billId} className="border-b border-border/40 last:border-b-0">
                                <td className="px-4 py-2.5">
                                    <Link
                                        href={`/dashboard/crm/purchases/expenses/${r.billId}`}
                                        className="font-medium text-foreground hover:underline"
                                    >
                                        {r.billNo ?? `#${r.billId.slice(-6)}`}
                                    </Link>
                                </td>
                                <td className="px-4 py-2.5">
                                    <div className="flex flex-col">
                                        <Link
                                            href={`/dashboard/crm/purchases/vendors/${r.vendorId}`}
                                            className="text-foreground hover:underline"
                                        >
                                            {r.vendorName}
                                        </Link>
                                        {r.msmeCategory ? (
                                            <span className="mt-0.5 text-[11px] text-muted-foreground">
                                                MSME · {r.msmeCategory}
                                            </span>
                                        ) : null}
                                    </div>
                                </td>
                                <td className="px-4 py-2.5 text-muted-foreground">
                                    {formatDate(r.billDate)}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                    <ZoruBadge
                                        variant={bucket === 'overdue' ? 'danger' : 'warning'}
                                    >
                                        {labelDays}
                                    </ZoruBadge>
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium">
                                    {formatINR(r.amountOutstanding)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">
                                    {r.msmePaymentTermsDays} d
                                </td>
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <Link
                                            href={`/dashboard/crm/purchases/expenses/${r.billId}`}
                                        >
                                            <ZoruButton variant="outline" size="sm">
                                                <Wallet className="h-3.5 w-3.5" />
                                                Mark paid
                                            </ZoruButton>
                                        </Link>
                                        <Link
                                            href={`/dashboard/crm/purchases/expenses/${r.billId}/edit`}
                                        >
                                            <ZoruButton variant="ghost" size="sm">
                                                <CalendarClock className="h-3.5 w-3.5" />
                                                Negotiate extension
                                            </ZoruButton>
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
