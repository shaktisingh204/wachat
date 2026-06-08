import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
    Briefcase,
    FileText,
    Users,
    ArrowLeft,
    User,
    Mail,
    Phone,
    CalendarClock,
} from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageActions,
    Badge,
    type BadgeTone,
    StatCard,
    EmptyState,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
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

const EMPTY = '—';

const INV_TONE: Record<string, BadgeTone> = {
    paid: 'success',
    sent: 'info',
    overdue: 'danger',
    void: 'danger',
    draft: 'neutral',
};

function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
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
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>
                        <Link
                            href="/dashboard/sabworkerly/clients"
                            className="inline-flex items-center gap-1 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                            Clients
                        </Link>
                    </PageEyebrow>
                    <PageTitle>{client.name}</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Badge
                        tone={client.status === 'active' ? 'success' : 'neutral'}
                        kind="soft"
                        dot
                    >
                        {client.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="primary" asChild>
                        <Link href={`/dashboard/sabworkerly/jobs/new?clientId=${clientId}`}>
                            <Briefcase className="h-4 w-4" aria-hidden="true" />
                            Post job for client
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Client summary"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
                <StatCard
                    icon={Briefcase}
                    accent="#3b7af5"
                    label="Jobs posted"
                    value={<span className="tabular-nums">{jobs.length}</span>}
                />
                <StatCard
                    icon={Users}
                    accent="#1f9d55"
                    label="Active placements"
                    value={<span className="tabular-nums">{placements.length}</span>}
                />
                <StatCard
                    icon={FileText}
                    accent="#7c3aed"
                    label="Invoices"
                    value={<span className="tabular-nums">{invoices.length}</span>}
                />
                <StatCard
                    icon={CalendarClock}
                    accent="#d97706"
                    label="Payment terms"
                    value={
                        <span className="tabular-nums">NET-{client.paymentTermsDays}</span>
                    }
                />
            </section>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Primary contact
                    </CardTitle>
                </CardHeader>
                <CardBody className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div className="flex items-center gap-2">
                        <User
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        <span className="text-[color:var(--st-text)]">
                            {client.contactName ?? EMPTY}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Mail
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        <span className="text-[color:var(--st-text-secondary)]">
                            {client.contactEmail ?? EMPTY}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Phone
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        <span className="text-[color:var(--st-text-secondary)]">
                            {client.contactPhone ?? EMPTY}
                        </span>
                    </div>
                </CardBody>
            </Card>

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Briefcase
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Jobs posted
                        <Badge tone="neutral" kind="soft">
                            <span className="tabular-nums">{jobs.length}</span>
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    {jobs.length === 0 ? (
                        <EmptyState className="py-8" icon={Briefcase} title="No jobs yet" size="sm" />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Title</Th>
                                    <Th align="right">Charge rate</Th>
                                    <Th align="right">Pay rate</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {jobs.map((j) => (
                                    <Tr key={j._id}>
                                        <Td>
                                            <Link
                                                href={`/dashboard/sabworkerly/jobs/${j._id}`}
                                                className="font-medium text-[color:var(--st-text)] hover:underline focus-visible:underline focus-visible:outline-none"
                                            >
                                                {j.title}
                                            </Link>
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {money(j.hourlyChargeRateMinor, j.currency)}/h
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {money(j.hourlyPayRateMinor, j.currency)}/h
                                        </Td>
                                        <Td>
                                            <Badge tone="neutral" kind="soft">
                                                {cap(j.status)}
                                            </Badge>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Active placements
                        <Badge tone="neutral" kind="soft">
                            <span className="tabular-nums">{placements.length}</span>
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    {placements.length === 0 ? (
                        <EmptyState
                            className="py-8"
                            icon={Users}
                            title="No active placements"
                            size="sm"
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
                                        <Td className="font-mono text-xs text-[color:var(--st-text-secondary)]">
                                            {p.workerId}
                                        </Td>
                                        <Td>{new Date(p.startDate).toLocaleDateString()}</Td>
                                        <Td>
                                            {p.endDate
                                                ? new Date(p.endDate).toLocaleDateString()
                                                : EMPTY}
                                        </Td>
                                        <Td>
                                            <Badge tone="neutral" kind="soft">
                                                {cap(p.status)}
                                            </Badge>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Invoices
                        <Badge tone="neutral" kind="soft">
                            <span className="tabular-nums">{invoices.length}</span>
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    {invoices.length === 0 ? (
                        <EmptyState
                            className="py-8"
                            icon={FileText}
                            title="No invoices yet"
                            size="sm"
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Period</Th>
                                    <Th align="right">Lines</Th>
                                    <Th align="right">Total</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {invoices.map((inv) => (
                                    <Tr key={inv._id}>
                                        <Td>
                                            {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                                            {new Date(inv.periodEnd).toLocaleDateString()}
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {inv.lineItems.length}
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {money(inv.totalMinor, inv.currency)}
                                        </Td>
                                        <Td>
                                            <Badge tone={INV_TONE[inv.status] ?? 'neutral'} dot>
                                                {cap(inv.status)}
                                            </Badge>
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
