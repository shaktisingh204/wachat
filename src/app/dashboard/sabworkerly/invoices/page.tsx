import React from 'react';

import { Card, CardBody, PageHeader, PageTitle, PageDescription, Badge, Table, THead, TBody, Tr, Th, Td, EmptyState } from '@/components/sabcrm/20ui';
import { Receipt } from 'lucide-react';
import {
    getSabworkerlyInvoices,
    getSabworkerlyClients,
} from '@/app/actions/sabworkerly.actions';
import { GenerateInvoiceForm } from './_generate-form';
import { InvoiceStatusActions } from './_actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function InvoicesPage() {
    const [invoices, clients] = await Promise.all([
        getSabworkerlyInvoices({ status: 'all', limit: 200 }),
        getSabworkerlyClients({ status: 'active', limit: 200 }),
    ]);
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <PageTitle>Invoices</PageTitle>
                <PageDescription>
                    Aggregate approved timesheets into a client-facing invoice.
                </PageDescription>
            </PageHeader>

            <Card>
                <CardBody className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Generate invoice</h2>
                    <GenerateInvoiceForm clients={clients.map((c) => ({ id: c._id, name: c.name }))} />
                </CardBody>
            </Card>

            {invoices.length === 0 ? (
                <EmptyState
                    icon={Receipt}
                    title="No invoices yet"
                    description="Approve timesheets, then use the Generate form above to roll them into an invoice."
                />
            ) : (
                <Card>
                    <CardBody className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Period</Th>
                                    <Th>Lines</Th>
                                    <Th>Total</Th>
                                    <Th>Status</Th>
                                    <Th>Actions</Th>
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
                                        <Td>
                                            <InvoiceStatusActions id={inv._id} status={inv.status} />
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
