import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * POS refunds list — `/dashboard/crm/pos/refunds`.
 *
 * Server component. Read-only audit view of recorded refunds. New
 * refunds are initiated from a transaction context (the [id]
 * detail view links here with `?originalTransactionId=…`).
 */

import Link from 'next/link';

import { StatusPill, type StatusPillProps } from '@/components/crm/status-pill';
import { getPosRefunds, type PosRefundStatus } from '@/app/actions/crm-pos.actions';

export const dynamic = 'force-dynamic';

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function fmtMoney(v: number | null | undefined): string {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return inr.format(v);
}

function fmtDateTime(v: string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function statusTone(status: PosRefundStatus): StatusPillProps['tone'] {
    switch (status) {
        case 'completed':
            return 'green';
        case 'pending':
            return 'amber';
        case 'failed':
            return 'red';
        default:
            return 'neutral';
    }
}

export default async function PosRefundsPage() {
    const refunds = await getPosRefunds({ limit: 200 });

    return (
        <EntityListShell
            title="POS refunds"
            subtitle="Refunds processed against POS transactions."
        >
            <ZoruCard className="p-0">
                <div className="overflow-x-auto">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead>Original txn</ZoruTableHead>
                                <ZoruTableHead>Reason</ZoruTableHead>
                                <ZoruTableHead>Method</ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Refund total
                                </ZoruTableHead>
                                <ZoruTableHead>Status</ZoruTableHead>
                                <ZoruTableHead>Processed</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {refunds.length === 0 ? (
                                <ZoruTableRow>
                                    <ZoruTableCell
                                        colSpan={6}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        No refunds recorded yet.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                refunds.map((r) => (
                                    <ZoruTableRow key={r._id}>
                                        <ZoruTableCell className="font-mono text-[12px]">
                                            <Link
                                                href={`/dashboard/crm/pos/sessions/${r.sessionId ?? ''}`}
                                                className="hover:underline"
                                            >
                                                {r.originalTransactionNumber ||
                                                    r.originalTransactionId.slice(
                                                        -8,
                                                    )}
                                            </Link>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="max-w-[260px] truncate text-[12.5px]">
                                            {r.reason}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="capitalize">
                                            {r.refundMethod}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right tabular-nums">
                                            {fmtMoney(r.refundTotal)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <StatusPill
                                                label={r.status}
                                                tone={statusTone(r.status)}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtDateTime(r.processedAt)}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
