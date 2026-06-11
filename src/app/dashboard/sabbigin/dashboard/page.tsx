/**
 * SabBigin dashboard — month-at-a-glance KPIs.
 *
 *   • Deals open
 *   • Won this month (value sum)
 *   • Contacts added this month
 *   • Activities completed this month
 *
 * All counts are tenant-scoped via `sabbiginCount` / `sabbiginSum`.
 */

import Link from 'next/link';
import {
    CalendarCheck,
    Contact as ContactIcon,
    Handshake,
    Layers,
    TrendingUp,
    Trophy,
} from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    StatCard,
} from '@/components/sabcrm/20ui';

import {
    sabbiginCount,
    sabbiginSum,
    formatCurrency,
    startOfMonth,
} from '../_components/sabbigin-data';

export const dynamic = 'force-dynamic';

const MONTH_LABEL = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
    new Date(),
);

export default async function SabbiginDashboardPage() {
    const monthStart = startOfMonth();

    const [openDeals, wonThisMonth, contactsThisMonth, activitiesCompleted] =
        await Promise.all([
            sabbiginCount('crm_deals', { status: { $nin: ['won', 'lost'] } }),
            sabbiginSum('crm_deals', 'value', {
                stage: { $regex: /won/i },
                updatedAt: { $gte: monthStart },
            }),
            sabbiginCount('crm_contacts', { createdAt: { $gte: monthStart } }),
            sabbiginCount('crm_activities', {
                status: 'completed',
                updatedAt: { $gte: monthStart },
            }),
        ]);

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin</PageEyebrow>
                    <PageTitle>Dashboard</PageTitle>
                    <PageDescription>Your numbers for {MONTH_LABEL}.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabbigin/pipeline"
                        className="u-btn u-btn--outline u-btn--sm"
                    >
                        <Layers size={13} aria-hidden="true" />
                        <span className="u-btn__label">Open pipeline</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Deals open" value={openDeals} icon={Handshake} accent="#3b7af5" />
                <StatCard
                    label="Won this month"
                    value={formatCurrency(wonThisMonth)}
                    icon={Trophy}
                    accent="#1f9d55"
                />
                <StatCard
                    label="Contacts added"
                    value={contactsThisMonth}
                    icon={ContactIcon}
                    accent="#7c3aed"
                />
                <StatCard
                    label="Activities completed"
                    value={activitiesCompleted}
                    icon={CalendarCheck}
                    accent="#0891b2"
                />
            </div>

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={2} aria-hidden="true" />
                        Where to go next
                    </CardTitle>
                </CardHeader>
                <CardBody className="grid grid-cols-1 gap-3 pt-0 sm:grid-cols-3">
                    <NextLink
                        href="/dashboard/sabbigin/pipeline"
                        title="Move deals forward"
                        description="Drag deals between stages on your board."
                    />
                    <NextLink
                        href="/dashboard/sabbigin/contacts"
                        title="Grow your book"
                        description="Add and review the people you sell to."
                    />
                    <NextLink
                        href="/dashboard/sabbigin/calls"
                        title="Log activity"
                        description="Keep a record of calls and meetings."
                    />
                </CardBody>
            </Card>
        </div>
    );
}

function NextLink({
    href,
    title,
    description,
}: {
    href: string;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group flex flex-col gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 transition-colors hover:border-[var(--st-accent)] hover:bg-[var(--st-bg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--st-accent)]"
        >
            <span className="text-sm font-medium text-[var(--st-text)]">{title}</span>
            <span className="text-xs text-[var(--st-text-secondary)]">{description}</span>
        </Link>
    );
}
