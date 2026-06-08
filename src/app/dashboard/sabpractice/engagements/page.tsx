import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Briefcase, CircleDot, Receipt } from 'lucide-react';

import { listSabpracticeEngagements } from '@/app/actions/sabpractice.actions';
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

function statusTone(status?: string): BadgeTone {
    switch (status) {
        case 'active':
            return 'success';
        case 'completed':
            return 'info';
        case 'paused':
            return 'warning';
        default:
            return 'neutral';
    }
}

function cap(s?: string): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

async function EngagementsData() {
    const list = await listSabpracticeEngagements({ status: 'all', limit: 200 });
    const items = list.items;
    const active = items.filter((e) => e.status === 'active').length;
    const billed = items.filter((e) => e.hourlyRateMinor).length;

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabPractice</PageEyebrow>
                    <PageTitle>Engagements</PageTitle>
                    <PageDescription>
                        Every scoped work block across your clients. Open a client to add one.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            {items.length > 0 ? (
                <section aria-label="Engagement metrics" className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Total engagements"
                        value={String(items.length)}
                        icon={Briefcase}
                        accent="#7c3aed"
                    />
                    <StatCard
                        label="Active"
                        value={String(active)}
                        icon={CircleDot}
                        accent="#1f9d55"
                    />
                    <StatCard
                        label="With a rate set"
                        value={String(billed)}
                        icon={Receipt}
                        accent="#3b7af5"
                    />
                </section>
            ) : null}

            <Card padding="none">
                <CardBody className="p-0">
                    {items.length === 0 ? (
                        <EmptyState
                            icon={Briefcase}
                            title="No engagements yet"
                            description="Engagements appear here once you create them from a client."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>Client</Th>
                                    <Th>Billing</Th>
                                    <Th align="right">Rate</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {items.map((e) => (
                                    <Tr key={e._id}>
                                        <Td className="font-medium">{e.name}</Td>
                                        <Td>
                                            <Link
                                                href={`/dashboard/sabpractice/clients/${e.clientId}`}
                                                className="text-sm font-medium text-[var(--st-accent)] underline-offset-2 hover:underline"
                                            >
                                                View client
                                            </Link>
                                        </Td>
                                        <Td className="text-sm text-[var(--st-text-secondary)]">
                                            {cap(e.billingCadence) || 'Not set'}
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {e.hourlyRateMinor
                                                ? `${(e.hourlyRateMinor / 100).toFixed(2)} ${e.currency ?? ''}`.trim()
                                                : '—'}
                                        </Td>
                                        <Td>
                                            <Badge tone={statusTone(e.status)}>
                                                {cap(e.status) || 'Active'}
                                            </Badge>
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

function EngagementsSkeleton() {
    return (
        <div className="space-y-6" aria-busy="true" aria-label="Loading engagements">
            <div className="space-y-2">
                <Skeleton width={90} height={12} />
                <Skeleton width={200} height={26} />
                <Skeleton width={400} height={14} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={92} />
                ))}
            </div>
            <Skeleton height={280} />
        </div>
    );
}

export default function EngagementsPage() {
    return (
        <Suspense fallback={<EngagementsSkeleton />}>
            <EngagementsData />
        </Suspense>
    );
}
