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
                <ZoruPageTitle>Invoices</ZoruPageTitle>
                <ZoruPageDescription>
                    Aggregate approved timesheets into a client-facing invoice.
                </ZoruPageDescription>
            </PageHeader>

            <Card>
                <CardContent className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Generate invoice</h2>
                    <GenerateInvoiceForm clients={clients.map((c) => ({ id: c._id, name: c.name }))} />
                </CardContent>
            </Card>

            {invoices.length === 0 ? (
                <EmptyState
                    icon={Receipt}
                    title="No invoices yet"
                    description="Approve timesheets, then use the Generate form above to roll them into an invoice."
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Lines</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((inv) => (
                                    <TableRow key={inv._id}>
                                        <TableCell>
                                            {new Date(inv.periodStart).toLocaleDateString()} —{' '}
                                            {new Date(inv.periodEnd).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>{inv.lineItems.length}</TableCell>
                                        <TableCell>{money(inv.totalMinor, inv.currency)}</TableCell>
                                        <TableCell><Badge variant="secondary">{inv.status}</Badge></TableCell>
                                        <TableCell>
                                            <InvoiceStatusActions id={inv._id} status={inv.status} />
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
