import React from 'react';
import { notFound } from 'next/navigation';

import { Card, CardHeader, CardTitle, CardContent, PageHeader, PageTitle, Badge, Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui/compat';
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

    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <PageTitle>{worker.name}</PageTitle>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm">
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
                        <div className="flex justify-between">
                            <span className="text-[color:var(--st-text-secondary)]">Status</span>
                            <Badge variant="secondary">{worker.status}</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[color:var(--st-text-secondary)]">Pay rate</span>
                            <span>{money(worker.hourlyRateMinor, worker.currency)}/h</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-2">
                            {(worker.skills ?? []).map((s) => (
                                <Badge key={s} variant="outline">{s}</Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Documents</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(worker.documentIds ?? []).length === 0 ? (
                            <p className="text-sm text-[color:var(--st-text-secondary)]">
                                No documents attached.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-1 text-sm">
                                {(worker.documentIds ?? []).map((id) => (
                                    <li key={id} className="rounded-md border border-[color:var(--st-border)] px-3 py-2 font-mono text-xs">
                                        {id}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Earnings (approved + invoiced)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-semibold">
                            {money(earningsMinor, worker.currency)}
                        </div>
                        <div className="text-xs text-[color:var(--st-text-secondary)]">
                            {timesheets.length} timesheet(s) on file
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Placement history</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {placements.length === 0 ? (
                        <p className="p-6 text-sm text-[color:var(--st-text-secondary)]">
                            No placements yet.
                        </p>
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
                                            {p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}
                                        </Td>
                                        <Td>{money(p.hourlyChargeRateMinor)}</Td>
                                        <Td>{money(p.hourlyPayRateMinor)}</Td>
                                        <Td>
                                            <Badge variant="secondary">{p.status}</Badge>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
