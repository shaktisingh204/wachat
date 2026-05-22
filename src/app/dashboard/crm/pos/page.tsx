import {
    Badge,
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui';
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

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusPillProps } from '@/components/crm/status-pill';

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
 * Per CRM_REBUILD_PLAN §6.3 deep-list upgrade.
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

export const dynamic = 'force-dynamic';

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function fmtMoney(value: number | null | undefined): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return inr.format(value);
}

function fmtTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        <ZoruCard className="overflow-hidden">
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
        </ZoruCard>
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

export default async function PosHomePage() {
    const [kpis, transactions, refunds, openSessions] = await Promise.all([
        getPosOverviewKpis(),
        getPosTransactions({ limit: 200 }),
        getPosRefunds({ limit: 50 }),
        getPosSessions({ status: 'open' }),
    ]);

    // Today's window
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
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
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
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
        <EntityListShell
            title="Point of Sale"
            subtitle="Run shifts, ring up sales, recall held tickets and process refunds."
            primaryAction={
                <div className="flex flex-wrap items-center gap-2">
                    <ZoruButton size="sm" variant="outline" asChild>
                        <Link href="/dashboard/crm/pos/sessions">
                            <Store className="h-4 w-4" /> Sessions
                        </Link>
                    </ZoruButton>
                    <ZoruButton size="sm" asChild>
                        <Link href="/dashboard/crm/pos/terminal">
                            <ShoppingCart className="h-4 w-4" /> Open terminal
                        </Link>
                    </ZoruButton>
                </div>
            }
        >
            {/* Primary KPI strip — 5 cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <KpiCard
                    label="Today's revenue"
                    value={fmtMoney(kpis.todaysRevenue)}
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
                    value={fmtMoney(avgTicket)}
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
                            ? `${topProduct[1].qty} sold · ${fmtMoney(topProduct[1].total)}`
                            : 'No sales yet today'
                    }
                />
                <KpiCard
                    label="Top register"
                    value={topRegister ? topRegister[0] : '—'}
                    icon={Building2}
                    hint={topRegister ? fmtMoney(topRegister[1]) : 'No sales yet'}
                />
                <KpiCard
                    label="Refunds today"
                    value={fmtMoney(refundDollarsToday)}
                    icon={RefreshCcw}
                />
                <KpiCard
                    label="Refunds (mo)"
                    value={refundsThisMonth.length}
                    icon={CircleAlert}
                    hint={fmtMoney(
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

            {/* Today's activity — two columns */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <ZoruCard className="lg:col-span-2">
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
                                            <ZoruBadge
                                                variant="default"
                                                className="capitalize"
                                            >
                                                {t.paymentMethod}
                                            </ZoruBadge>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-3">
                                            <span className="text-zoru-ink-muted">
                                                <Clock className="mr-1 inline h-3 w-3" />
                                                {fmtTime(t.createdAt)}
                                            </span>
                                            <span className="w-20 text-right tabular-nums">
                                                {fmtMoney(t.total)}
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
                </ZoruCard>

                <ZoruCard>
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
                                                {fmtMoney(r.refundTotal)}
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
                </ZoruCard>
            </div>
        </EntityListShell>
    );
}
