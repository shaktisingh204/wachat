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
import { Suspense } from 'react';

import { PageDescription, PageHeader, PageHeading, PageTitle, EmptyState, Skeleton } from '@/components/sabcrm/20ui';
import { getAnalyticsData } from '@/app/actions/crm-analytics.actions';
import { AnalyticsDashboard } from '@/components/crm/analytics/analytics-dashboard';
import { getT } from '@/lib/i18n/server';

import {
    HubKpiGrid,
    HubQuickLinkGrid,
    type HubKpi,
    type HubQuickLink,
} from '@/components/crm/hub-kpi-grid';
import { countByUser, formatCurrency } from '@/components/crm/hub-data';

export const dynamic = 'force-dynamic';

const QUICK_LINKS: HubQuickLink[] = [
    {
        href: '/dashboard/sabbi/reports/top-clients',
        title: 'Top Clients',
        description: 'Highest revenue clients over the reporting period.',
        icon: Building2,
    },
    {
        href: '/dashboard/sabbi/reports/top-products',
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

async function AnalyticsContent({ year }: { year: number }) {
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
        <>
            <HubKpiGrid kpis={kpis} />
            <HubQuickLinkGrid links={QUICK_LINKS} />

            {data ? (
                <AnalyticsDashboard data={data} />
            ) : (
                <EmptyState
                    icon={<TrendingDown />}
                    title={t('crm.analytics.errorLoad')}
                    description="Could not fetch analytics data for the selected period."
                    className="mt-4"
                />
            )}
        </>
    );
}

function AnalyticsContentSkeleton() {
    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
            </div>

            <div className="mt-6 flex flex-col gap-6">
                <Skeleton className="h-[400px] w-full rounded-xl" />
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                </div>
            </div>
        </>
    );
}

export default async function AnalyticsHubPage(props: {
    searchParams: Promise<{ year?: string }>;
}) {
    const searchParams = await props.searchParams;
    const year = searchParams.year ? parseInt(searchParams.year, 10) : new Date().getFullYear();
    const t = await getT();

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]">
                        <BarChart className="h-5 w-5 text-[var(--st-text)]" strokeWidth={1.75} />
                    </div>
                    <PageHeading>
                        <PageTitle>{t('crm.analytics.title')}</PageTitle>
                        <PageDescription>
                            {t('crm.analytics.subtitle', { year })}
                        </PageDescription>
                    </PageHeading>
                </div>
            </PageHeader>

            <Suspense fallback={<AnalyticsContentSkeleton />}>
                <AnalyticsContent year={year} />
            </Suspense>
        </div>
    );
}
