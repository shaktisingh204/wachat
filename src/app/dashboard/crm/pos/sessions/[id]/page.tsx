import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
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
            <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                {label}
            </span>
            <span className="text-[13px] text-[var(--st-text)]">{value}</span>
        </div>
    );
}

function TabBar({ active, id }: { active: TabKey; id: string }) {
    return (
        <div className="flex border-b border-[var(--st-border)]">
            {TABS.map((t) => {
                const isActive = t.key === active;
                return (
                    <Link
                        key={t.key}
                        href={`/dashboard/crm/pos/sessions/${id}?tab=${t.key}`}
                        className={
                            'border-b-2 px-3 py-2 text-[13px] transition-colors ' +
                            (isActive
                                ? 'border-[var(--st-text)] font-medium text-[var(--st-text)]'
                                : 'border-transparent text-[var(--st-text-secondary)] hover:text-[var(--st-text)]')
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
                <div className="flex border-b border-[var(--st-border)] gap-4 pb-2">
                    <div className="h-4 w-16 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                    <div className="h-4 w-24 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                    <div className="h-4 w-24 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                    <div className="h-4 w-16 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                </div>

                {/* KPI block skeleton */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/40 rounded-xl border border-[var(--st-border)]/50 p-4 space-y-2">
                            <div className="h-3 w-12 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                            <div className="h-5 w-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                        </div>
                    ))}
                </div>

                {/* Main detail card skeleton */}
                <div className="bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/40 rounded-xl border border-[var(--st-border)]/50 p-6 space-y-6">
                    <div className="h-4 w-32 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="h-2.5 w-16 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                                <div className="h-4 w-24 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Aside column */}
            <div className="w-full md:w-80 md:shrink-0 space-y-4">
                {/* Totals skeleton */}
                <div className="bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/40 rounded-xl border border-[var(--st-border)]/50 p-6 space-y-4">
                    <div className="h-4 w-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="space-y-1">
                                <div className="h-2.5 w-12 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                                <div className="h-4 w-16 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Terminal skeleton */}
                <div className="bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/40 rounded-xl border border-[var(--st-border)]/50 p-6 space-y-4">
                    <div className="h-4 w-20 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="space-y-1">
                                <div className="h-2.5 w-12 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
                                <div className="h-4 w-16 bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] rounded" />
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
                                <CardBody className="flex items-start justify-between p-3.5">
                                    <div>
                                        <p className="text-[10.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                            Cash
                                        </p>
                                        <p className="mt-0.5 text-lg font-semibold text-[var(--st-text)] tabular-nums">
                                            {fmtINR(cashRevenue)}
                                        </p>
                                    </div>
                                    <Banknote className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                </CardBody>
                            </Card>
                            <Card>
                                <CardBody className="flex items-start justify-between p-3.5">
                                    <div>
                                        <p className="text-[10.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                            Card
                                        </p>
                                        <p className="mt-0.5 text-lg font-semibold text-[var(--st-text)] tabular-nums">
                                            {fmtINR(cardRevenue)}
                                        </p>
                                    </div>
                                    <Receipt className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                </CardBody>
                            </Card>
                            <Card>
                                <CardBody className="flex items-start justify-between p-3.5">
                                    <div>
                                        <p className="text-[10.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                            UPI
                                        </p>
                                        <p className="mt-0.5 text-lg font-semibold text-[var(--st-text)] tabular-nums">
                                            {fmtINR(upiRevenue)}
                                        </p>
                                    </div>
                                    <Receipt className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                </CardBody>
                            </Card>
                            <Card>
                                <CardBody className="flex items-start justify-between p-3.5">
                                    <div>
                                        <p className="text-[10.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                            Refunds
                                        </p>
                                        <p className="mt-0.5 text-lg font-semibold text-[var(--st-text)] tabular-nums">
                                            {fmtINR(refundTotal)}
                                        </p>
                                    </div>
                                    <RefreshCcw className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                </CardBody>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Session details</CardTitle>
                            </CardHeader>
                            <CardBody className="grid grid-cols-2 gap-4 md:grid-cols-3">
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
                                                    ? 'text-[var(--st-accent)]'
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
                            </CardBody>
                        </Card>
                    </>
                ) : null}

                {/* TRANSACTIONS TAB */}
                {tab === 'transactions' ? (
                    <Card className="p-0">
                        <CardHeader>
                            <CardTitle>
                                Transactions ({transactions.length})
                            </CardTitle>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <Table>
                                <THead>
                                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                        <Th>Number</Th>
                                        <Th>Customer</Th>
                                        <Th>Method</Th>
                                        <Th className="text-right">
                                            Total
                                        </Th>
                                        <Th>Status</Th>
                                        <Th>Created</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {transactions.length === 0 ? (
                                        <Tr>
                                            <Td
                                                colSpan={6}
                                                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                                            >
                                                No transactions in this session yet.
                                            </Td>
                                        </Tr>
                                    ) : (
                                        transactions.map((t) => (
                                            <Tr key={t._id}>
                                                <Td className="font-mono text-[12px]">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Receipt className="h-3 w-3 text-[var(--st-text-secondary)]" />
                                                        {t.transactionNumber}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    {t.customerName || '—'}
                                                </Td>
                                                <Td className="capitalize">
                                                    {t.paymentMethod}
                                                </Td>
                                                <Td className="text-right tabular-nums">
                                                    {fmtINR(t.total)}
                                                </Td>
                                                <Td>
                                                    <StatusPill
                                                        label={t.status}
                                                        tone={txnTone(t.status)}
                                                    />
                                                </Td>
                                                <Td>
                                                    {fmtDateTime(t.createdAt)}
                                                </Td>
                                            </Tr>
                                        ))
                                    )}
                                </TBody>
                            </Table>
                        </div>
                    </Card>
                ) : null}

                {/* RECONCILIATION TAB */}
                {tab === 'reconciliation' ? (
                    <div className="flex flex-col gap-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Cash reconciliation</CardTitle>
                            </CardHeader>
                            <CardBody className="grid grid-cols-2 gap-4 md:grid-cols-3">
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
                                                    ? 'text-[var(--st-accent)]'
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
                            </CardBody>
                        </Card>

                        <Card className="p-0">
                            <CardHeader>
                                <CardTitle>Refunds this session</CardTitle>
                            </CardHeader>
                            <div className="overflow-x-auto">
                                <Table>
                                    <THead>
                                        <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                            <Th>Original txn</Th>
                                            <Th>Reason</Th>
                                            <Th>Method</Th>
                                            <Th className="text-right">
                                                Amount
                                            </Th>
                                            <Th>Status</Th>
                                            <Th>Processed</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {sessionRefunds.length === 0 ? (
                                            <Tr>
                                                <Td
                                                    colSpan={6}
                                                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                                                >
                                                    No refunds for this session.
                                                </Td>
                                            </Tr>
                                        ) : (
                                            sessionRefunds.map((r) => (
                                                <Tr key={r._id}>
                                                    <Td className="font-mono text-[12px]">
                                                        {r.originalTransactionNumber ||
                                                            r.originalTransactionId.slice(-8)}
                                                    </Td>
                                                    <Td className="max-w-[260px] truncate">
                                                        {r.reason}
                                                    </Td>
                                                    <Td className="capitalize">
                                                        {r.refundMethod}
                                                    </Td>
                                                    <Td className="text-right tabular-nums">
                                                        {fmtINR(r.refundTotal)}
                                                    </Td>
                                                    <Td>
                                                        <Badge variant="default">
                                                            {r.status}
                                                        </Badge>
                                                    </Td>
                                                    <Td>
                                                        {fmtDateTime(r.processedAt)}
                                                    </Td>
                                                </Tr>
                                            ))
                                        )}
                                    </TBody>
                                </Table>
                            </div>
                        </Card>

                        {transactions.length > 0 ? (
                            <p className="text-[12px] text-[var(--st-text-secondary)]">
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
                        <CardHeader>
                            <CardTitle>Activity</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <EntityAuditTimeline
                                entityKind="pos_session"
                                entityId={session._id}
                                limit={100}
                            />
                        </CardBody>
                    </Card>
                ) : null}
            </div>

            {/* Right Aside Column (Totals & Terminal cards) */}
            <aside className="w-full md:w-80 md:shrink-0">
                <div className="md:sticky md:top-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Totals</CardTitle>
                        </CardHeader>
                        <CardBody className="flex flex-col gap-3">
                            <Field
                                label="Revenue"
                                value={
                                    <span className="text-base font-semibold text-[var(--st-accent)]">
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
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Terminal</CardTitle>
                        </CardHeader>
                        <CardBody className="flex flex-col gap-3">
                            <Field
                                label="Terminal"
                                value={
                                    <span className="inline-flex items-center gap-1.5">
                                        <Store className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
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
                        </CardBody>
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
