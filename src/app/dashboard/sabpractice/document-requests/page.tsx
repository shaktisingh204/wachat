import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { FileCheck2 } from 'lucide-react';

import { listSabpracticeDocumentRequests } from '@/app/actions/sabpractice.actions';
import {
    Badge,
    Card,
    CardBody,
    EmptyState,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';

async function DocRequestsData() {
    const list = await listSabpracticeDocumentRequests({ status: 'open', limit: 200 });

    return (
        <div className="space-y-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Document requests</PageTitle>
                    <PageDescription>
                        Open requests across all clients. Files source from SabFiles only.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <Card padding="none">
                <CardBody className="p-0">
                    {list.items.length === 0 ? (
                        <EmptyState
                            icon={FileCheck2}
                            tone="success"
                            title="Nothing pending"
                            description="All document requests are complete. Nice work."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Title</Th>
                                    <Th>Client</Th>
                                    <Th>Slots</Th>
                                    <Th>Due</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {list.items.map((r) => {
                                    const filled = (r.requestedFiles ?? []).filter(
                                        (f) => f.status === 'uploaded' || f.status === 'approved',
                                    ).length;
                                    return (
                                        <Tr key={r._id}>
                                            <Td className="font-medium">{r.title}</Td>
                                            <Td>
                                                <Link
                                                    className="font-mono text-xs underline-offset-2 hover:underline"
                                                    href={`/dashboard/sabpractice/clients/${r.clientId}`}
                                                >
                                                    {r.clientId.slice(-6)}
                                                </Link>
                                            </Td>
                                            <Td className="text-sm">
                                                {filled}/{(r.requestedFiles ?? []).length}
                                            </Td>
                                            <Td>
                                                {r.dueDate
                                                    ? new Date(r.dueDate).toLocaleDateString()
                                                    : '-'}
                                            </Td>
                                            <Td>
                                                <Badge>{r.status ?? 'requested'}</Badge>
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

export default function DocRequestsPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading.</div>
            }
        >
            <DocRequestsData />
        </Suspense>
    );
}
