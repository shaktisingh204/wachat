import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { FileCheck2, FileClock, Layers } from 'lucide-react';

import { listSabpracticeDocumentRequests } from '@/app/actions/sabpractice.actions';
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
    Progress,
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
        case 'completed':
        case 'approved':
            return 'success';
        case 'overdue':
            return 'danger';
        case 'partial':
            return 'warning';
        default:
            return 'info';
    }
}

function cap(s?: string): string {
    if (!s) return 'Requested';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

async function DocRequestsData() {
    const list = await listSabpracticeDocumentRequests({ status: 'open', limit: 200 });
    const items = list.items;

    const totalSlots = items.reduce((n, r) => n + (r.requestedFiles ?? []).length, 0);
    const filledSlots = items.reduce(
        (n, r) =>
            n +
            (r.requestedFiles ?? []).filter(
                (f) => f.status === 'uploaded' || f.status === 'approved',
            ).length,
        0,
    );
    const pendingSlots = totalSlots - filledSlots;

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabPractice</PageEyebrow>
                    <PageTitle>Document requests</PageTitle>
                    <PageDescription>
                        Open requests across every client. Files source from SabFiles only.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            {items.length > 0 ? (
                <section aria-label="Request metrics" className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Open requests"
                        value={String(items.length)}
                        icon={FileClock}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Slots pending"
                        value={String(pendingSlots)}
                        icon={Layers}
                        accent="#e0843b"
                    />
                    <StatCard
                        label="Slots received"
                        value={String(filledSlots)}
                        icon={FileCheck2}
                        accent="#1f9d55"
                    />
                </section>
            ) : null}

            <Card padding="none">
                <CardBody className="p-0">
                    {items.length === 0 ? (
                        <EmptyState
                            icon={FileCheck2}
                            tone="success"
                            title="Nothing pending"
                            description="All document requests are complete. New requests appear here as you raise them."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Title</Th>
                                    <Th>Client</Th>
                                    <Th>Progress</Th>
                                    <Th>Due</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {items.map((r) => {
                                    const slots = (r.requestedFiles ?? []).length;
                                    const filled = (r.requestedFiles ?? []).filter(
                                        (f) =>
                                            f.status === 'uploaded' || f.status === 'approved',
                                    ).length;
                                    const pct = slots ? Math.round((filled / slots) * 100) : 0;
                                    return (
                                        <Tr key={r._id}>
                                            <Td className="font-medium">{r.title}</Td>
                                            <Td>
                                                <Link
                                                    href={`/dashboard/sabpractice/clients/${r.clientId}`}
                                                    className="text-sm font-medium text-[var(--st-accent)] underline-offset-2 hover:underline"
                                                >
                                                    View client
                                                </Link>
                                            </Td>
                                            <Td>
                                                <div className="flex w-40 items-center gap-2">
                                                    <Progress
                                                        value={pct}
                                                        tone={pct === 100 ? 'success' : 'accent'}
                                                        size="sm"
                                                    />
                                                    <span className="text-xs tabular-nums text-[var(--st-text-secondary)]">
                                                        {filled}/{slots}
                                                    </span>
                                                </div>
                                            </Td>
                                            <Td className="tabular-nums">
                                                {r.dueDate
                                                    ? new Date(r.dueDate).toLocaleDateString()
                                                    : 'No date'}
                                            </Td>
                                            <Td>
                                                <Badge tone={statusTone(r.status)}>
                                                    {cap(r.status)}
                                                </Badge>
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

function DocRequestsSkeleton() {
    return (
        <div className="space-y-6" aria-busy="true" aria-label="Loading document requests">
            <div className="space-y-2">
                <Skeleton width={90} height={12} />
                <Skeleton width={220} height={26} />
                <Skeleton width={380} height={14} />
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

export default function DocRequestsPage() {
    return (
        <Suspense fallback={<DocRequestsSkeleton />}>
            <DocRequestsData />
        </Suspense>
    );
}
