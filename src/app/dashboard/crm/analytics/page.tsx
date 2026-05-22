import {
    BarChart,
    Building2,
    DollarSign,
    Handshake,
    LineChart,
    Package,
    Target,
    TrendingDown,
    TrendingUp,
    Users,
} from 'lucide-react';

import { Card, ZoruPageDescription, PageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import { getAnalyticsData } from '@/app/actions/crm-analytics.actions';
import { AnalyticsDashboard } from '@/components/crm/analytics/analytics-dashboard';
import { getT } from '@/lib/i18n/server';

import {
    HubKpiGrid,
    HubQuickLinkGrid,
    type HubKpi,
    type HubQuickLink,
} from '../_components/hub-kpi-grid';
import { countByUser, formatCurrency } from '../_components/hub-data';

export const dynamic = 'force-dynamic';

const QUICK_LINKS: HubQuickLink[] = [
    {
        href: '/dashboard/crm/reports/top-clients',
        title: 'Top Clients',
        description: 'Highest revenue clients over the reporting period.',
        icon: Building2,
    },
    {
        href: '/dashboard/crm/reports/top-products',
        title: 'Top Products',
        description: 'Best-selling products and services by revenue.',
        icon: Package,
    },
    {
        href: '/dashboard/crm/deals',
        title: 'Sales Deals',
        description: 'Open deals and current pipeline status.',
        icon: Handshake,
    },
    {
        href: '/dashboard/crm/sales-crm/lead-source-report',
        title: 'Lead Conversion',
        description: 'Source-by-source conversion performance.',
        icon: Target,
    },
];

export default async function AnalyticsHubPage(props: {
    searchParams: Promise<{ year?: string }>;
}) {
    const searchParams = await props.searchParams;
    const year = searchParams.year ? parseInt(searchParams.year, 10) : new Date().getFullYear();
    const [t, data, totalDeals, dealsWon] = await Promise.all([
        getT(),
        getAnalyticsData(year),
        countByUser('crm_deals'),
        countByUser('crm_deals', { status: 'won' }),
    ]);

    const totalRevenue = data?.kpis?.totalRevenue ?? 0;
    const totalLeads = data?.kpis?.totalLeads ?? 0;
    const netProfit = data?.kpis?.netProfit ?? 0;
    const conversion = totalLeads > 0 ? Math.round((dealsWon / totalLeads) * 100) : 0;
    const avgDealSize = dealsWon > 0 ? Math.round(totalRevenue / dealsWon) : 0;

    const kpis: HubKpi[] = [
        {
            label: 'Total Revenue',
            value: formatCurrency(totalRevenue),
            icon: DollarSign,
            hint: `Year ${year}`,
        },
        {
            label: 'Total Leads',
            value: totalLeads.toLocaleString(),
            icon: Users,
            href: '/dashboard/crm/leads',
        },
        {
            label: 'Conversion %',
            value: `${conversion}%`,
            icon: TrendingUp,
            tone: conversion >= 20 ? 'success' : 'default',
            hint: `${dealsWon} won of ${totalDeals} deals`,
            href: '/dashboard/crm/deals',
        },
        {
            label: 'Avg Deal Size',
            value: formatCurrency(avgDealSize),
            icon: netProfit >= 0 ? LineChart : TrendingDown,
            tone: netProfit >= 0 ? 'success' : 'danger',
        },
    ];

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
                        <BarChart className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
                    </div>
                    <ZoruPageHeading>
                        <ZoruPageTitle>{t('crm.analytics.title')}</ZoruPageTitle>
                        <ZoruPageDescription>
                            {t('crm.analytics.subtitle', { year })}
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </div>
            </PageHeader>

            <HubKpiGrid kpis={kpis} />
            <HubQuickLinkGrid links={QUICK_LINKS} />

            {data ? (
                <AnalyticsDashboard data={data} />
            ) : (
                <Card className="p-6">
                    <p className="py-8 text-center text-[13px] text-zoru-ink-muted">
                        {t('crm.analytics.errorLoad')}
                    </p>
                </Card>
            )}
        </div>
    );
}
