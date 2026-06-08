import React from 'react';
import Link from 'next/link';

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
    PageDescription,
    PageActions,
    Badge,
    type BadgeTone,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { Plus, Briefcase, DoorOpen, TrendingUp } from 'lucide-react';
import { getSabworkerlyJobs } from '@/app/actions/sabworkerly.actions';

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

function statusLabel(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function JobsListPage() {
    const jobs = await getSabworkerlyJobs({ status: 'all', limit: 200 });

    const openCount = jobs.filter((j) => j.status === 'open').length;
    const avgMargin =
        jobs.length === 0
            ? 0
            : Math.round(
                  jobs.reduce(
                      (acc, j) => acc + (j.hourlyChargeRateMinor - j.hourlyPayRateMinor),
                      0,
                  ) / jobs.length,
              );

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabWorkerly</PageEyebrow>
                    <PageTitle>Jobs</PageTitle>
                    <PageDescription>
                        Open roles across your clients. Margin is what you keep — charge rate minus
                        worker pay.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary" asChild>
                        <Link href="/dashboard/sabworkerly/jobs/new">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Post job
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            {jobs.length === 0 ? (
                <EmptyState
                    icon={Briefcase}
                    title="No jobs posted"
                    description="Post a job for one of your clients to start placing workers."
                    action={
                        <Button variant="primary" asChild>
                            <Link href="/dashboard/sabworkerly/jobs/new">
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Post job
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    <section
                        aria-label="Job totals"
                        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                    >
                        <StatCard
                            icon={Briefcase}
                            accent="#3b7af5"
                            label="Total jobs"
                            value={<span className="tabular-nums">{jobs.length}</span>}
                        />
                        <StatCard
                            icon={DoorOpen}
                            accent="#1f9d55"
                            label="Open roles"
                            value={<span className="tabular-nums">{openCount}</span>}
                        />
                        <StatCard
                            icon={TrendingUp}
                            accent="#d97706"
                            label="Avg margin / hour"
                            value={
                                <span className="tabular-nums">{money(avgMargin)}</span>
                            }
                        />
                    </section>

                    <Card padding="none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase
                                    className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                    aria-hidden="true"
                                />
                                All jobs
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="p-0">
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Title</Th>
                                        <Th>Shift</Th>
                                        <Th align="right">Charge</Th>
                                        <Th align="right">Pay</Th>
                                        <Th align="right">Margin</Th>
                                        <Th>Status</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {jobs.map((j) => {
                                        const margin =
                                            j.hourlyChargeRateMinor - j.hourlyPayRateMinor;
                                        return (
                                            <Tr key={j._id}>
                                                <Td>
                                                    <Link
                                                        href={`/dashboard/sabworkerly/jobs/${j._id}`}
                                                        className="font-medium text-[color:var(--st-text)] hover:underline focus-visible:underline focus-visible:outline-none"
                                                    >
                                                        {j.title}
                                                    </Link>
                                                </Td>
                                                <Td className="text-[color:var(--st-text-secondary)]">
                                                    {j.shiftPattern ?? '—'}
                                                </Td>
                                                <Td align="right" className="tabular-nums">
                                                    {money(j.hourlyChargeRateMinor, j.currency)}/h
                                                </Td>
                                                <Td align="right" className="tabular-nums">
                                                    {money(j.hourlyPayRateMinor, j.currency)}/h
                                                </Td>
                                                <Td align="right">
                                                    <Badge tone={margin > 0 ? 'success' : 'neutral'} kind="soft">
                                                        <span className="tabular-nums">
                                                            {money(margin, j.currency)}/h
                                                        </span>
                                                    </Badge>
                                                </Td>
                                                <Td>
                                                    <Badge
                                                        tone={STATUS_TONE[j.status] ?? 'neutral'}
                                                        dot
                                                    >
                                                        {statusLabel(j.status)}
                                                    </Badge>
                                                </Td>
                                            </Tr>
                                        );
                                    })}
                                </TBody>
                            </Table>
                        </CardBody>
                    </Card>
                </>
            )}
        </div>
    );
}
