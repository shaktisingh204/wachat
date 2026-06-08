import React from 'react';

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
    PageDescription,
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
import { Receipt, FilePlus2, CircleDollarSign } from 'lucide-react';
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

function statusLabel(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function InvoicesPage() {
    const [invoices, clients] = await Promise.all([
        getSabworkerlyInvoices({ status: 'all', limit: 200 }),
        getSabworkerlyClients({ status: 'active', limit: 200 }),
    ]);

    const outstanding = invoices.filter((i) =>
        ['draft', 'sent', 'overdue'].includes(i.status),
    );
    const outstandingMinor = outstanding.reduce((acc, i) => acc + i.totalMinor, 0);

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabWorkerly</PageEyebrow>
                    <PageTitle>Invoices</PageTitle>
                    <PageDescription>
                        Roll approved timesheets into a client-facing invoice and track what's owed.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <section
                aria-label="Invoice totals"
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
                <StatCard
                    icon={Receipt}
                    accent="#3b7af5"
                    label="Total invoices"
                    value={<span className="tabular-nums">{invoices.length}</span>}
                />
                <StatCard
                    icon={FilePlus2}
                    accent="#7c3aed"
                    label="Awaiting payment"
                    value={<span className="tabular-nums">{outstanding.length}</span>}
                />
                <StatCard
                    icon={CircleDollarSign}
                    accent="#d97706"
                    label="Outstanding balance"
                    value={<span className="tabular-nums">{money(outstandingMinor)}</span>}
                />
            </section>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FilePlus2
                            className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                            aria-hidden="true"
                        />
                        Generate invoice
                    </CardTitle>
                    <CardDescription>
                        Pick a client and period to aggregate their approved timesheets.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <GenerateInvoiceForm
                        clients={clients.map((c) => ({ id: c._id, name: c.name }))}
                    />
                </CardBody>
            </Card>

            {invoices.length === 0 ? (
                <EmptyState
                    icon={Receipt}
                    title="No invoices yet"
                    description="Approve timesheets, then use the form above to roll them into an invoice."
                />
            ) : (
                <Card padding="none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Receipt
                                className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                aria-hidden="true"
                            />
                            All invoices
                        </CardTitle>
                    </CardHeader>
                    <CardBody className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Period</Th>
                                    <Th align="right">Lines</Th>
                                    <Th align="right">Total</Th>
                                    <Th>Status</Th>
                                    <Th align="right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {invoices.map((inv) => (
                                    <Tr key={inv._id}>
                                        <Td>
                                            {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                                            {new Date(inv.periodEnd).toLocaleDateString()}
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {inv.lineItems.length}
                                        </Td>
                                        <Td align="right" className="tabular-nums">
                                            {money(inv.totalMinor, inv.currency)}
                                        </Td>
                                        <Td>
                                            <Badge tone={statusTone(inv.status)} dot>
                                                {statusLabel(inv.status)}
                                            </Badge>
                                        </Td>
                                        <Td align="right">
                                            <div className="flex justify-end">
                                                <InvoiceStatusActions
                                                    id={inv._id}
                                                    status={inv.status}
                                                />
                                            </div>
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
