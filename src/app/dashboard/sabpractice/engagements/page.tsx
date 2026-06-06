import * as React from 'react';
import { Suspense } from 'react';

import { listSabpracticeEngagements } from '@/app/actions/sabpractice.actions';
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

async function EngagementsData() {
    const list = await listSabpracticeEngagements({ status: 'all', limit: 200 });
    return (
        <div className="space-y-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Engagements</PageTitle>
                    <PageDescription>
                        Cross-client engagement list. Open a client to add a new one.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <Card>
                <CardBody className="p-0">
                    {list.items.length === 0 ? (
                        <EmptyState
                            title="No engagements"
                            description="Engagements appear here once you create them from a client cockpit."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>Client</Th>
                                    <Th>Billing</Th>
                                    <Th>Rate</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {list.items.map((e) => (
                                    <Tr key={e._id}>
                                        <Td className="font-medium">{e.name}</Td>
                                        <Td className="font-mono text-xs">
                                            {e.clientId.slice(-6)}
                                        </Td>
                                        <Td>{e.billingCadence ?? '-'}</Td>
                                        <Td>
                                            {e.hourlyRateMinor
                                                ? `${(e.hourlyRateMinor / 100).toFixed(2)} ${e.currency ?? ''}`
                                                : '-'}
                                        </Td>
                                        <Td>
                                            <Badge>{e.status ?? 'active'}</Badge>
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

export default function EngagementsPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading...</div>
            }
        >
            <EngagementsData />
        </Suspense>
    );
}
