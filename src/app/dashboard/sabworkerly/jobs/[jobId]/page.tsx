import React from 'react';
import { notFound } from 'next/navigation';

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    PageHeader,
    ZoruPageTitle,
    Badge,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/zoruui';
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
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <ZoruPageTitle>{job.title}</ZoruPageTitle>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                    <CardContent><Badge variant="secondary">{job.status}</Badge></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Charge rate</CardTitle></CardHeader>
                    <CardContent className="text-xl font-semibold">
                        {money(job.hourlyChargeRateMinor, job.currency)}/h
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Pay rate</CardTitle></CardHeader>
                    <CardContent className="text-xl font-semibold">
                        {money(job.hourlyPayRateMinor, job.currency)}/h
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Margin</CardTitle></CardHeader>
                    <CardContent className="text-xl font-semibold">
                        {money(job.hourlyChargeRateMinor - job.hourlyPayRateMinor, job.currency)}/h
                    </CardContent>
                </Card>
            </div>

            {job.description && (
                <Card>
                    <CardHeader><CardTitle>Description</CardTitle></CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-line text-sm">{job.description}</p>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>Place a worker</CardTitle></CardHeader>
                <CardContent>
                    <PlaceWorkerForm
                        jobId={job._id}
                        defaultChargeMinor={job.hourlyChargeRateMinor}
                        defaultPayMinor={job.hourlyPayRateMinor}
                        defaultStartDate={new Date(job.startDate).toISOString().slice(0, 10)}
                        workers={workers.map((w) => ({ id: w._id, name: w.name }))}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Placements ({placements.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {placements.length === 0 ? (
                        <p className="p-6 text-sm text-[color:var(--zoru-muted-fg)]">
                            No workers placed yet.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Worker</TableHead>
                                    <TableHead>Start</TableHead>
                                    <TableHead>End</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {placements.map((p) => (
                                    <TableRow key={p._id}>
                                        <TableCell className="font-mono text-xs">{p.workerId}</TableCell>
                                        <TableCell>{new Date(p.startDate).toLocaleDateString()}</TableCell>
                                        <TableCell>{p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}</TableCell>
                                        <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
