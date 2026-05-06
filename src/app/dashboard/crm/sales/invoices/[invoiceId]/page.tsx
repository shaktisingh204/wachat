'use client';

/**
 * Invoice detail page (PoC for the cross-feature lineage rail).
 *
 * This is a minimal detail view: the bulk of invoice editing still
 * lives on the list page's edit dialog. The point here is to host
 * <LineageRail> on a real document detail surface so the
 * lineage-tracking PR (crm_function_plan.md §13.5) has a working
 * proof-of-concept.
 */

import { use, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, Receipt } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruSkeleton,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getInvoiceById } from '@/app/actions/crm-invoices.actions';
import type { WithId, CrmInvoice } from '@/lib/definitions';
import { LineageRail } from '@/components/crm/lineage-rail';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(n: number, currency = 'INR'): string {
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(n || 0);
    } catch {
        return `${currency} ${n || 0}`;
    }
}

const STATUS_VARIANT: Record<string, 'ghost' | 'success' | 'warning' | 'danger'> = {
    Draft: 'ghost',
    Sent: 'warning',
    Paid: 'success',
    Overdue: 'danger',
    'Partially Paid': 'warning',
    Cancelled: 'ghost',
};

export default function InvoiceDetailPage(props: {
    params: Promise<{ invoiceId: string }>;
}) {
    const { invoiceId } = use(props.params);
    const [invoice, setInvoice] = useState<WithId<CrmInvoice> | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const result = await getInvoiceById(invoiceId);
            setInvoice(result);
        });
    }, [invoiceId]);

    if (isLoading && !invoice) {
        return (
            <div className="flex w-full flex-col gap-6">
                <ZoruSkeleton className="h-12 w-full" />
                <ZoruSkeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Invoice not found"
                    subtitle="The invoice you're looking for doesn't exist or you don't have access."
                    icon={Receipt}
                />
                <Link href="/dashboard/crm/sales/invoices">
                    <ZoruButton variant="outline">
                        <ArrowLeft className="h-4 w-4" />
                        Back to invoices
                    </ZoruButton>
                </Link>
            </div>
        );
    }

    const id = (invoice._id as any)?.toString?.() ?? String(invoice._id);
    const lineItems = invoice.lineItems ?? [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={invoice.invoiceNumber || 'Invoice'}
                subtitle="Invoice detail"
                icon={Receipt}
                actions={
                    <Link href="/dashboard/crm/sales/invoices">
                        <ZoruButton variant="outline">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </ZoruButton>
                    </Link>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <ZoruCard className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-[16px] text-zoru-ink">{invoice.invoiceNumber}</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Issued {fmtDate(invoice.invoiceDate)}
                                    {invoice.dueDate ? ` • Due ${fmtDate(invoice.dueDate)}` : ''}
                                </p>
                            </div>
                            <ZoruBadge variant={STATUS_VARIANT[invoice.status] ?? 'ghost'}>
                                {invoice.status}
                            </ZoruBadge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                            <div>
                                <div className="text-zoru-ink-muted">Subtotal</div>
                                <div className="text-zoru-ink">{fmtMoney(invoice.subtotal, invoice.currency)}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Total</div>
                                <div className="text-zoru-ink">{fmtMoney(invoice.total, invoice.currency)}</div>
                            </div>
                        </div>

                        {lineItems.length > 0 && (
                            <div className="mt-6 overflow-x-auto rounded-lg border border-zoru-line">
                                <table className="w-full text-sm">
                                    <thead className="bg-zoru-surface-2">
                                        <tr className="border-b border-zoru-line">
                                            <th className="p-3 text-left text-zoru-ink">Item</th>
                                            <th className="p-3 text-right text-zoru-ink">Qty</th>
                                            <th className="p-3 text-right text-zoru-ink">Rate</th>
                                            <th className="p-3 text-right text-zoru-ink">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.map((li) => (
                                            <tr key={li.id} className="border-b border-zoru-line last:border-b-0">
                                                <td className="p-3 text-zoru-ink">
                                                    <div>{li.name || li.description || '—'}</div>
                                                    {li.description && li.name && (
                                                        <div className="text-[11.5px] text-zoru-ink-muted">{li.description}</div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right text-zoru-ink">{li.quantity}</td>
                                                <td className="p-3 text-right text-zoru-ink">{fmtMoney(li.rate, invoice.currency)}</td>
                                                <td className="p-3 text-right text-zoru-ink">
                                                    {fmtMoney((li.quantity || 0) * (li.rate || 0), invoice.currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {invoice.notes && (
                            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] text-zoru-ink-muted">Notes</div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">{invoice.notes}</div>
                            </div>
                        )}
                    </ZoruCard>
                </div>

                <div className="flex flex-col gap-6">
                    <LineageRail
                        current={{
                            kind: 'invoice',
                            id,
                            no: invoice.invoiceNumber,
                            status: invoice.status,
                        }}
                        lineage={invoice.lineage ?? []}
                    />
                </div>
            </div>

            {isLoading && (
                <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-surface px-3 py-2 text-[12.5px] text-zoru-ink-muted">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Refreshing
                </div>
            )}
        </div>
    );
}
