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
} from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { Banknote, Receipt, RefreshCcw, Store } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';

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
    type PosSessionDoc,
} from '@/app/actions/crm-pos.actions';

import { PosSessionDetailActions } from '../../_components/pos-session-detail-actions';
import { fmtINR } from '@/lib/utils';

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

function fmtDateTime(v: string | Date | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
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
    value: ReactNode;
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

function PosSessionDetailsSkeleton() {
    return (
        <div className="flex flex-col gap-6 md:flex-row md:items-start animate-pulse">
            {/* Left Main column */}
            <div className="min-w-0 flex-1 space-y-6">
                {/* Tabs skeleton */}
                <div className="flex border-b border-zoru-line gap-4 pb-2">
                    <div className="h-4 w-16 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                    <div className="h-4 w-24 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                    <div className="h-4 w-24 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                    <div className="h-4 w-16 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                </div>

                {/* KPI block skeleton */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 bg-zoru-surface-2 dark:bg-zoru-ink/40 rounded-xl border border-zoru-line/50 p-4 space-y-2">
                            <div className="h-3 w-12 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                            <div className="h-5 w-20 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                        </div>
                    ))}
                </div>

                {/* Main detail card skeleton */}
                <div className="bg-zoru-surface-2 dark:bg-zoru-ink/40 rounded-xl border border-zoru-line/50 p-6 space-y-6">
                    <div className="h-4 w-32 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="h-2.5 w-16 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                                <div className="h-4 w-24 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Aside column */}
            <div className="w-full md:w-80 md:shrink-0 space-y-4">
                {/* Totals skeleton */}
                <div className="bg-zoru-surface-2 dark:bg-zoru-ink/40 rounded-xl border border-zoru-line/50 p-6 space-y-4">
                    <div className="h-4 w-20 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="space-y-1">
                                <div className="h-2.5 w-12 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                                <div className="h-4 w-16 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Terminal skeleton */}
                <div className="bg-zoru-surface-2 dark:bg-zoru-ink/40 rounded-xl border border-zoru-line/50 p-6 space-y-4">
                    <div className="h-4 w-20 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="space-y-1">
                                <div className="h-2.5 w-12 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                                <div className="h-4 w-16 bg-zoru-surface-2 dark:bg-zoru-ink rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface PosSessionDetailsContainerProps {
    session: PosSessionDoc;
    tab: TabKey;
}

async function PosSessionDetailsContainer({
    session,
    tab,
}: PosSessionDetailsContainerProps) {
    const id = session._id;
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

    const liveExpectedCash = typeof session.expectedCash === 'number' 
        ? session.expectedCash 
        : (session.openingCash ?? 0) + cashRevenue;

    const liveDiscrepancy = typeof session.discrepancy === 'number'
        ? session.discrepancy
        : typeof session.closingCash === 'number' 
            ? session.closingCash - liveExpectedCash 
            : null;

    const sessionDuration =
        session.openedAt && session.closedAt
            ? new Date(session.closedAt).getTime() -
              new Date(session.openedAt).getTime()
            : session.openedAt
              ? Date.now() - new Date(session.openedAt).getTime()
              : 0;

    return (
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Main tab column */}
            <div className="min-w-0 flex-1 space-y-6">
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
                                            {fmtINR(cashRevenue)}
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
                                            {fmtINR(cardRevenue)}
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
                                            {fmtINR(upiRevenue)}
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
                                            {fmtINR(refundTotal)}
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
                                    value={fmtINR(session.openingCash)}
                                />
                                <Field
                                    label="Closing cash"
                                    value={fmtINR(session.closingCash ?? undefined)}
                                />
                                <Field
                                    label="Expected cash"
                                    value={fmtINR(liveExpectedCash)}
                                />
                                <Field
                                    label="Discrepancy"
                                    value={
                                        <span
                                            className={
                                                typeof liveDiscrepancy === 'number' &&
                                                liveDiscrepancy !== 0
                                                    ? 'text-zoru-accent'
                                                    : undefined
                                            }
                                        >
                                            {fmtINR(liveDiscrepancy ?? undefined)}
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
                                                    {fmtINR(t.total)}
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
                                    value={fmtINR(session.openingCash)}
                                />
                                <Field
                                    label="Expected cash"
                                    value={fmtINR(liveExpectedCash)}
                                />
                                <Field
                                    label="Closing cash"
                                    value={fmtINR(session.closingCash ?? undefined)}
                                />
                                <Field
                                    label="Cash revenue"
                                    value={fmtINR(cashRevenue)}
                                />
                                <Field
                                    label="Card revenue"
                                    value={fmtINR(cardRevenue)}
                                />
                                <Field
                                    label="UPI revenue"
                                    value={fmtINR(upiRevenue)}
                                />
                                <Field
                                    label="Discrepancy"
                                    value={
                                        <span
                                            className={
                                                typeof liveDiscrepancy === 'number' &&
                                                liveDiscrepancy !== 0
                                                    ? 'text-zoru-accent'
                                                    : undefined
                                            }
                                        >
                                            {fmtINR(liveDiscrepancy ?? undefined)}
                                        </span>
                                    }
                                />
                                <Field
                                    label="Refunds (count)"
                                    value={sessionRefunds.length}
                                />
                                <Field
                                    label="Refunds (₹)"
                                    value={fmtINR(refundTotal)}
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
                                                        {fmtINR(r.refundTotal)}
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
            </div>

            {/* Right Aside Column (Totals & Terminal cards) */}
            <aside className="w-full md:w-80 md:shrink-0">
                <div className="md:sticky md:top-4 space-y-4">
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Totals</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="flex flex-col gap-3">
                            <Field
                                label="Revenue"
                                value={
                                    <span className="text-base font-semibold text-zoru-accent">
                                        {fmtINR(revenue)}
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
                                value={`${sessionRefunds.length} · ${fmtINR(refundTotal)}`}
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
                </div>
            </aside>
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
        >
            <Suspense fallback={<PosSessionDetailsSkeleton />}>
                <PosSessionDetailsContainer session={session} tab={tab} />
            </Suspense>
        </EntityDetailShell>
    );
}
