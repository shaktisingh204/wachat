import React from 'react';
import { notFound } from 'next/navigation';
import { Briefcase, DollarSign, TrendingUp, Users } from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
    Badge,
    EmptyState,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
import {
    getSabworkerlyJobById,
    getSabworkerlyPlacements,
    getSabworkerlyWorkers,
} from '@/app/actions/sabworkerly.actions';
import { PlaceWorkerForm } from './_place-form';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function JobDetailPage({
    params,
}: {
    params: Promise<{ jobId: string }>;
}) {
    const { jobId } = await params;
    const job = await getSabworkerlyJobById(jobId);
    if (!job) notFound();
    const [placements, workers] = await Promise.all([
        getSabworkerlyPlacements({ jobId, status: 'all', limit: 50 }),
        getSabworkerlyWorkers({ status: 'active', limit: 200 }),
    ]);

    return (
        <div className="flex flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>{job.title}</PageTitle>
                </PageHeaderHeading>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <StatCard label="Status" value={<Badge tone="neutral">{job.status}</Badge>} icon={Briefcase} />
                <StatCard
                    label="Charge rate"
                    value={`${money(job.hourlyChargeRateMinor, job.currency)}/h`}
                    icon={DollarSign}
                />
                <StatCard
                    label="Pay rate"
                    value={`${money(job.hourlyPayRateMinor, job.currency)}/h`}
                    icon={DollarSign}
                />
                <StatCard
                    label="Margin"
                    value={`${money(job.hourlyChargeRateMinor - job.hourlyPayRateMinor, job.currency)}/h`}
                    icon={TrendingUp}
                />
            </div>

            {job.description && (
                <Card>
                    <CardHeader><CardTitle>Description</CardTitle></CardHeader>
                    <CardBody>
                        <p className="whitespace-pre-line text-sm">{job.description}</p>
                    </CardBody>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>Place a worker</CardTitle></CardHeader>
                <CardBody>
                    <PlaceWorkerForm
                        jobId={job._id}
                        defaultChargeMinor={job.hourlyChargeRateMinor}
                        defaultPayMinor={job.hourlyPayRateMinor}
                        defaultStartDate={new Date(job.startDate).toISOString().slice(0, 10)}
                        workers={workers.map((w) => ({ id: w._id, name: w.name }))}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader><CardTitle>Placements ({placements.length})</CardTitle></CardHeader>
                <CardBody className="p-0">
                    {placements.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            title="No workers placed yet"
                            description="Place a worker above and they will appear here."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Worker</Th>
                                    <Th>Start</Th>
                                    <Th>End</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {placements.map((p) => (
                                    <Tr key={p._id}>
                                        <Td className="font-mono text-xs">{p.workerId}</Td>
                                        <Td>{new Date(p.startDate).toLocaleDateString()}</Td>
                                        <Td>{p.endDate ? new Date(p.endDate).toLocaleDateString() : '-'}</Td>
                                        <Td><Badge tone="neutral">{p.status}</Badge></Td>
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
