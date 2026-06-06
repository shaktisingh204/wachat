import React from 'react';

import { Card, CardBody, PageHeader, PageTitle, PageDescription, Badge, Table, THead, TBody, Tr, Th, Td, EmptyState } from '@/components/sabcrm/20ui';
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
                <PageTitle>Payroll</PageTitle>
                <PageDescription>
                    Pay workers for approved timesheets. Uses each placement&apos;s pay rate.
                </PageDescription>
            </PageHeader>

            <Card>
                <CardBody className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Run payroll</h2>
                    <RunPayrollForm />
                </CardBody>
            </Card>

            {runs.length === 0 ? (
                <EmptyState
                    icon={Banknote}
                    title="No payroll runs yet"
                    description="Approve timesheets, then trigger a run using the form above."
                />
            ) : (
                <Card>
                    <CardBody className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Period</Th>
                                    <Th>Workers</Th>
                                    <Th>Total</Th>
                                    <Th>Status</Th>
                                    <Th>Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {runs.map((r) => (
                                    <Tr key={r._id}>
                                        <Td>
                                            {new Date(r.periodStart).toLocaleDateString()} —{' '}
                                            {new Date(r.periodEnd).toLocaleDateString()}
                                        </Td>
                                        <Td>{r.lineItems.length}</Td>
                                        <Td>{money(r.totalMinor, r.currency)}</Td>
                                        <Td><Badge variant="secondary">{r.status}</Badge></Td>
                                        <Td>
                                            <PayrollRunActions id={r._id} status={r.status} />
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
