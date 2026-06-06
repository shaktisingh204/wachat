import React from 'react';
import Link from 'next/link';

import { Button, Card, CardContent, PageHeader, PageTitle, PageActions, Badge, Table, THead, TBody, Tr, Th, Td, EmptyState } from '@/components/sabcrm/20ui/compat';
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
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <PageTitle>Jobs</PageTitle>
                <PageActions>
                    <Link href="/dashboard/sabworkerly/jobs/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
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
                    actionLabel="Post job"
                    actionHref="/dashboard/sabworkerly/jobs/new"
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Title</Th>
                                    <Th>Shift</Th>
                                    <Th>Charge</Th>
                                    <Th>Pay</Th>
                                    <Th>Margin</Th>
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
                                                    className="font-medium hover:underline"
                                                >
                                                    {j.title}
                                                </Link>
                                            </Td>
                                            <Td>{j.shiftPattern ?? '—'}</Td>
                                            <Td>{money(j.hourlyChargeRateMinor, j.currency)}/h</Td>
                                            <Td>{money(j.hourlyPayRateMinor, j.currency)}/h</Td>
                                            <Td>
                                                <Badge variant={margin > 0 ? 'default' : 'outline'}>
                                                    {money(margin, j.currency)}/h
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <Badge variant="secondary">{j.status}</Badge>
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
