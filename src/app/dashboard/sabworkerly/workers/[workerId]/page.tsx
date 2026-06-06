import React from 'react';
import { notFound } from 'next/navigation';
import { FileText, Briefcase, Wallet } from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    StatCard,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Badge,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
import {
    getSabworkerlyWorkerById,
    getSabworkerlyPlacements,
    getSabworkerlyTimesheets,
} from '@/app/actions/sabworkerly.actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function WorkerDetailPage({
    params,
}: {
    params: Promise<{ workerId: string }>;
}) {
    const { workerId } = await params;
    const worker = await getSabworkerlyWorkerById(workerId);
    if (!worker) notFound();

    const [placements, timesheets] = await Promise.all([
        getSabworkerlyPlacements({ workerId, status: 'all', limit: 50 }),
        getSabworkerlyTimesheets({ workerId, status: 'all', limit: 50 }),
    ]);

    const earningsMinor = timesheets
        .filter((t) => t.status === 'approved' || t.status === 'invoiced')
        .reduce((acc, t) => acc + Math.round(t.totalHours * worker.hourlyRateMinor), 0);

    const documentIds = worker.documentIds ?? [];

    return (
        <div className="flex flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>{worker.name}</PageTitle>
                </PageHeaderHeading>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-[color:var(--st-text-secondary)]">Email</span>
                            <span>{worker.email}</span>
                        </div>
                        {worker.phone && (
                            <div className="flex justify-between">
                                <span className="text-[color:var(--st-text-secondary)]">Phone</span>
                                <span>{worker.phone}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <span className="text-[color:var(--st-text-secondary)]">Status</span>
                            <Badge tone="neutral" kind="soft">{worker.status}</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[color:var(--st-text-secondary)]">Pay rate</span>
                            <span>{money(worker.hourlyRateMinor, worker.currency)}/h</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-2">
                            {(worker.skills ?? []).map((s) => (
                                <Badge key={s} tone="neutral" kind="outline">{s}</Badge>
                            ))}
                        </div>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Documents</CardTitle>
                    </CardHeader>
                    <CardBody>
                        {documentIds.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={FileText}
                                title="No documents attached"
                                description="Documents linked to this worker will appear here."
                            />
                        ) : (
                            <ul className="flex flex-col gap-1 text-sm">
                                {documentIds.map((id) => (
                                    <li
                                        key={id}
                                        className="rounded-[var(--st-radius)] border border-[color:var(--st-border)] px-3 py-2 font-mono text-xs"
                                    >
                                        {id}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
                <StatCard
                    icon={Wallet}
                    label="Earnings (approved + invoiced)"
                    value={money(earningsMinor, worker.currency)}
                    delta={{ value: `${timesheets.length} timesheet(s) on file`, tone: 'neutral' }}
                />
            </div>

            <Card padding="none">
                <CardHeader>
                    <CardTitle>Placement history</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    {placements.length === 0 ? (
                        <EmptyState
                            className="py-8"
                            icon={Briefcase}
                            title="No placements yet"
                            description="Placements for this worker will be listed here once created."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Job</Th>
                                    <Th>Start</Th>
                                    <Th>End</Th>
                                    <Th>Charge rate</Th>
                                    <Th>Pay rate</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {placements.map((p) => (
                                    <Tr key={p._id}>
                                        <Td className="font-mono text-xs">{p.jobId}</Td>
                                        <Td>{new Date(p.startDate).toLocaleDateString()}</Td>
                                        <Td>
                                            {p.endDate ? new Date(p.endDate).toLocaleDateString() : '-'}
                                        </Td>
                                        <Td>{money(p.hourlyChargeRateMinor)}</Td>
                                        <Td>{money(p.hourlyPayRateMinor)}</Td>
                                        <Td>
                                            <Badge tone="neutral" kind="soft">{p.status}</Badge>
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
