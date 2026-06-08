import React from 'react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    Badge,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { UserCheck, TrendingUp } from 'lucide-react';
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

    const totalMarginMinor = placements.reduce(
        (acc, p) => acc + (p.hourlyChargeRateMinor - p.hourlyPayRateMinor),
        0,
    );

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabWorkerly</PageEyebrow>
                    <PageTitle>Active placements</PageTitle>
                    <PageDescription>
                        Workers currently on assignment. Margin is the charge rate minus the worker's
                        pay rate.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            {placements.length === 0 ? (
                <EmptyState
                    icon={UserCheck}
                    title="No active placements"
                    description="Place a worker into a job from the Jobs view to see it here."
                />
            ) : (
                <>
                    <section
                        aria-label="Placement totals"
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    >
                        <StatCard
                            icon={UserCheck}
                            accent="#3b7af5"
                            label="Workers on assignment"
                            value={<span className="tabular-nums">{placements.length}</span>}
                        />
                        <StatCard
                            icon={TrendingUp}
                            accent="#d97706"
                            label="Combined margin / hour"
                            value={
                                <span className="tabular-nums">{money(totalMarginMinor)}</span>
                            }
                        />
                    </section>

                    <Card padding="none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserCheck
                                    className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                    aria-hidden="true"
                                />
                                On assignment
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="p-0">
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Worker</Th>
                                        <Th>Job</Th>
                                        <Th>Start</Th>
                                        <Th align="right">Charge / pay</Th>
                                        <Th align="right">Margin / h</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {placements.map((p) => (
                                        <Tr key={p._id}>
                                            <Td className="font-mono text-xs text-[color:var(--st-text-secondary)]">
                                                {p.workerId}
                                            </Td>
                                            <Td className="font-mono text-xs text-[color:var(--st-text-secondary)]">
                                                {p.jobId}
                                            </Td>
                                            <Td>{new Date(p.startDate).toLocaleDateString()}</Td>
                                            <Td align="right" className="tabular-nums">
                                                {money(p.hourlyChargeRateMinor)} /{' '}
                                                {money(p.hourlyPayRateMinor)}
                                            </Td>
                                            <Td align="right">
                                                <Badge tone="accent" kind="soft">
                                                    <span className="tabular-nums">
                                                        {money(
                                                            p.hourlyChargeRateMinor -
                                                                p.hourlyPayRateMinor,
                                                        )}
                                                    </span>
                                                </Badge>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        </CardBody>
                    </Card>
                </>
            )}
        </div>
    );
}
