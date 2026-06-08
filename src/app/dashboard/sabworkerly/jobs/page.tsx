import React from 'react';
import Link from 'next/link';

import {
    Button,
    Card,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageActions,
    Badge,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { Plus, Briefcase } from 'lucide-react';
import { getSabworkerlyJobs } from '@/app/actions/sabworkerly.actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function JobsListPage() {
    const jobs = await getSabworkerlyJobs({ status: 'all', limit: 200 });
    return (
        <div className="20ui flex flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Jobs</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/sabworkerly/jobs/new">
                        <Button iconLeft={Plus} variant="primary">
                            Post job
                        </Button>
                    </Link>
                </PageActions>
            </PageHeader>

            {jobs.length === 0 ? (
                <EmptyState
                    icon={Briefcase}
                    title="No jobs posted"
                    description="Post a job for one of your clients to start placing workers."
                    action={
                        <Link href="/dashboard/sabworkerly/jobs/new">
                            <Button iconLeft={Plus} variant="primary">
                                Post job
                            </Button>
                        </Link>
                    }
                />
            ) : (
                <Card padding="none">
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
                                    const margin = j.hourlyChargeRateMinor - j.hourlyPayRateMinor;
                                    return (
                                        <Tr key={j._id}>
                                            <Td>
                                                <Link
                                                    href={`/dashboard/sabworkerly/jobs/${j._id}`}
                                                    className="font-medium text-[var(--st-text)] hover:underline"
                                                >
                                                    {j.title}
                                                </Link>
                                            </Td>
                                            <Td>{j.shiftPattern ?? '-'}</Td>
                                            <Td align="right">{money(j.hourlyChargeRateMinor, j.currency)}/h</Td>
                                            <Td align="right">{money(j.hourlyPayRateMinor, j.currency)}/h</Td>
                                            <Td align="right">
                                                <Badge tone={margin > 0 ? 'success' : 'neutral'}>
                                                    {money(margin, j.currency)}/h
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <Badge tone="neutral">{j.status}</Badge>
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
