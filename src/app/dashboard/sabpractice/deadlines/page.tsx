import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock } from 'lucide-react';

import { listSabpracticeDeadlines } from '@/app/actions/sabpractice.actions';
import {
    Badge,
    type BadgeTone,
    Card,
    CardBody,
    EmptyState,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Skeleton,
    StatCard,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';

import { FileDeadlineButton } from './_components/file-deadline-button';

/** Map a deadline status to a Badge tone so colour carries meaning. */
function statusTone(status: string): BadgeTone {
    if (status === 'overdue') return 'danger';
    if (status === 'filed') return 'success';
    if (status === 'upcoming') return 'info';
    return 'neutral';
}

function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

async function DeadlinesData() {
    const list = await listSabpracticeDeadlines({ status: 'all', limit: 500 });

    // No 20ui calendar primitive for arbitrary event lists is in scope, so we
    // present a sorted table (soonest first) with urgency-toned status badges.
    const rows = [...list.items]
        .map((d) => {
            const due = new Date(d.dueDate);
            const overdue = d.status !== 'filed' && due.getTime() < Date.now();
            const status = overdue ? 'overdue' : d.status ?? 'upcoming';
            return { d, due, status };
        })
        .sort((a, b) => a.due.getTime() - b.due.getTime());

    const overdueCount = rows.filter((r) => r.status === 'overdue').length;
    const filedCount = rows.filter((r) => r.status === 'filed').length;
    const openCount = rows.length - filedCount;

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabPractice</PageEyebrow>
                    <PageTitle>Deadlines</PageTitle>
                    <PageDescription>
                        Compliance calendar across every client, soonest first.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            {rows.length > 0 ? (
                <section aria-label="Deadline metrics" className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Open"
                        value={String(openCount)}
                        icon={Clock}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Overdue"
                        value={String(overdueCount)}
                        icon={AlertTriangle}
                        accent="#e0484e"
                    />
                    <StatCard
                        label="Filed"
                        value={String(filedCount)}
                        icon={CheckCircle2}
                        accent="#1f9d55"
                    />
                </section>
            ) : null}

            <Card padding="none">
                <CardBody className="p-0">
                    {rows.length === 0 ? (
                        <EmptyState
                            icon={CalendarClock}
                            title="No deadlines"
                            description="Add a deadline from any client to start tracking compliance dates."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Due</Th>
                                    <Th>Name</Th>
                                    <Th>Kind</Th>
                                    <Th>Client</Th>
                                    <Th>Status</Th>
                                    <Th align="right">Action</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {rows.map(({ d, due, status }) => (
                                    <Tr key={d._id}>
                                        <Td className="font-medium tabular-nums">
                                            {due.toLocaleDateString()}
                                        </Td>
                                        <Td>{d.name}</Td>
                                        <Td className="text-sm text-[var(--st-text-secondary)]">
                                            {cap((d.kind ?? 'custom').replace(/_/g, ' '))}
                                        </Td>
                                        <Td>
                                            <Link
                                                href={`/dashboard/sabpractice/clients/${d.clientId}`}
                                                className="text-sm font-medium text-[var(--st-accent)] underline-offset-2 hover:underline"
                                            >
                                                View client
                                            </Link>
                                        </Td>
                                        <Td>
                                            <Badge tone={statusTone(status)}>{cap(status)}</Badge>
                                        </Td>
                                        <Td align="right">
                                            {d.status !== 'filed' ? (
                                                <FileDeadlineButton id={d._id!} />
                                            ) : null}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

function DeadlinesSkeleton() {
    return (
        <div className="space-y-6" aria-busy="true" aria-label="Loading deadlines">
            <div className="space-y-2">
                <Skeleton width={90} height={12} />
                <Skeleton width={160} height={26} />
                <Skeleton width={360} height={14} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={92} />
                ))}
            </div>
            <Skeleton height={300} />
        </div>
    );
}

export default function DeadlinesPage() {
    return (
        <Suspense fallback={<DeadlinesSkeleton />}>
            <DeadlinesData />
        </Suspense>
    );
}
