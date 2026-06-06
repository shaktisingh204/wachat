import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    PageHeader,
    ZoruPageTitle,
    ZoruPageActions,
    Badge,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/sabcrm/20ui/compat';
import {
    getSabworkerlyClientById,
    getSabworkerlyJobs,
    getSabworkerlyPlacements,
    getSabworkerlyInvoices,
} from '@/app/actions/sabworkerly.actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function ClientDetailPage({
    params,
}: {
    params: Promise<{ clientId: string }>;
}) {
    const { clientId } = await params;
    const client = await getSabworkerlyClientById(clientId);
    if (!client) notFound();

    const [jobs, invoices] = await Promise.all([
        getSabworkerlyJobs({ clientId, status: 'all', limit: 50 }),
        getSabworkerlyInvoices({ clientId, status: 'all', limit: 50 }),
    ]);
    const jobIds = new Set(jobs.map((j) => j._id));
    const allPlacements = await getSabworkerlyPlacements({ status: 'active', limit: 200 });
    const placements = allPlacements.filter((p) => jobIds.has(p.jobId));

    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <ZoruPageTitle>{client.name}</ZoruPageTitle>
                <ZoruPageActions>
                    <Link href={`/dashboard/sabworkerly/jobs/new?clientId=${clientId}`}>
                        <Button>Post job for client</Button>
                    </Link>
                </ZoruPageActions>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                        <div>{client.contactName ?? '—'}</div>
                        <div className="text-[color:var(--st-text-secondary)]">{client.contactEmail ?? '—'}</div>
                        <div className="text-[color:var(--st-text-secondary)]">{client.contactPhone ?? '—'}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">NET-{client.paymentTermsDays}</div>
                        <div className="text-xs text-[color:var(--st-text-secondary)]">payment terms</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                    <CardContent>
                        <Badge variant="secondary">{client.status}</Badge>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Jobs posted ({jobs.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {jobs.length === 0 ? (
                        <p className="p-6 text-sm text-[color:var(--st-text-secondary)]">No jobs yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Charge rate</TableHead>
                                    <TableHead>Pay rate</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {jobs.map((j) => (
                                    <TableRow key={j._id}>
                                        <TableCell>
                                            <Link href={`/dashboard/sabworkerly/jobs/${j._id}`} className="hover:underline">
                                                {j.title}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{money(j.hourlyChargeRateMinor, j.currency)}/h</TableCell>
                                        <TableCell>{money(j.hourlyPayRateMinor, j.currency)}/h</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{j.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Active placements ({placements.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {placements.length === 0 ? (
                        <p className="p-6 text-sm text-[color:var(--st-text-secondary)]">No active placements.</p>
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

            <Card>
                <CardHeader><CardTitle>Invoices ({invoices.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {invoices.length === 0 ? (
                        <p className="p-6 text-sm text-[color:var(--st-text-secondary)]">No invoices yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Lines</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((inv) => (
                                    <TableRow key={inv._id}>
                                        <TableCell>
                                            {new Date(inv.periodStart).toLocaleDateString()} —{' '}
                                            {new Date(inv.periodEnd).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>{inv.lineItems.length}</TableCell>
                                        <TableCell>{money(inv.totalMinor, inv.currency)}</TableCell>
                                        <TableCell><Badge variant="secondary">{inv.status}</Badge></TableCell>
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
