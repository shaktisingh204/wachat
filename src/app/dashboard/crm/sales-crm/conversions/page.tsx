import { ZoruBadge, ZoruCard } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import {
    ArrowRight,
  FileText,
  Handshake,
  TrendingUp,
  Users,
  } from 'lucide-react';

/**
 * Sales-CRM Conversions — funnel analytics view.
 *
 * View-only page that aggregates the standard sales-side lineage:
 *   Leads → Deals → Invoices
 *
 * Each stage shows totals + the conversion rate to the next stage. No
 * CRUD here — the goal is operator visibility into how many qualified
 * opportunities make it through the pipe.
 *
 * Server component — all aggregation happens on the server, no client
 * interactivity needed. RBAC: requires `crm_lead.view`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { getCrmLeadKpis, getCrmLeads } from '@/app/actions/crm-leads.actions';
import { getCrmDeals } from '@/app/actions/crm-deals.actions';
import { getInvoices } from '@/app/actions/crm-invoices.actions';

export const dynamic = 'force-dynamic';

interface FunnelStage {
    key: string;
    label: string;
    icon: React.ElementType;
    count: number;
    detail?: string;
    href: string;
}

/**
 * Aggregate counts across leads / deals / invoices in parallel.
 * Each call is independent — start them with Promise.all to avoid a
 * waterfall.
 */
async function loadFunnelData(): Promise<{
    leadKpis: Awaited<ReturnType<typeof getCrmLeadKpis>>;
    leadCount: number;
    dealCount: number;
    invoiceCount: number;
    invoiceTotal: number;
}> {
    const [leadKpis, leadsResult, dealsResult, invoicesResult] =
        await Promise.all([
            getCrmLeadKpis(),
            getCrmLeads(1, 1, undefined),
            getCrmDeals(1, 1, undefined),
            getInvoices(1, 1, undefined),
        ]);

    return {
        leadKpis,
        leadCount: leadsResult.total ?? 0,
        dealCount: dealsResult.total ?? 0,
        invoiceCount: invoicesResult.total ?? 0,
        invoiceTotal: invoicesResult.total ?? 0,
    };
}

function pct(num: number, denom: number): number {
    if (denom <= 0) return 0;
    return Math.round((num / denom) * 1000) / 10;
}

function rateTone(rate: number): StatusTone {
    if (rate >= 50) return 'green';
    if (rate >= 25) return 'amber';
    if (rate > 0) return 'blue';
    return 'neutral';
}

export default async function ConversionsFunnelPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const guard = await requirePermission('crm_lead', 'view');
    if (!guard.ok) redirect('/dashboard/crm');

    const { leadKpis, leadCount, dealCount, invoiceCount } = await loadFunnelData();

    const totalLeads = leadCount || leadKpis.total || 0;
    const qualified = leadKpis.qualifiedCount;
    const won = leadKpis.wonCount;

    const stages: FunnelStage[] = [
        {
            key: 'leads',
            label: 'Total leads',
            icon: Users,
            count: totalLeads,
            detail: `${leadKpis.newCount} new · ${qualified} qualified`,
            href: '/dashboard/crm/sales-crm/all-leads',
        },
        {
            key: 'deals',
            label: 'Open deals',
            icon: Handshake,
            count: dealCount,
            detail: `${won} won · ${leadKpis.archivedCount} archived`,
            href: '/dashboard/crm/deals',
        },
        {
            key: 'invoices',
            label: 'Invoices issued',
            icon: FileText,
            count: invoiceCount,
            detail: 'All time',
            href: '/dashboard/crm/sales/invoices',
        },
    ];

    const leadsToDeals = pct(dealCount, totalLeads);
    const dealsToInvoices = pct(invoiceCount, dealCount);
    const overall = pct(invoiceCount, totalLeads);

    return (
        <EntityListShell
            title="Conversions"
            subtitle="Leads → Deals → Invoices funnel for the current tenant."
        >

            {/* Overall headline */}
            <ZoruCard className="p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                        <div className="text-[12.5px] text-zoru-ink-muted">
                            Overall conversion (Leads → Invoices)
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-[32px] font-semibold leading-none text-zoru-ink">
                                {overall}%
                            </span>
                            <StatusPill
                                label={overall >= 25 ? 'Healthy' : 'Needs attention'}
                                tone={rateTone(overall)}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-[12.5px] text-zoru-ink-muted">
                        <div>
                            <span className="text-zoru-ink-muted">Win rate</span>{' '}
                            <span className="font-mono text-zoru-ink">
                                {leadKpis.conversionRate}%
                            </span>
                        </div>
                        <div>
                            <span className="text-zoru-ink-muted">Won leads</span>{' '}
                            <span className="font-mono text-zoru-ink">{won}</span>
                        </div>
                    </div>
                </div>
            </ZoruCard>

            {/* Funnel stages */}
            <div className="grid gap-3 sm:grid-cols-3">
                {stages.map((stage) => {
                    const Icon = stage.icon;
                    return (
                        <Link
                            key={stage.key}
                            href={stage.href}
                            className="group rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4 transition hover:border-zoru-line-strong hover:bg-zoru-surface-2"
                        >
                            <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
                                <Icon className="h-4 w-4" strokeWidth={1.75} />
                                {stage.label}
                            </div>
                            <div className="mt-2 text-[26px] font-semibold leading-none text-zoru-ink">
                                {stage.count}
                            </div>
                            {stage.detail ? (
                                <div className="mt-1 text-[12px] text-zoru-ink-muted">
                                    {stage.detail}
                                </div>
                            ) : null}
                            <div className="mt-3 inline-flex items-center text-[12px] text-zoru-ink-muted transition group-hover:text-zoru-ink">
                                Open list
                                <ArrowRight
                                    className="ml-1 inline-block h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                                    strokeWidth={1.75}
                                />
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Step-by-step rates */}
            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                    <div className="text-[15px] font-medium text-zoru-ink">
                        Step-by-step conversion
                    </div>
                </div>
                <ul className="space-y-3">
                    <li className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3">
                        <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                            <ZoruBadge variant="ghost">Leads</ZoruBadge>
                            <ArrowRight className="h-3.5 w-3.5 text-zoru-ink-muted" />
                            <ZoruBadge variant="ghost">Deals</ZoruBadge>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[16px] text-zoru-ink">
                                {leadsToDeals}%
                            </span>
                            <StatusPill
                                label={`${dealCount} / ${totalLeads}`}
                                tone={rateTone(leadsToDeals)}
                            />
                        </div>
                    </li>
                    <li className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3">
                        <div className="flex items-center gap-2 text-[13px] text-zoru-ink">
                            <ZoruBadge variant="ghost">Deals</ZoruBadge>
                            <ArrowRight className="h-3.5 w-3.5 text-zoru-ink-muted" />
                            <ZoruBadge variant="ghost">Invoices</ZoruBadge>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[16px] text-zoru-ink">
                                {dealsToInvoices}%
                            </span>
                            <StatusPill
                                label={`${invoiceCount} / ${dealCount}`}
                                tone={rateTone(dealsToInvoices)}
                            />
                        </div>
                    </li>
                </ul>
                <p className="mt-4 text-[12px] text-zoru-ink-muted">
                    Conversion rates use tenant-scoped totals across all time. For
                    pipeline-specific funnels see the{' '}
                    <Link
                        href="/dashboard/crm/reports"
                        className="text-zoru-ink underline-offset-2 hover:underline"
                    >
                        reports
                    </Link>{' '}
                    module.
                </p>
            </ZoruCard>
        </EntityListShell>
    );
}
