import React from "react";
import { fmtINR } from "@/lib/utils";
/**
 * /portal/client/invoices/[id] — Read-only invoice detail.
 *
 * Mirrors the public share-invoice page, but inside the authed portal
 * shell. If the invoice is unpaid and has a `publicHash`, shows a
 * "Pay Now" button linking to the public-share payment flow.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClientInvoiceById } from '@/app/actions/client-portal.actions';
import { Badge } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}


async function ClientInvoiceDetailPageContent({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const invoice = await getClientInvoiceById(id);
    if (!invoice) notFound();

    const unpaid = ['Sent', 'Overdue', 'Partially Paid'].includes(invoice.status);
    const balance = invoice.total - (invoice.paidAmount ?? 0);

    return (
        <div className="flex flex-col gap-4">
            <Link href="/portal/client/invoices" className="self-start text-sm text-[var(--st-text-secondary)] hover:underline">
                ← Back to invoices
            </Link>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                        <CardTitle>Invoice {invoice.invoiceNumber}</CardTitle>
                        <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
                            Issued {fmtDate(invoice.invoiceDate)} · Due {fmtDate(invoice.dueDate)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge>{invoice.status}</Badge>
                        {unpaid && invoice.publicHash ? (
                            <Button asChild>
                                <a href={`/share/invoice/${invoice.publicHash}`}>Pay Now</a>
                            </Button>
                        ) : null}
                    </div>
                </CardHeader>
                <CardBody>
                    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                        <div>
                            <dt className="text-xs text-[var(--st-text-secondary)]">Total</dt>
                            <dd className="text-[var(--st-text)]">{fmtINR(invoice.total, invoice.currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text-secondary)]">Paid</dt>
                            <dd className="text-[var(--st-text)]">{fmtINR(invoice.paidAmount ?? 0, invoice.currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text-secondary)]">Balance</dt>
                            <dd className="text-[var(--st-text)]">{fmtINR(Math.max(0, balance), invoice.currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text-secondary)]">Currency</dt>
                            <dd className="text-[var(--st-text)]">{invoice.currency}</dd>
                        </div>
                    </dl>
                </CardBody>
            </Card>

            {invoice.lineItems && invoice.lineItems.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Line Items</CardTitle>
                    </CardHeader>
                    <CardBody className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Item</Th>
                                    <Th className="text-right">Qty</Th>
                                    <Th className="text-right">Rate</Th>
                                    <Th className="text-right">Amount</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {invoice.lineItems.map((li, idx) => {
                                    const qty = typeof li.quantity === 'number' ? li.quantity : 0;
                                    const rate = typeof li.rate === 'number' ? li.rate : 0;
                                    return (
                                        <Tr key={idx}>
                                            <Td>
                                                <div className="font-medium text-[var(--st-text)]">{li.name ?? '—'}</div>
                                                {li.description ? (
                                                    <div className="text-xs text-[var(--st-text-secondary)]">{li.description}</div>
                                                ) : null}
                                            </Td>
                                            <Td className="text-right">{qty}</Td>
                                            <Td className="text-right">
                                                {fmtINR(rate, invoice.currency)}
                                            </Td>
                                            <Td className="text-right">
                                                {fmtINR(qty * rate, invoice.currency)}
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>
            ) : null}
        </div>
    );
}


export default function ClientInvoiceDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientInvoiceDetailPageContent params={params} />
    </React.Suspense>
  );
}
