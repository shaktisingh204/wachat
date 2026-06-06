import React from 'react';

import {
    Card,
    CardBody,
    PageHeader,
    PageTitle,
    PageDescription,
    Badge,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { UserCheck } from 'lucide-react';
import { getSabworkerlyPlacements } from '@/app/actions/sabworkerly.actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function PlacementsPage() {
    const placements = await getSabworkerlyPlacements({ status: 'active', limit: 200 });
    return (
        <div className="flex flex-col gap-5">
            <PageHeader>
                <PageTitle>Active placements</PageTitle>
                <PageDescription>
                    Workers currently on assignment. Margin is charge minus pay.
                </PageDescription>
            </PageHeader>

            {placements.length === 0 ? (
                <EmptyState
                    icon={UserCheck}
                    title="No active placements"
                    description="Place a worker into a job from the Jobs view."
                />
            ) : (
                <Card padding="none">
                    <CardBody className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Worker</Th>
                                    <Th>Job</Th>
                                    <Th>Start</Th>
                                    <Th>Charge / Pay</Th>
                                    <Th align="right">Margin / h</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {placements.map((p) => (
                                    <Tr key={p._id}>
                                        <Td className="font-mono text-xs">{p.workerId}</Td>
                                        <Td className="font-mono text-xs">{p.jobId}</Td>
                                        <Td>{new Date(p.startDate).toLocaleDateString()}</Td>
                                        <Td>
                                            {money(p.hourlyChargeRateMinor)} / {money(p.hourlyPayRateMinor)}
                                        </Td>
                                        <Td align="right">
                                            <Badge tone="accent">
                                                {money(p.hourlyChargeRateMinor - p.hourlyPayRateMinor)}
                                            </Badge>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
