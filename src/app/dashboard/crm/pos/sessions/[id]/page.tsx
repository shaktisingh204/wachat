import {
    Badge,
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { Banknote, Receipt, RefreshCcw, Store } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

/**
 * POS session detail — `/dashboard/crm/pos/sessions/[id]`.
 *
 * Deep detail page with tabs (Overview · Transactions · Reconciliation
 * · Activity) + right rail (Totals & terminal). The tab switch is
 * query-string-driven (`?tab=…`) so it stays a server component.
 */

import Link from 'next/link';

import { StatusPill, type StatusPillProps } from '@/components/crm/status-pill';
import {
    getPosRefunds,
    getPosSessionById,
    getPosTransactions,
    type PosSessionStatus,
    type PosTransactionStatus,
} from '@/app/actions/crm-pos.actions';

import { PosSessionDetailActions } from '../../_components/pos-session-detail-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ tab?: string }>;
}

type TabKey = 'overview' | 'transactions' | 'reconciliation' | 'activity';

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'reconciliation', label: 'Reconciliation' },
    { key: 'activity', label: 'Activity' },
];

function asTab(v: string | undefined): TabKey {
    if (v === 'transactions' || v === 'reconciliation' || v === 'activity') {
        return v;
    }
    return 'overview';
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

function fmtDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

function sessionTone(status: PosSessionStatus): StatusPillProps['tone'] {
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

function txnTone(s: PosTransactionStatus): StatusPillProps['tone'] {
    switch (s) {
        case 'completed':
            return 'green';
        case 'refunded':
        case 'partially_refunded':
            return 'amber';
        case 'voided':
            return 'red';
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

function TabBar({ active, id }: { active: TabKey; id: string }) {
    return (
        <div className="flex border-b border-zoru-line">
            {TABS.map((t) => {
                const isActive = t.key === active;
                return (
                    <Link
                        key={t.key}
                        href={`/dashboard/crm/pos/sessions/${id}?tab=${t.key}`}
                        className={
                            'border-b-2 px-3 py-2 text-[13px] transition-colors ' +
                            (isActive
                                ? 'border-zoru-ink font-medium text-zoru-ink'
                                : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink')
                        }
                    >
                        {t.label}
                    </Link>
                );
            })}
        </div>
    );
}

export default async function PosSessionDetailPage({
    params,
    searchParams,
}: PageProps) {
    const [{ id }, sp] = await Promise.all([params, searchParams]);
    const tab = asTab(sp.tab);
    const session = await getPosSessionById(id);
    if (!session) notFound();

    const [transactions, refunds] = await Promise.all([
        getPosTransactions({ sessionId: id, limit: 500 }),
        getPosRefunds({ limit: 500 }),
    ]);
    const sessionRefunds = refunds.filter((r) => r.sessionId === id);

    const completed = transactions.filter(
        (t) => t.status === 'completed' || t.status === 'partially_refunded',
    );
    const voided = transactions.filter((t) => t.status === 'voided');
    const revenue = completed.reduce((sum, t) => sum + (t.total ?? 0), 0);
    const cashRevenue = completed
        .filter((t) => t.paymentMethod === 'cash')
        .reduce((sum, t) => sum + (t.total ?? 0), 0);
    const cardRevenue = completed
        .filter((t) => t.paymentMethod === 'card')
        .reduce((sum, t) => sum + (t.total ?? 0), 0);
    const upiRevenue = completed
        .filter((t) => t.paymentMethod === 'upi')
        .reduce((sum, t) => sum + (t.total ?? 0), 0);

    const refundTotal = sessionRefunds.reduce(
        (sum, r) => sum + (r.refundTotal ?? 0),
        0,
    );

    const sessionDuration =
        session.openedAt && session.closedAt
            ? new Date(session.closedAt).getTime() -
              new Date(session.openedAt).getTime()
            : session.openedAt
              ? Date.now() - new Date(session.openedAt).getTime()
              : 0;

    return (
        <EntityDetailShell
            eyebrow="POS SESSION"
            title={`Session · ${session.terminalId}`}
            status={{ label: session.status, tone: sessionTone(session.status) }}
            back={{ href: '/dashboard/crm/pos/sessions', label: 'Sessions' }}
            actions={
                <PosSessionDetailActions
                    sessionId={session._id}
                    status={session.status}
                />
            }
            rightRail={
                <>
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Totals</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="flex flex-col gap-3">
                            <Field
                                label="Revenue"
                                value={
                                    <span className="text-base font-semibold text-zoru-accent">
                                        {fmtMoney(revenue)}
                                    </span>
                                }
                            />
                            <Field
                                label="Completed"
                                value={completed.length}
                            />
                            <Field label="Voided" value={voided.length} />
                            <Field
                                label="Refunds"
                                value={`${sessionRefunds.length} · ${fmtMoney(refundTotal)}`}
                            />
                            <Field
                                label="Duration"
                                value={fmtDuration(sessionDuration)}
                            />
                        </ZoruCardContent>
                    </Card>
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Terminal</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="flex flex-col gap-3">
                            <Field
                                label="Terminal"
                                value={
                                    <span className="inline-flex items-center gap-1.5">
                                        <Store className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                        {session.terminalId}
                                    </span>
                                }
                            />
                            <Field
                                label="Cashier"
                                value={session.openedByName || '—'}
                            />
                            <Field
                                label="Opened"
                                value={fmtDateTime(session.openedAt)}
                            />
                            <Field
                                label="Closed"
                                value={fmtDateTime(session.closedAt)}
                            />
                            <Button size="sm" variant="outline" asChild>
                                <Link
                                    href={`/dashboard/crm/pos/terminal?sessionId=${session._id}`}
                                >
                                    Open terminal
                                </Link>
                            </Button>
                        </ZoruCardContent>
                    </Card>
                </>
            }
        >
            <TabBar active={tab} id={session._id} />

            {/* OVERVIEW TAB */}
            {tab === 'overview' ? (
                <>
                    {/* Mini KPI strip */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Card>
                            <ZoruCardContent className="flex items-start justify-between p-3.5">
                                <div>
                                    <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                                        Cash
                                    </p>
                                    <p className="mt-0.5 text-lg font-semibold text-zoru-ink tabular-nums">
                                        {fmtMoney(cashRevenue)}
                                    </p>
                                </div>
                                <Banknote className="h-4 w-4 text-zoru-ink-muted" />
                            </ZoruCardContent>
                        </Card>
                        <Card>
                            <ZoruCardContent className="flex items-start justify-between p-3.5">
                                <div>
                                    <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                                        Card
                                    </p>
                                    <p className="mt-0.5 text-lg font-semibold text-zoru-ink tabular-nums">
                                        {fmtMoney(cardRevenue)}
                                    </p>
                                </div>
                                <Receipt className="h-4 w-4 text-zoru-ink-muted" />
                            </ZoruCardContent>
                        </Card>
                        <Card>
                            <ZoruCardContent className="flex items-start justify-between p-3.5">
                                <div>
                                    <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                                        UPI
                                    </p>
                                    <p className="mt-0.5 text-lg font-semibold text-zoru-ink tabular-nums">
                                        {fmtMoney(upiRevenue)}
                                    </p>
                                </div>
                                <Receipt className="h-4 w-4 text-zoru-ink-muted" />
                            </ZoruCardContent>
                        </Card>
                        <Card>
                            <ZoruCardContent className="flex items-start justify-between p-3.5">
                                <div>
                                    <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-muted">
                                        Refunds
                                    </p>
                                    <p className="mt-0.5 text-lg font-semibold text-zoru-ink tabular-nums">
                                        {fmtMoney(refundTotal)}
                                    </p>
                                </div>
                                <RefreshCcw className="h-4 w-4 text-zoru-ink-muted" />
                            </ZoruCardContent>
                        </Card>
                    </div>

                    <Card>
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
                                value={
                                    <span
                                        className={
                                            typeof session.discrepancy === 'number' &&
                                            session.discrepancy !== 0
                                                ? 'text-zoru-accent'
                                                : undefined
                                        }
                                    >
                                        {fmtMoney(session.discrepancy ?? null)}
                                    </span>
                                }
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
                                        tone={sessionTone(session.status)}
                                    />
                                }
                            />
                            {session.notes ? (
                                <div className="col-span-2 md:col-span-3">
                                    <Field label="Notes" value={session.notes} />
                                </div>
                            ) : null}
                        </ZoruCardContent>
                    </Card>
                </>
            ) : null}

            {/* TRANSACTIONS TAB */}
            {tab === 'transactions' ? (
                <Card className="p-0">
                    <ZoruCardHeader>
                        <ZoruCardTitle>
                            Transactions ({transactions.length})
                        </ZoruCardTitle>
                    </ZoruCardHeader>
                    <div className="overflow-x-auto">
                        <Table>
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
                                                    tone={txnTone(t.status)}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                {fmtDateTime(t.createdAt)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
                </Card>
            ) : null}

            {/* RECONCILIATION TAB */}
            {tab === 'reconciliation' ? (
                <div className="flex flex-col gap-3">
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Cash reconciliation</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
                            <Field
                                label="Opening cash"
                                value={fmtMoney(session.openingCash)}
                            />
                            <Field
                                label="Expected cash"
                                value={fmtMoney(session.expectedCash ?? null)}
                            />
                            <Field
                                label="Closing cash"
                                value={fmtMoney(session.closingCash ?? null)}
                            />
                            <Field
                                label="Cash revenue"
                                value={fmtMoney(cashRevenue)}
                            />
                            <Field
                                label="Card revenue"
                                value={fmtMoney(cardRevenue)}
                            />
                            <Field
                                label="UPI revenue"
                                value={fmtMoney(upiRevenue)}
                            />
                            <Field
                                label="Discrepancy"
                                value={
                                    <span
                                        className={
                                            typeof session.discrepancy === 'number' &&
                                            session.discrepancy !== 0
                                                ? 'text-zoru-accent'
                                                : undefined
                                        }
                                    >
                                        {fmtMoney(session.discrepancy ?? null)}
                                    </span>
                                }
                            />
                            <Field
                                label="Refunds (count)"
                                value={sessionRefunds.length}
                            />
                            <Field
                                label="Refunds (₹)"
                                value={fmtMoney(refundTotal)}
                            />
                        </ZoruCardContent>
                    </Card>

                    <Card className="p-0">
                        <ZoruCardHeader>
                            <ZoruCardTitle>Refunds this session</ZoruCardTitle>
                        </ZoruCardHeader>
                        <div className="overflow-x-auto">
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                        <ZoruTableHead>Original txn</ZoruTableHead>
                                        <ZoruTableHead>Reason</ZoruTableHead>
                                        <ZoruTableHead>Method</ZoruTableHead>
                                        <ZoruTableHead className="text-right">
                                            Amount
                                        </ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                        <ZoruTableHead>Processed</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {sessionRefunds.length === 0 ? (
                                        <ZoruTableRow>
                                            <ZoruTableCell
                                                colSpan={6}
                                                className="h-20 text-center text-[13px] text-zoru-ink-muted"
                                            >
                                                No refunds for this session.
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ) : (
                                        sessionRefunds.map((r) => (
                                            <ZoruTableRow key={r._id}>
                                                <ZoruTableCell className="font-mono text-[12px]">
                                                    {r.originalTransactionNumber ||
                                                        r.originalTransactionId.slice(-8)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="max-w-[260px] truncate">
                                                    {r.reason}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize">
                                                    {r.refundMethod}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right tabular-nums">
                                                    {fmtMoney(r.refundTotal)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge variant="default">
                                                        {r.status}
                                                    </Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    {fmtDateTime(r.processedAt)}
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        ))
                                    )}
                                </ZoruTableBody>
                            </Table>
                        </div>
                    </Card>

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
                </div>
            ) : null}

            {/* ACTIVITY TAB */}
            {tab === 'activity' ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Activity</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <EntityAuditTimeline
                            entityKind="pos_session"
                            entityId={session._id}
                            limit={100}
                        />
                    </ZoruCardContent>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
