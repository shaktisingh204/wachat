import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import {
    Card,
    CardBody,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageActions,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';

import { listSabmonitorIncidents } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';
import { IncidentActions } from '../_components/incident-actions';
import { IncidentFilter } from '../_components/incident-filter';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ status?: string }>;
}

export default async function SabmonitorIncidentsPage({
    searchParams,
}: PageProps): Promise<React.JSX.Element> {
    const sp = await searchParams;
    const status = (sp.status as 'ongoing' | 'resolved' | 'all') ?? 'all';
    const res = await listSabmonitorIncidents({ status, limit: 100 });

    return (
        <div className="flex flex-col gap-4">
            <PageHeader bordered={false} compact>
                <PageHeaderHeading>
                    <PageTitle>Incidents</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <IncidentFilter status={status} />
                </PageActions>
            </PageHeader>

            <Card padding="none">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={AlertTriangle}
                            title="No incidents"
                            description="Incidents will appear here when a check goes down."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Started</Th>
                                    <Th>Check</Th>
                                    <Th>Severity</Th>
                                    <Th>Status</Th>
                                    <Th>Downtime</Th>
                                    <Th align="right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((i) => (
                                    <Tr key={i._id}>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {new Date(i.startedAt).toLocaleString()}
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">{i.checkId}</Td>
                                        <Td className="uppercase text-[var(--st-text-secondary)]">
                                            {i.severity}
                                        </Td>
                                        <Td>
                                            <StatusBadge status={i.status} />
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {i.downtimeSecs ? `${i.downtimeSecs}s` : '-'}
                                        </Td>
                                        <Td align="right">
                                            {i._id && <IncidentActions incident={i} />}
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
