import React from 'react';
import Link from 'next/link';

import {
    Button,
    Card,
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
    EmptyState,
} from '@/components/zoruui';
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
                <ZoruPageTitle>Jobs</ZoruPageTitle>
                <ZoruPageActions>
                    <Link href="/dashboard/sabworkerly/jobs/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Post job
                        </Button>
                    </Link>
                </ZoruPageActions>
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
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Shift</TableHead>
                                    <TableHead>Charge</TableHead>
                                    <TableHead>Pay</TableHead>
                                    <TableHead>Margin</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {jobs.map((j) => {
                                    const margin = j.hourlyChargeRateMinor - j.hourlyPayRateMinor;
                                    return (
                                        <TableRow key={j._id}>
                                            <TableCell>
                                                <Link
                                                    href={`/dashboard/sabworkerly/jobs/${j._id}`}
                                                    className="font-medium hover:underline"
                                                >
                                                    {j.title}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{j.shiftPattern ?? '—'}</TableCell>
                                            <TableCell>{money(j.hourlyChargeRateMinor, j.currency)}/h</TableCell>
                                            <TableCell>{money(j.hourlyPayRateMinor, j.currency)}/h</TableCell>
                                            <TableCell>
                                                <Badge variant={margin > 0 ? 'default' : 'outline'}>
                                                    {money(margin, j.currency)}/h
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{j.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
