import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { Receipt } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * POS session detail — `/dashboard/crm/pos/sessions/[id]`.
 *
 * Server component: hydrates the session + its transactions, then
 * renders an info card plus a client island for the Close / Reconcile
 * actions. Per CRM_REBUILD_PLAN §6.3.
 */

import Link from 'next/link';

import { StatusPill, type StatusPillProps } from '@/components/crm/status-pill';
import {
    getPosSessionById,
    getPosTransactions,
    type PosSessionStatus,
} from '@/app/actions/crm-pos.actions';

import { PosSessionDetailActions } from '../../_components/pos-session-detail-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function fmtMoney(value: number | null | undefined): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return inr.format(value);
}

function fmtDateTime(v: string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function statusTone(status: PosSessionStatus): StatusPillProps['tone'] {
    switch (status) {
        case 'open':
            return 'green';
        case 'closed':
            return 'amber';
        case 'reconciled':
            return 'blue';
        case 'archived':
            return 'neutral';
        default:
            return 'neutral';
    }
}

function Field({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </span>
            <span className="text-[13px] text-zoru-ink">{value}</span>
        </div>
    );
}

export default async function PosSessionDetailPage({ params }: PageProps) {
    const { id } = await params;
    const session = await getPosSessionById(id);
    if (!session) notFound();

    const transactions = await getPosTransactions({ sessionId: id, limit: 200 });
    const completed = transactions.filter(
        (t) => t.status === 'completed' || t.status === 'partially_refunded',
    );
    const revenue = completed.reduce((sum, t) => sum + (t.total ?? 0), 0);

    return (
        <EntityDetailShell
            eyebrow="POS SESSION"
            title={`Session · ${session.terminalId}`}
            back={{ href: '/dashboard/crm/pos/sessions', label: 'Sessions' }}
            actions={
                <PosSessionDetailActions
                    sessionId={session._id}
                    status={session.status}
                />
            }
        >

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <ZoruCard className="md:col-span-2">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Session details</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        <Field label="Terminal" value={session.terminalId} />
                        <Field
                            label="Opened at"
                            value={fmtDateTime(session.openedAt)}
                        />
                        <Field
                            label="Cashier"
                            value={session.openedByName || '—'}
                        />
                        <Field
                            label="Opening cash"
                            value={fmtMoney(session.openingCash)}
                        />
                        <Field
                            label="Closing cash"
                            value={fmtMoney(session.closingCash ?? null)}
                        />
                        <Field
                            label="Expected cash"
                            value={fmtMoney(session.expectedCash ?? null)}
                        />
                        <Field
                            label="Discrepancy"
                            value={fmtMoney(session.discrepancy ?? null)}
                        />
                        <Field
                            label="Closed at"
                            value={fmtDateTime(session.closedAt)}
                        />
                        <Field
                            label="Status"
                            value={
                                <StatusPill
                                    label={session.status}
                                    tone={statusTone(session.status)}
                                />
                            }
                        />
                        {session.notes ? (
                            <div className="col-span-2 md:col-span-3">
                                <Field label="Notes" value={session.notes} />
                            </div>
                        ) : null}
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Totals</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex flex-col gap-3">
                        <Field
                            label="Completed transactions"
                            value={completed.length}
                        />
                        <Field
                            label="Revenue this session"
                            value={fmtMoney(revenue)}
                        />
                        <Field
                            label="All transactions"
                            value={transactions.length}
                        />
                    </ZoruCardContent>
                </ZoruCard>
            </div>

            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Transactions</ZoruCardTitle>
                </ZoruCardHeader>
                <div className="overflow-x-auto">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead>Number</ZoruTableHead>
                                <ZoruTableHead>Customer</ZoruTableHead>
                                <ZoruTableHead>Method</ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Total
                                </ZoruTableHead>
                                <ZoruTableHead>Status</ZoruTableHead>
                                <ZoruTableHead>Created</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {transactions.length === 0 ? (
                                <ZoruTableRow>
                                    <ZoruTableCell
                                        colSpan={6}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        No transactions in this session yet.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                transactions.map((t) => (
                                    <ZoruTableRow key={t._id}>
                                        <ZoruTableCell className="font-mono text-[12px]">
                                            <span className="inline-flex items-center gap-1">
                                                <Receipt className="h-3 w-3 text-zoru-ink-muted" />
                                                {t.transactionNumber}
                                            </span>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {t.customerName || '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="capitalize">
                                            {t.paymentMethod}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right tabular-nums">
                                            {fmtMoney(t.total)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <StatusPill
                                                label={t.status}
                                                tone={
                                                    t.status === 'completed'
                                                        ? 'green'
                                                        : t.status === 'voided'
                                                          ? 'red'
                                                          : t.status === 'refunded'
                                                            ? 'amber'
                                                            : 'neutral'
                                                }
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {fmtDateTime(t.createdAt)}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>

            {transactions.length > 0 ? (
                <p className="text-[12px] text-zoru-ink-muted">
                    Need to issue a refund?{' '}
                    <Link
                        href={`/dashboard/crm/pos/refunds/new?originalTransactionId=${transactions[0]._id}`}
                        className="underline"
                    >
                        Start one from the most recent transaction
                    </Link>
                    .
                </p>
            ) : null}
        </EntityDetailShell>
    );
}
