import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    FileText,
    Briefcase,
    Wallet,
    ArrowLeft,
    Mail,
    Phone,
    BadgeCheck,
} from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    StatCard,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageActions,
    Button,
    Badge,
    type BadgeTone,
    Separator,
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

const STATUS_TONE: Record<string, BadgeTone> = {
    active: 'success',
    on_assignment: 'info',
    inactive: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
    active: 'Active',
    on_assignment: 'On assignment',
    inactive: 'Inactive',
};

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

    const approvedTimesheets = timesheets.filter(
        (t) => t.status === 'approved' || t.status === 'invoiced',
    );
    const earningsMinor = approvedTimesheets.reduce(
        (acc, t) => acc + Math.round(t.totalHours * worker.hourlyRateMinor),
        0,
    );

    const documentIds = worker.documentIds ?? [];

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>
                        <Link
                            href="/dashboard/sabworkerly/workers"
                            className="inline-flex items-center gap-1 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                            Workers
                        </Link>
                    </PageEyebrow>
                    <PageTitle>{worker.name}</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Badge tone={STATUS_TONE[worker.status] ?? 'neutral'} kind="soft" dot>
                        {STATUS_LABEL[worker.status] ?? worker.status}
                    </Badge>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Worker summary"
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
                <StatCard
                    icon={Wallet}
                    accent="#1f9d55"
                    label="Earnings (approved + invoiced)"
                    value={<span className="tabular-nums">{money(earningsMinor, worker.currency)}</span>}
                />
                <StatCard
                    icon={BadgeCheck}
                    accent="#3b7af5"
                    label="Pay rate"
                    value={
                        <span className="tabular-nums">
                            {money(worker.hourlyRateMinor, worker.currency)}/h
                        </span>
                    }
                />
                <StatCard
                    icon={Briefcase}
                    accent="#7c3aed"
                    label="Timesheets on file"
                    value={<span className="tabular-nums">{timesheets.length}</span>}
                />
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-3 text-sm">
                        <div className="flex items-center gap-2">
                            <Mail
                                className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                aria-hidden="true"
                            />
                            <span className="text-[color:var(--st-text)]">{worker.email}</span>
                        </div>
                        {worker.phone && (
                            <div className="flex items-center gap-2">
                                <Phone
                                    className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                    aria-hidden="true"
                                />
                                <span className="text-[color:var(--st-text)]">{worker.phone}</span>
                            </div>
                        )}
                        {(worker.skills ?? []).length > 0 && (
                            <>
                                <Separator className="my-1" />
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-[color:var(--st-text-secondary)]">
                                        Skills
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {(worker.skills ?? []).map((s) => (
                                            <Badge key={s} tone="neutral" kind="soft">
                                                {s}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText
                                className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                aria-hidden="true"
                            />
                            Documents
                        </CardTitle>
                    </CardHeader>
                    <CardBody>
                        {documentIds.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={FileText}
                                title="No documents attached"
                                description="ID, visa, and certifications linked to this worker appear here."
                            />
                        ) : (
                            <ul className="flex flex-col gap-1 text-sm">
                                {documentIds.map((id) => (
                                    <li
                                        key={id}
                                        className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[color:var(--st-border)] px-3 py-2 font-mono text-xs text-[color:var(--st-text-secondary)]"
                                    >
                                        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        {id}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            </div>

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Briefcase
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Placement history
                    </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    {placements.length === 0 ? (
                        <EmptyState
                            className="py-8"
                            icon={Briefcase}
                            title="No placements yet"
                            description="Placements for this worker are listed here once created."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Job</Th>
                                    <Th>Start</Th>
                                    <Th>End</Th>
                                    <Th align="right">Charge rate</Th>
                                    <Th align="right">Pay rate</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {placements.map((p) => (
                                    <Tr key={p._id}>
                                        <Td className="font-mono text-xs text-[color:var(--st-text-secondary)]">
                                            {p.jobId}
                                        </Td>
                                        <Td>{new Date(p.startDate).toLocaleDateString()}</Td>
                                        <Td>
                                            {p.endDate
                                                ? new Date(p.endDate).toLocaleDateString()
                                                : '—'}
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {money(p.hourlyChargeRateMinor)}
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {money(p.hourlyPayRateMinor)}
                                        </Td>
                                        <Td>
                                            <Badge tone="neutral" kind="soft">
                                                {p.status}
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
