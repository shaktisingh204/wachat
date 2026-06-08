import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
    Users,
    Briefcase,
    Clock,
    Receipt,
    ArrowUpRight,
    CalendarCheck,
} from 'lucide-react';

import {
    Button,
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
    Badge,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { getSession } from '@/app/actions/user.actions';
import {
    getSabworkerlyDashboardStats,
    getSabworkerlyTimesheets,
    getSabworkerlyInvoices,
} from '@/app/actions/sabworkerly.actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function SabworkerlyOverviewPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const [stats, pendingTs, unpaidInv] = await Promise.all([
        getSabworkerlyDashboardStats(),
        getSabworkerlyTimesheets({ status: 'submitted', limit: 5 }),
        getSabworkerlyInvoices({ status: 'sent', limit: 5 }),
    ]);

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabWorkerly</PageEyebrow>
                    <PageTitle>Staffing overview</PageTitle>
                    <PageDescription>
                        Track your temp workforce, open jobs, timesheets awaiting approval, and what
                        clients still owe — all in one place.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="secondary" asChild>
                        <Link href="/dashboard/sabworkerly/jobs/new">
                            <Briefcase className="h-4 w-4" aria-hidden="true" />
                            Post a job
                        </Link>
                    </Button>
                    <Button variant="primary" asChild>
                        <Link href="/dashboard/sabworkerly/workers/new">
                            <Users className="h-4 w-4" aria-hidden="true" />
                            Add worker
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Key metrics"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
                <StatCard
                    icon={Users}
                    accent="#1f9d55"
                    label="Active workers"
                    value={<span className="tabular-nums">{stats.activeWorkers}</span>}
                />
                <StatCard
                    icon={Briefcase}
                    accent="#3b7af5"
                    label="Open jobs"
                    value={<span className="tabular-nums">{stats.openJobs}</span>}
                />
                <StatCard
                    icon={Clock}
                    accent="#7c3aed"
                    label="Pending timesheets"
                    value={<span className="tabular-nums">{stats.pendingTimesheets}</span>}
                />
                <StatCard
                    icon={Receipt}
                    accent="#d97706"
                    label="Unpaid invoices"
                    value={<span className="tabular-nums">{stats.unpaidInvoices}</span>}
                    delta={{
                        value: `${money(stats.unpaidTotalMinor)} outstanding`,
                        tone: 'neutral',
                    }}
                />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <Clock
                                className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                aria-hidden="true"
                            />
                            Timesheets to approve
                        </CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/sabworkerly/timesheets">
                                Review
                                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardBody>
                        {pendingTs.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={CalendarCheck}
                                tone="success"
                                title="Nothing waiting"
                                description="Every submitted timesheet has been approved."
                            />
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {pendingTs.map((t) => (
                                    <li
                                        key={t._id}
                                        className="flex items-center justify-between rounded-[var(--st-radius)] border border-[color:var(--st-border)] px-3 py-2 text-sm"
                                    >
                                        <span className="text-[color:var(--st-text)]">
                                            Week of {new Date(t.weekStart).toLocaleDateString()}
                                        </span>
                                        <Badge tone="warning" kind="soft">
                                            <span className="tabular-nums">
                                                {t.totalHours.toFixed(1)} h
                                            </span>
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader className="flex items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <Receipt
                                className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                aria-hidden="true"
                            />
                            Outstanding invoices
                        </CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/sabworkerly/invoices">
                                View all
                                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardBody>
                        {unpaidInv.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={Receipt}
                                tone="success"
                                title="All settled"
                                description="No invoices are currently awaiting payment."
                            />
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {unpaidInv.map((inv) => (
                                    <li
                                        key={inv._id}
                                        className="flex items-center justify-between rounded-[var(--st-radius)] border border-[color:var(--st-border)] px-3 py-2 text-sm"
                                    >
                                        <span className="text-[color:var(--st-text)]">
                                            {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                                            {new Date(inv.periodEnd).toLocaleDateString()}
                                        </span>
                                        <Badge tone="info" kind="soft">
                                            <span className="tabular-nums">
                                                {money(inv.totalMinor, inv.currency)}
                                            </span>
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            </section>
        </div>
    );
}
