import { Card } from '@/components/sabcrm/20ui/compat';
import { AlertTriangle } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * MSME 45-day delayed-payment alerts dashboard — §6.10 of
 * CRM_REBUILD_PLAN.md. Server-rendered, refreshed daily by the
 * `/api/cron/msme-45-day-check` cron.
 *
 * Surfaces two tables:
 *   • "Overdue" (red)   — bills past their MSMED clock.
 *   • "At risk" (amber) — bills within 7 days of breaching.
 *
 * Per-row actions ("Mark paid" / "Negotiate extension") live in the
 * client component — they intentionally don't auto-update bill status
 * yet; instead they deep-link into the bill detail page so the user
 * can record the payment / extension explicitly. (Wiring those actions
 * to write back to `crm_bills` is part of the §6.10 follow-up alongside
 * the email/SMS notifier.)
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getMsmeOverdueBills } from '@/app/actions/crm-msme-alerts.actions';

import { MsmeAlertsTable } from './_components/msme-alerts-table';

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

interface KpiCardProps {
    label: string;
    value: string;
    tone: 'red' | 'amber' | 'muted';
    hint?: string;
}

function KpiCard({ label, value, tone, hint }: KpiCardProps) {
    const toneCls =
        tone === 'red'
            ? 'border-[var(--st-border)]/40 bg-[var(--st-text)]/10 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]'
            : tone === 'amber'
              ? 'border-[var(--st-border)]/40 bg-[var(--st-text)]/10 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]'
              : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]';
    return (
        <div className={`rounded-lg border px-4 py-3 ${toneCls}`}>
            <div className="text-[12px] uppercase tracking-wide opacity-75">{label}</div>
            <div className="mt-1 text-[20px] font-semibold leading-tight">{value}</div>
            {hint ? <div className="mt-0.5 text-[11.5px] opacity-70">{hint}</div> : null}
        </div>
    );
}

export default async function MsmeAlertsPage() {
    const result = await getMsmeOverdueBills();

    if (!result.ok) {
        return (
            <EntityListShell
                title="MSME 45-day alerts"
                subtitle="Indian MSMED Act 2006 & IT §43B(h) compliance."
            >
                <Card className="p-6">
                    <div className="rounded-md border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-4 py-3 text-[13px] text-[var(--st-text)]">
                        Could not load MSME alerts: {result.error}
                    </div>
                </Card>
            </EntityListShell>
        );
    }

    const { bills, summary } = result.data;
    const overdue = bills.filter((b) => b.bucket === 'overdue');
    const atRisk = bills.filter((b) => b.bucket === 'at_risk');

    return (
        <EntityListShell
            title="MSME 45-day alerts"
            subtitle="Bills owed to MSME-registered vendors. Payment beyond 45 days triggers IT §43B(h) disallowance + MSMED Act interest."
        >

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <KpiCard
                    label="Overdue"
                    value={String(summary.totalOverdueCount)}
                    tone="red"
                    hint="Past the MSMED clock"
                />
                <KpiCard
                    label="Overdue amount"
                    value={formatINR(summary.totalOverdueAmount)}
                    tone="red"
                />
                <KpiCard
                    label="At risk"
                    value={String(summary.totalAtRiskCount)}
                    tone="amber"
                    hint="≤ 7 days from breach"
                />
                <KpiCard
                    label="At-risk amount"
                    value={formatINR(summary.totalAtRiskAmount)}
                    tone="amber"
                />
            </div>

            <Card className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)]/60 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[var(--st-text)]" />
                        <div className="text-[13.5px] font-semibold">Overdue</div>
                        <div className="text-[12px] text-[var(--st-text-secondary)]">
                            {overdue.length} bill{overdue.length === 1 ? '' : 's'}
                        </div>
                    </div>
                    <Link
                        href="/dashboard/crm/purchases/vendors"
                        className="text-[12.5px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                    >
                        Manage MSME vendor flags →
                    </Link>
                </div>
                <MsmeAlertsTable rows={overdue} bucket="overdue" />
            </Card>

            <Card className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)]/60 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[var(--st-text)]" />
                        <div className="text-[13.5px] font-semibold">At risk</div>
                        <div className="text-[12px] text-[var(--st-text-secondary)]">
                            {atRisk.length} bill{atRisk.length === 1 ? '' : 's'} within 7 days
                        </div>
                    </div>
                </div>
                <MsmeAlertsTable rows={atRisk} bucket="at_risk" />
            </Card>
        </EntityListShell>
    );
}
