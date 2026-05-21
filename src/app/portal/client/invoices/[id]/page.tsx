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
import { ZoruBadge } from '@/components/zoruui/badge';
import { ZoruButton } from '@/components/zoruui/button';
import {
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui/card';
import {
    ZoruTable,
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

function fmtCurrency(n: number, ccy: string): string {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy || 'USD' }).format(n);
    } catch {
        return String(n);
    }
}

export default async function ClientInvoiceDetailPage({
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

            <ZoruCard>
                <ZoruCardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                        <ZoruCardTitle>Invoice {invoice.invoiceNumber}</ZoruCardTitle>
                        <p className="mt-1 text-sm text-zoru-ink-muted">
                            Issued {fmtDate(invoice.invoiceDate)} · Due {fmtDate(invoice.dueDate)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ZoruBadge>{invoice.status}</ZoruBadge>
                        {unpaid && invoice.publicHash ? (
                            <ZoruButton asChild>
                                <a href={`/share/invoice/${invoice.publicHash}`}>Pay Now</a>
                            </ZoruButton>
                        ) : null}
                    </div>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Total</dt>
                            <dd className="text-zoru-ink">{fmtCurrency(invoice.total, invoice.currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Paid</dt>
                            <dd className="text-zoru-ink">{fmtCurrency(invoice.paidAmount ?? 0, invoice.currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Balance</dt>
                            <dd className="text-zoru-ink">{fmtCurrency(Math.max(0, balance), invoice.currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zoru-ink-muted">Currency</dt>
                            <dd className="text-zoru-ink">{invoice.currency}</dd>
                        </div>
                    </dl>
                </ZoruCardContent>
            </ZoruCard>

            {invoice.lineItems && invoice.lineItems.length > 0 ? (
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Line Items</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="p-0">
                        <ZoruTable>
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
                                                {fmtCurrency(rate, invoice.currency)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                {fmtCurrency(qty * rate, invoice.currency)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </ZoruTable>
                    </ZoruCardContent>
                </ZoruCard>
            ) : null}
        </div>
    );
}
