import * as React from 'react';
import { ServerOff } from 'lucide-react';

import {
    Card,
    CardBody,
    EmptyState,
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

import { listSabmonitorProbes } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function ProbesPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorProbes();
    return (
        <div className="flex flex-col gap-4">
            <PageHeader compact bordered={false} className="p-0">
                <PageHeaderHeading>
                    <PageTitle>Probe agents</PageTitle>
                </PageHeaderHeading>
            </PageHeader>
            <Card padding="none">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={ServerOff}
                            title="No probe agents registered"
                            description="The probe runtime is using the built-in MockProbe until real agents are wired up."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Region</Th>
                                    <Th>Label</Th>
                                    <Th>Status</Th>
                                    <Th>Last seen</Th>
                                    <Th>Version</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((p) => (
                                    <Tr key={p._id}>
                                        <Td className="font-medium text-[var(--st-text)]">{p.region}</Td>
                                        <Td className="text-[var(--st-text-secondary)]">{p.label}</Td>
                                        <Td>
                                            <StatusBadge status={p.status === 'online' ? 'up' : 'down'} />
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString() : '-'}
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">{p.version ?? '-'}</Td>
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
