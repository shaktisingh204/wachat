import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Button, Card, CardHeader, CardTitle, CardBody, PageHeader, PageTitle, PageActions, Badge, Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui';
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
                <PageTitle>{client.name}</PageTitle>
                <PageActions>
                    <Link href={`/dashboard/sabworkerly/jobs/new?clientId=${clientId}`}>
                        <Button>Post job for client</Button>
                    </Link>
                </PageActions>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
                    <CardBody className="space-y-1 text-sm">
                        <div>{client.contactName ?? '—'}</div>
                        <div className="text-[color:var(--st-text-secondary)]">{client.contactEmail ?? '—'}</div>
                        <div className="text-[color:var(--st-text-secondary)]">{client.contactPhone ?? '—'}</div>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
                    <CardBody>
                        <div className="text-2xl font-semibold">NET-{client.paymentTermsDays}</div>
                        <div className="text-xs text-[color:var(--st-text-secondary)]">payment terms</div>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                    <CardBody>
                        <Badge variant="secondary">{client.status}</Badge>
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Jobs posted ({jobs.length})</CardTitle></CardHeader>
                <CardBody className="p-0">
                    {jobs.length === 0 ? (
                        <p className="p-6 text-sm text-[color:var(--st-text-secondary)]">No jobs yet.</p>
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Title</Th>
                                    <Th>Charge rate</Th>
                                    <Th>Pay rate</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {jobs.map((j) => (
                                    <Tr key={j._id}>
                                        <Td>
                                            <Link href={`/dashboard/sabworkerly/jobs/${j._id}`} className="hover:underline">
                                                {j.title}
                                            </Link>
                                        </Td>
                                        <Td>{money(j.hourlyChargeRateMinor, j.currency)}/h</Td>
                                        <Td>{money(j.hourlyPayRateMinor, j.currency)}/h</Td>
                                        <Td>
                                            <Badge variant="secondary">{j.status}</Badge>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader><CardTitle>Active placements ({placements.length})</CardTitle></CardHeader>
                <CardBody className="p-0">
                    {placements.length === 0 ? (
                        <p className="p-6 text-sm text-[color:var(--st-text-secondary)]">No active placements.</p>
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
                                        <Td>{p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}</Td>
                                        <Td><Badge variant="secondary">{p.status}</Badge></Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader><CardTitle>Invoices ({invoices.length})</CardTitle></CardHeader>
                <CardBody className="p-0">
                    {invoices.length === 0 ? (
                        <p className="p-6 text-sm text-[color:var(--st-text-secondary)]">No invoices yet.</p>
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Period</Th>
                                    <Th>Lines</Th>
                                    <Th>Total</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {invoices.map((inv) => (
                                    <Tr key={inv._id}>
                                        <Td>
                                            {new Date(inv.periodStart).toLocaleDateString()} —{' '}
                                            {new Date(inv.periodEnd).toLocaleDateString()}
                                        </Td>
                                        <Td>{inv.lineItems.length}</Td>
                                        <Td>{money(inv.totalMinor, inv.currency)}</Td>
                                        <Td><Badge variant="secondary">{inv.status}</Badge></Td>
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
