import {
    Badge,
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui';
import { Skeleton } from '@/components/zoruui/skeleton';
import {
    Banknote,
    Building2,
    CircleAlert,
    Clock,
    Plus,
    Receipt,
    RefreshCcw,
    ScrollText,
    ShoppingCart,
    Store,
    PauseCircle,
    TrendingUp,
} from 'lucide-react';
import { Suspense } from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusPillProps } from '@/components/crm/status-pill';
import { fmtINR } from '@/lib/utils';

/**
 * POS home / overview — `/dashboard/crm/pos`.
 *
 * Deep KPI dashboard:
 *   • Headline KPI strip (today's revenue, txn count, open sessions, held)
 *   • Secondary strip (top product, top register, avg ticket, refund $)
 *   • Quick actions (open session / terminal / refunds)
 *   • Today's transactions snapshot (last 10)
 *   • Recent refunds (last 5)
 *
 * Wrap core widgets in a Suspense boundary for instantaneous shell loading.
 */

import Link from 'next/link';

import {
    getPosOverviewKpis,
    getPosRefunds,
    getPosSessions,
    getPosTransactions,
    type PosRefundStatus,
    type PosTransactionStatus,
} from '@/app/actions/crm-pos.actions';
import { PosSalesGraph } from './_components/pos-sales-graph';

export const dynamic = 'force-dynamic';

function fmtTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm} UTC`;
}

function txnTone(s: PosTransactionStatus): StatusPillProps['tone'] {
    switch (s) {
        case 'completed':
            return 'green';
        case 'refunded':
            return 'amber';
        case 'partially_refunded':
            return 'amber';
        case 'voided':
            return 'red';
        default:
            return 'neutral';
    }
}

function refundTone(s: PosRefundStatus): StatusPillProps['tone'] {
    switch (s) {
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

interface KpiCardProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    tone?: 'default' | 'accent';
    hint?: string;
}

function KpiCard({ label, value, icon: Icon, tone, hint }: KpiCardProps) {
    return (
        <Card className="overflow-hidden">
            <ZoruCardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                        {label}
                    </p>
                    <p
                        className={
                            tone === 'accent'
                                ? 'mt-1 text-2xl font-semibold text-zoru-accent'
                                : 'mt-1 text-2xl font-semibold text-zoru-ink'
                        }
                    >
                        {value}
                    </p>
                    {hint ? (
                        <p className="mt-0.5 truncate text-[11px] text-zoru-ink-muted">
                            {hint}
                        </p>
                    ) : null}
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zoru-surface-2">
                    <Icon className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
                </div>
            </ZoruCardContent>
        </Card>
    );
}

interface QuickActionCardProps {
    href: string;
    title: string;
    description: string;
    icon: React.ElementType;
}

function QuickActionCard({ href, title, description, icon: Icon }: QuickActionCardProps) {
    return (
        <Link
            href={href}
            className="block rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4 transition-colors hover:border-zoru-ink/30"
        >
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zoru-surface-2">
                    <Icon className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-zoru-ink">{title}</p>
                    <p className="mt-0.5 text-xs text-zoru-ink-muted">{description}</p>
                </div>
            </div>
        </Link>
    );
}

async function PosDashboardContainer() {
    const [kpis, transactions, refunds, openSessions] = await Promise.all([
        getPosOverviewKpis(),
        getPosTransactions({ limit: 200 }),
        getPosRefunds({ limit: 50 }),
        getPosSessions({ status: 'open' }),
    ]);

    // Today's window using UTC to avoid server local time discrepancy
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const inToday = (iso: string | null | undefined) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= startOfDay.getTime() && t <= endOfDay.getTime();
    };

    const todaysTxns = transactions.filter((t) => inToday(t.createdAt));
    const completedToday = todaysTxns.filter(
        (t) => t.status === 'completed' || t.status === 'partially_refunded',
    );
    const avgTicket =
        completedToday.length > 0 ? kpis.todaysRevenue / completedToday.length : 0;

    // Top product (today)
    const productTotals = new Map<string, { qty: number; total: number }>();
    for (const t of completedToday) {
        for (const li of t.lineItems) {
            const key = li.name || li.sku || 'Unknown';
            const cur = productTotals.get(key) ?? { qty: 0, total: 0 };
            cur.qty += li.qty;
            cur.total += li.total ?? 0;
            productTotals.set(key, cur);
        }
    }
    const topProduct = Array.from(productTotals.entries()).sort(
        (a, b) => b[1].total - a[1].total,
    )[0];

    // Top register (today)
    const registerTotals = new Map<string, number>();
    const sessionToTerminal = new Map<string, string>();
    for (const s of openSessions) sessionToTerminal.set(s._id, s.terminalId);
    for (const t of completedToday) {
        const reg = sessionToTerminal.get(t.sessionId) ?? t.sessionId.slice(-6);
        registerTotals.set(reg, (registerTotals.get(reg) ?? 0) + (t.total ?? 0));
    }
    const topRegister = Array.from(registerTotals.entries()).sort(
        (a, b) => b[1] - a[1],
    )[0];

    // Refunds today + this month
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const refundsThisMonth = refunds.filter((r) => {
        if (!r.createdAt) return false;
        return new Date(r.createdAt).getTime() >= monthStart.getTime();
    });
    const refundDollarsToday = refunds
        .filter((r) => inToday(r.createdAt))
        .reduce((sum, r) => sum + (r.refundTotal ?? 0), 0);

    const recentTxns = todaysTxns.slice(0, 10);
    const recentRefunds = refunds.slice(0, 5);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in-50">
            {/* Primary KPI strip — 5 cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <KpiCard
                    label="Today's revenue"
                    value={fmtINR(kpis.todaysRevenue)}
                    icon={Banknote}
                    tone="accent"
                />
                <KpiCard
                    label="Today's txns"
                    value={kpis.todaysTransactions}
                    icon={Receipt}
                    hint={
                        completedToday.length === kpis.todaysTransactions
                            ? undefined
                            : `${completedToday.length} completed`
                    }
                />
                <KpiCard
                    label="Avg ticket"
                    value={fmtINR(avgTicket)}
                    icon={TrendingUp}
                />
                <KpiCard
                    label="Open sessions"
                    value={kpis.openSessions}
                    icon={Store}
                />
                <KpiCard
                    label="Held tickets"
                    value={kpis.heldTickets}
                    icon={PauseCircle}
                />
            </div>

            {/* Secondary strip — context KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard
                    label="Top product"
                    value={topProduct ? topProduct[0] : '—'}
                    icon={ShoppingCart}
                    hint={
                        topProduct
                            ? `${topProduct[1].qty} sold · ${fmtINR(topProduct[1].total)}`
                            : 'No sales yet today'
                    }
                />
                <KpiCard
                    label="Top register"
                    value={topRegister ? topRegister[0] : '—'}
                    icon={Building2}
                    hint={topRegister ? fmtINR(topRegister[1]) : 'No sales yet'}
                />
                <KpiCard
                    label="Refunds today"
                    value={fmtINR(refundDollarsToday)}
                    icon={RefreshCcw}
                />
                <KpiCard
                    label="Refunds (mo)"
                    value={refundsThisMonth.length}
                    icon={CircleAlert}
                    hint={fmtINR(
                        refundsThisMonth.reduce(
                            (sum, r) => sum + (r.refundTotal ?? 0),
                            0,
                        ),
                    )}
                />
            </div>

            {/* Quick actions */}
            <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <QuickActionCard
                    href="/dashboard/crm/pos/sessions/new"
                    title="Open session"
                    description="Start a new cashier shift on a terminal."
                    icon={Plus}
                />
                <QuickActionCard
                    href="/dashboard/crm/pos/terminal"
                    title="Open terminal"
                    description="Ring up sales with the live POS terminal."
                    icon={ShoppingCart}
                />
                <QuickActionCard
                    href="/dashboard/crm/pos/refunds"
                    title="View today's refunds"
                    description="Audit and follow up on refunds processed."
                    icon={ScrollText}
                />
            </section>

            {/* Sales Graph */}
            <section className="mb-3">
                <PosSalesGraph transactions={todaysTxns} />
            </section>

            {/* Today's activity — two columns */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <ZoruCardHeader className="flex flex-row items-center justify-between">
                        <ZoruCardTitle>Today's transactions</ZoruCardTitle>
                        <Link
                            href="/dashboard/crm/pos/sessions"
                            className="text-[12px] text-zoru-ink-muted hover:text-zoru-ink hover:underline"
                        >
                            View all sessions
                        </Link>
                    </ZoruCardHeader>
                    <ZoruCardContent className="p-0">
                        {recentTxns.length === 0 ? (
                            <p className="px-6 pb-6 text-[13px] text-zoru-ink-muted">
                                No transactions yet today. Open the terminal to ring
                                up sales.
                            </p>
                        ) : (
                            <div className="divide-y divide-zoru-line">
                                {recentTxns.map((t) => (
                                    <Link
                                        key={t._id}
                                        href={`/dashboard/crm/pos/sessions/${t.sessionId}`}
                                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] hover:bg-zoru-surface-2"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Receipt className="h-3.5 w-3.5 shrink-0 text-zoru-ink-muted" />
                                            <span className="truncate font-mono text-[12px] text-zoru-ink">
                                                {t.transactionNumber}
                                            </span>
                                            <span className="truncate text-zoru-ink-muted">
                                                {t.customerName || 'Walk-in'}
                                            </span>
                                            <Badge
                                                variant="default"
                                                className="capitalize"
                                            >
                                                {t.paymentMethod}
                                            </Badge>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-3">
                                            <span className="text-zoru-ink-muted">
                                                <Clock className="mr-1 inline h-3 w-3" />
                                                {fmtTime(t.createdAt)}
                                            </span>
                                            <span className="w-20 text-right tabular-nums">
                                                {fmtINR(t.total)}
                                            </span>
                                            <StatusPill
                                                label={t.status}
                                                tone={txnTone(t.status)}
                                            />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader className="flex flex-row items-center justify-between">
                        <ZoruCardTitle>Recent refunds</ZoruCardTitle>
                        <Link
                            href="/dashboard/crm/pos/refunds"
                            className="text-[12px] text-zoru-ink-muted hover:text-zoru-ink hover:underline"
                        >
                            All
                        </Link>
                    </ZoruCardHeader>
                    <ZoruCardContent className="p-0">
                        {recentRefunds.length === 0 ? (
                            <p className="px-6 pb-6 text-[13px] text-zoru-ink-muted">
                                No refunds recorded.
                            </p>
                        ) : (
                            <div className="divide-y divide-zoru-line">
                                {recentRefunds.map((r) => (
                                    <div
                                        key={r._id}
                                        className="flex flex-col gap-1 px-4 py-2.5 text-[12.5px]"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate font-mono text-[12px]">
                                                {r.originalTransactionNumber ||
                                                    r.originalTransactionId.slice(-8)}
                                            </span>
                                            <span className="tabular-nums">
                                                {fmtINR(r.refundTotal)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate text-zoru-ink-muted">
                                                {r.reason}
                                            </span>
                                            <StatusPill
                                                label={r.status}
                                                tone={refundTone(r.status)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}

function PosDashboardSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            {/* Headline KPI strip — 5 cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
            </div>

            {/* Secondary strip — context KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-24 w-full rounded-xl animate-pulse" />
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Skeleton className="h-20 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-20 w-full rounded-xl animate-pulse" />
                <Skeleton className="h-20 w-full rounded-xl animate-pulse" />
            </div>

            {/* Sales Graph */}
            <Skeleton className="h-[300px] w-full rounded-xl animate-pulse" />

            {/* Today's activity — two columns */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Skeleton className="h-[400px] w-full rounded-xl animate-pulse" />
                </div>
                <div>
                    <Skeleton className="h-[400px] w-full rounded-xl animate-pulse" />
                </div>
            </div>
        </div>
    );
}

export default async function PosHomePage() {
    return (
        <EntityListShell
            title="Point of Sale"
            subtitle="Run shifts, ring up sales, recall held tickets and process refunds."
            primaryAction={
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                        <Link href="/dashboard/crm/pos/sessions">
                            <Store className="h-4 w-4" /> Sessions
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/dashboard/crm/pos/terminal">
                            <ShoppingCart className="h-4 w-4" /> Open terminal
                        </Link>
                    </Button>
                </div>
            }
        >
            <Suspense fallback={<PosDashboardSkeleton />}>
                <PosDashboardContainer />
            </Suspense>
        </EntityListShell>
    );
}
