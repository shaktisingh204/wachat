import React from 'react';

import {
    Card,
    CardContent,
    PageHeader,
    ZoruPageTitle,
    ZoruPageDescription,
    Badge,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    EmptyState,
} from '@/components/zoruui';
import { Banknote } from 'lucide-react';
import { getSabworkerlyPayrollRuns } from '@/app/actions/sabworkerly.actions';
import { RunPayrollForm } from './_run-form';
import { PayrollRunActions } from './_actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function PayrollPage() {
    const runs = await getSabworkerlyPayrollRuns({ status: 'all', limit: 200 });
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <ZoruPageTitle>Payroll</ZoruPageTitle>
                <ZoruPageDescription>
                    Pay workers for approved timesheets. Uses each placement&apos;s pay rate.
                </ZoruPageDescription>
            </PageHeader>

            <Card>
                <CardContent className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Run payroll</h2>
                    <RunPayrollForm />
                </CardContent>
            </Card>

            {runs.length === 0 ? (
                <EmptyState
                    icon={Banknote}
                    title="No payroll runs yet"
                    description="Approve timesheets, then trigger a run using the form above."
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Workers</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {runs.map((r) => (
                                    <TableRow key={r._id}>
                                        <TableCell>
                                            {new Date(r.periodStart).toLocaleDateString()} —{' '}
                                            {new Date(r.periodEnd).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>{r.lineItems.length}</TableCell>
                                        <TableCell>{money(r.totalMinor, r.currency)}</TableCell>
                                        <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                                        <TableCell>
                                            <PayrollRunActions id={r._id} status={r.status} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
