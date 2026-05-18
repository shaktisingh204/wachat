import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import {
  Banknote,
  Plus,
  Receipt,
  ScrollText,
  ShoppingCart,
  Store,
  PauseCircle,
  } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

/**
 * POS home / overview — `/dashboard/crm/pos`.
 *
 * KPI strip (Open sessions · Today's transactions · Today's revenue ·
 * Held tickets) + quick-action cards (Open session · Open terminal ·
 * View today's refunds). Per CRM_REBUILD_PLAN §6.3.
 */

import Link from 'next/link';

import { getPosOverviewKpis } from '@/app/actions/crm-pos.actions';

export const dynamic = 'force-dynamic';

function fmtMoney(value: number): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `₹${Math.round(value)}`;
    }
}

interface KpiCardProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    tone?: 'default' | 'accent';
}

function KpiCard({ label, value, icon: Icon, tone }: KpiCardProps) {
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
    const kpis = await getPosOverviewKpis();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Point of Sale"
                subtitle="Run shifts, ring up sales, recall held tickets and process refunds."
                icon={Store}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'POS' },
                ]}
                actions={
                    <ZoruButton size="sm" asChild>
                        <Link href="/dashboard/crm/pos/terminal">
                            <ShoppingCart className="h-4 w-4" /> Open terminal
                        </Link>
                    </ZoruButton>
                }
            />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard label="Open sessions" value={kpis.openSessions} icon={Store} />
                <KpiCard
                    label="Today's transactions"
                    value={kpis.todaysTransactions}
                    icon={Receipt}
                />
                <KpiCard
                    label="Today's revenue"
                    value={fmtMoney(kpis.todaysRevenue)}
                    icon={Banknote}
                    tone="accent"
                />
                <KpiCard
                    label="Held tickets"
                    value={kpis.heldTickets}
                    icon={PauseCircle}
                />
            </div>

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

            <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <QuickActionCard
                    href="/dashboard/crm/pos/sessions"
                    title="All sessions"
                    description="View and reconcile prior cashier shifts."
                    icon={Store}
                />
                <QuickActionCard
                    href="/dashboard/crm/pos/hold-recall"
                    title="Held tickets"
                    description="Recall a parked transaction back to the cart."
                    icon={PauseCircle}
                />
                <QuickActionCard
                    href="/dashboard/crm/pos/refunds"
                    title="Refunds"
                    description="Browse and process customer refunds."
                    icon={ScrollText}
                />
            </section>
        </div>
    );
}
