import * as React from 'react';
import { Suspense } from 'react';

import {
    listSabpracticeClients,
    listSabpracticeDeadlines,
    listSabpracticeEngagements,
    listSabpracticeTimeLogs,
} from '@/app/actions/sabpractice.actions';
import { Card, CardBody, CardDescription, CardHeader, CardTitle, PageHeader, StatCard, EmptyState, Badge } from '@/components/sabcrm/20ui';

async function OverviewData() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const upcomingTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const [clients, engagements, deadlines, hours] = await Promise.all([
        listSabpracticeClients({ status: 'all', limit: 100 }),
        listSabpracticeEngagements({ status: 'all', limit: 100 }),
        listSabpracticeDeadlines({
            status: 'open',
            from: now.toISOString(),
            to: upcomingTo,
            limit: 25,
        }),
        listSabpracticeTimeLogs({ from: monthStart, to: monthEnd, limit: 1 }),
    ]);

    const activeClients = clients.items.filter((c) => c.status !== 'inactive').length;
    const activeEngagements = engagements.items.filter((e) => e.status === 'active').length;
    const upcomingDeadlines = deadlines.items;

    return (
        <div className="space-y-6">
            <PageHeader>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">SabPractice</h1>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        Your firm overview — clients, engagements, and what is due next.
                    </p>
                </div>
            </PageHeader>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Active clients" value={String(activeClients)} />
                <StatCard label="Active engagements" value={String(activeEngagements)} />
                <StatCard
                    label="Hours this month"
                    value={(hours.totalHours ?? 0).toFixed(1)}
                    period={`${(hours.billableHours ?? 0).toFixed(1)} billable`}
                />
                <StatCard
                    label="Upcoming deadlines (30d)"
                    value={String(upcomingDeadlines.length)}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Upcoming deadlines</CardTitle>
                    <CardDescription>Next 30 days, soonest first.</CardDescription>
                </CardHeader>
                <CardBody>
                    {upcomingDeadlines.length === 0 ? (
                        <EmptyState
                            title="No upcoming deadlines"
                            description="Add a deadline to start tracking compliance."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border-light)]">
                            {upcomingDeadlines.slice(0, 10).map((d) => (
                                <li
                                    key={d._id}
                                    className="flex items-center justify-between py-2 text-sm"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{d.name}</span>
                                        <span className="text-xs text-[var(--st-text-secondary)]">
                                            {d.kind ?? 'custom'} ·{' '}
                                            {new Date(d.dueDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <Badge>{d.status ?? 'upcoming'}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

export default function SabpracticeOverviewPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading…</div>
            }
        >
            <OverviewData />
        </Suspense>
    );
}
