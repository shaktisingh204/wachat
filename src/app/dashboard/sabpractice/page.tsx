import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import {
    ArrowUpRight,
    Briefcase,
    CalendarClock,
    Clock,
    Users,
} from 'lucide-react';

import {
    listSabpracticeClients,
    listSabpracticeDeadlines,
    listSabpracticeEngagements,
    listSabpracticeTimeLogs,
} from '@/app/actions/sabpractice.actions';
import {
    Badge,
    type BadgeTone,
    Button,
    Card,
    CardBody,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    EmptyState,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Skeleton,
    StatCard,
} from '@/components/sabcrm/20ui';

const ACCENT = {
    clients: '#3b7af5',
    engagements: '#7c3aed',
    hours: '#1f9d55',
    deadlines: '#e0843b',
} as const;

/** Tone a deadline by how close it is, so the eye lands on what is urgent. */
function dueTone(dueDate: string): { tone: BadgeTone; label: string } {
    const ms = new Date(dueDate).getTime() - Date.now();
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    if (days < 0) return { tone: 'danger', label: 'Overdue' };
    if (days <= 3) return { tone: 'danger', label: `Due in ${days}d` };
    if (days <= 14) return { tone: 'warning', label: `Due in ${days}d` };
    return { tone: 'info', label: `Due in ${days}d` };
}

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
    const upcomingDeadlines = [...deadlines.items].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
    const totalHours = hours.totalHours ?? 0;
    const billableHours = hours.billableHours ?? 0;

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabPractice</PageEyebrow>
                    <PageTitle>Firm overview</PageTitle>
                    <PageDescription>
                        Clients, active engagements, hours this month, and what is due next.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <section
                aria-label="Practice metrics"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
                <StatCard
                    label="Active clients"
                    value={String(activeClients)}
                    icon={Users}
                    accent={ACCENT.clients}
                    delta={{ value: `${clients.items.length} total`, tone: 'neutral' }}
                />
                <StatCard
                    label="Active engagements"
                    value={String(activeEngagements)}
                    icon={Briefcase}
                    accent={ACCENT.engagements}
                    delta={{ value: `${engagements.items.length} total`, tone: 'neutral' }}
                />
                <StatCard
                    label="Hours this month"
                    value={totalHours.toFixed(1)}
                    icon={Clock}
                    accent={ACCENT.hours}
                    delta={{ value: `${billableHours.toFixed(1)} billable`, tone: 'up' }}
                />
                <StatCard
                    label="Deadlines (next 30 days)"
                    value={String(upcomingDeadlines.length)}
                    icon={CalendarClock}
                    accent={ACCENT.deadlines}
                />
            </section>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex size-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                            aria-hidden="true"
                        >
                            <CalendarClock size={15} />
                        </span>
                        <div>
                            <CardTitle>Upcoming deadlines</CardTitle>
                            <CardDescription>Next 30 days, soonest first.</CardDescription>
                        </div>
                    </div>
                    {upcomingDeadlines.length > 0 ? (
                        <Badge tone="warning">{upcomingDeadlines.length} open</Badge>
                    ) : null}
                </CardHeader>
                <CardBody>
                    {upcomingDeadlines.length === 0 ? (
                        <EmptyState
                            icon={CalendarClock}
                            tone="success"
                            title="Nothing due in the next 30 days"
                            description="Add a deadline from any client to start tracking compliance dates."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border-light)]">
                            {upcomingDeadlines.slice(0, 8).map((d) => {
                                const { tone, label } = dueTone(d.dueDate);
                                return (
                                    <li
                                        key={d._id}
                                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium text-[var(--st-text)]">
                                                {d.name}
                                            </span>
                                            <span className="text-xs text-[var(--st-text-secondary)]">
                                                {(d.kind ?? 'custom').replace(/_/g, ' ')} ·{' '}
                                                <span className="tabular-nums">
                                                    {new Date(d.dueDate).toLocaleDateString()}
                                                </span>
                                            </span>
                                        </div>
                                        <Badge tone={tone}>{label}</Badge>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardBody>
                {upcomingDeadlines.length > 0 ? (
                    <CardFooter className="justify-end">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/sabpractice/deadlines">
                                View all deadlines
                                <ArrowUpRight size={14} aria-hidden="true" />
                            </Link>
                        </Button>
                    </CardFooter>
                ) : null}
            </Card>
        </div>
    );
}

function OverviewSkeleton() {
    return (
        <div className="space-y-6" aria-busy="true" aria-label="Loading firm overview">
            <div className="space-y-2">
                <Skeleton width={90} height={12} />
                <Skeleton width={220} height={26} />
                <Skeleton width={420} height={14} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} height={92} />
                ))}
            </div>
            <Skeleton height={260} />
        </div>
    );
}

export default function SabpracticeOverviewPage() {
    return (
        <Suspense fallback={<OverviewSkeleton />}>
            <OverviewData />
        </Suspense>
    );
}
