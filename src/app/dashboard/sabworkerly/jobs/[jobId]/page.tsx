import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    Briefcase,
    DollarSign,
    TrendingUp,
    Users,
    ArrowLeft,
    UserPlus,
    FileText,
} from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageActions,
    StatCard,
    Badge,
    type BadgeTone,
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

const STATUS_TONE: Record<string, BadgeTone> = {
    open: 'success',
    filled: 'info',
    closed: 'neutral',
    cancelled: 'danger',
};

function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
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

    const marginMinor = job.hourlyChargeRateMinor - job.hourlyPayRateMinor;

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>
                        <Link
                            href="/dashboard/sabworkerly/jobs"
                            className="inline-flex items-center gap-1 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                            Jobs
                        </Link>
                    </PageEyebrow>
                    <PageTitle>{job.title}</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Badge tone={STATUS_TONE[job.status] ?? 'neutral'} kind="soft" dot>
                        {cap(job.status)}
                    </Badge>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Job rates"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
                <StatCard
                    icon={Briefcase}
                    accent="#3b7af5"
                    label="Workers placed"
                    value={<span className="tabular-nums">{placements.length}</span>}
                />
                <StatCard
                    icon={DollarSign}
                    label="Charge rate"
                    value={
                        <span className="tabular-nums">
                            {money(job.hourlyChargeRateMinor, job.currency)}/h
                        </span>
                    }
                />
                <StatCard
                    icon={DollarSign}
                    label="Pay rate"
                    value={
                        <span className="tabular-nums">
                            {money(job.hourlyPayRateMinor, job.currency)}/h
                        </span>
                    }
                />
                <StatCard
                    icon={TrendingUp}
                    accent="#d97706"
                    label="Margin"
                    value={
                        <span className="tabular-nums">{money(marginMinor, job.currency)}/h</span>
                    }
                />
            </section>

            {job.description && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText
                                className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                aria-hidden="true"
                            />
                            Description
                        </CardTitle>
                    </CardHeader>
                    <CardBody>
                        <p className="max-w-[65ch] whitespace-pre-line text-sm leading-relaxed text-[color:var(--st-text)]">
                            {job.description}
                        </p>
                    </CardBody>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Place a worker
                    </CardTitle>
                    <CardDescription>
                        Assign an available worker to this job at the agreed charge and pay rates.
                    </CardDescription>
                </CardHeader>
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

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Placements
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
                                        <Td className="font-mono text-xs text-[color:var(--st-text-secondary)]">
                                            {p.workerId}
                                        </Td>
                                        <Td>{new Date(p.startDate).toLocaleDateString()}</Td>
                                        <Td>
                                            {p.endDate
                                                ? new Date(p.endDate).toLocaleDateString()
                                                : '—'}
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
        </div>
    );
}
