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
import { Badge } from '@/components/zoruui/badge';
import { Button } from '@/components/zoruui/button';
import {
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui/card';
import {
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui/table';

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
            <Link href="/portal/client/invoices" className="self-start text-sm text-zoru-ink-muted hover:underline">
                ← Back to invoices
            </Link>

            <Card>
                <ZoruCardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                        <ZoruCardTitle>Invoice {invoice.invoiceNumber}</ZoruCardTitle>
                        <p className="mt-1 text-sm text-zoru-ink-muted">
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
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Total</dt>
                            <dd className="text-zoru-ink">{fmtINR(invoice.total, invoice.currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Paid</dt>
                            <dd className="text-zoru-ink">{fmtINR(invoice.paidAmount ?? 0, invoice.currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Balance</dt>
                            <dd className="text-zoru-ink">{fmtINR(Math.max(0, balance), invoice.currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Currency</dt>
                            <dd className="text-zoru-ink">{invoice.currency}</dd>
                        </div>
                    </dl>
                </ZoruCardContent>
            </Card>

            {invoice.lineItems && invoice.lineItems.length > 0 ? (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Line Items</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="p-0">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Item</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Qty</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Rate</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Amount</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {invoice.lineItems.map((li, idx) => {
                                    const qty = typeof li.quantity === 'number' ? li.quantity : 0;
                                    const rate = typeof li.rate === 'number' ? li.rate : 0;
                                    return (
                                        <ZoruTableRow key={idx}>
                                            <ZoruTableCell>
                                                <div className="font-medium text-zoru-ink">{li.name ?? '—'}</div>
                                                {li.description ? (
                                                    <div className="text-xs text-zoru-ink-muted">{li.description}</div>
                                                ) : null}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">{qty}</ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                {fmtINR(rate, invoice.currency)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                {fmtINR(qty * rate, invoice.currency)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </Table>
                    </ZoruCardContent>
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
