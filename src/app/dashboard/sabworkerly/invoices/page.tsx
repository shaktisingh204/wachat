import React from 'react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    Badge,
    type BadgeTone,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
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

function statusTone(status: string): BadgeTone {
    switch (status) {
        case 'paid':
            return 'success';
        case 'sent':
            return 'info';
        case 'overdue':
        case 'void':
            return 'danger';
        case 'draft':
        default:
            return 'neutral';
    }
}

export default async function InvoicesPage() {
    const [invoices, clients] = await Promise.all([
        getSabworkerlyInvoices({ status: 'all', limit: 200 }),
        getSabworkerlyClients({ status: 'active', limit: 200 }),
    ]);
    return (
        <div className="flex flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Invoices</PageTitle>
                    <PageDescription>
                        Aggregate approved timesheets into a client-facing invoice.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <Card padding="none">
                <CardHeader>
                    <CardTitle>Generate invoice</CardTitle>
                </CardHeader>
                <CardBody>
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
                <Card padding="none">
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
                                            {new Date(inv.periodStart).toLocaleDateString()} to{' '}
                                            {new Date(inv.periodEnd).toLocaleDateString()}
                                        </Td>
                                        <Td>{inv.lineItems.length}</Td>
                                        <Td>{money(inv.totalMinor, inv.currency)}</Td>
                                        <Td>
                                            <Badge tone={statusTone(inv.status)}>{inv.status}</Badge>
                                        </Td>
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
