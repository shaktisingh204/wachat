/**
 * Quotation detail page.
 *
 * Server component sibling of the invoice detail PoC. Renders the
 * quotation header, line items, notes/terms and the cross-feature
 * <LineageRail> so the document chain is visible. Mirrors the layout
 * of /dashboard/crm/sales/invoices/[invoiceId] (CrmPageHeader on top,
 * 1fr_320px grid below: body card on the left, lineage rail on the
 * right).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, FilePlus2 } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getQuotationById } from '@/app/actions/crm-quotations.actions';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';
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
    Accepted: 'success',
    Declined: 'danger',
    Expired: 'ghost',
};

export default async function QuotationDetailPage({
    params,
}: {
    params: Promise<{ quotationId: string }>;
}) {
    const { quotationId } = await params;
    const quotation = await getQuotationById(quotationId);

    if (!quotation) {
        notFound();
    }

    const id = (quotation._id as any)?.toString?.() ?? String(quotation._id);
    const accountId = quotation.accountId
        ? ((quotation.accountId as any)?.toString?.() ?? String(quotation.accountId))
        : '';
    const account = accountId ? await getCrmAccountById(accountId) : null;
    const clientName =
        (account as any)?.displayName ?? (account as any)?.name ?? '(unknown client)';
    const billing = (account as any)?.billingAddress ?? null;
    const clientLocation = [billing?.city, billing?.state].filter(Boolean).join(', ');
    const lineItems = quotation.lineItems ?? [];
    const terms = quotation.termsAndConditions ?? [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={quotation.quotationNumber || 'Quotation'}
                subtitle="Quotation detail"
                icon={FileText}
                actions={
                    <Link href="/dashboard/crm/sales/quotations">
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
                                <h2 className="text-[16px] text-zoru-ink">{quotation.quotationNumber}</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Issued {fmtDate(quotation.quotationDate)}
                                    {quotation.validTillDate ? ` • Valid till ${fmtDate(quotation.validTillDate)}` : ''}
                                </p>
                            </div>
                            <ZoruBadge variant={STATUS_VARIANT[quotation.status] ?? 'ghost'}>
                                {quotation.status}
                            </ZoruBadge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
                            <div>
                                <div className="text-zoru-ink-muted">Client</div>
                                <div className="text-zoru-ink">{clientName}</div>
                                {clientLocation && (
                                    <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                        {clientLocation}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Subtotal</div>
                                <div className="text-zoru-ink">{fmtMoney(quotation.subtotal, quotation.currency)}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Total</div>
                                <div className="text-zoru-ink">{fmtMoney(quotation.total, quotation.currency)}</div>
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
                                                <td className="p-3 text-right text-zoru-ink">{fmtMoney(li.rate, quotation.currency)}</td>
                                                <td className="p-3 text-right text-zoru-ink">
                                                    {fmtMoney((li.quantity || 0) * (li.rate || 0), quotation.currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {terms.length > 0 && (
                            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] text-zoru-ink-muted">Terms &amp; Conditions</div>
                                <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-zoru-ink">
                                    {terms.map((t, i) => (
                                        <li key={i}>{t}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {quotation.notes && (
                            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] text-zoru-ink-muted">Notes</div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">{quotation.notes}</div>
                            </div>
                        )}

                        <div className="mt-6 flex flex-wrap items-center gap-2">
                            {/* Edit subroute does not exist yet — button hidden per spec. */}
                            <form action={`/dashboard/crm/sales/quotations/${id}/convert-to-invoice`} method="post">
                                <ZoruButton type="submit" variant="default">
                                    <FilePlus2 className="h-4 w-4" />
                                    Convert to Invoice
                                </ZoruButton>
                            </form>
                        </div>
                    </ZoruCard>
                </div>

                <div className="flex flex-col gap-6">
                    <LineageRail
                        current={{
                            kind: 'quotation',
                            id,
                            no: quotation.quotationNumber,
                            status: quotation.status,
                        }}
                        lineage={quotation.lineage ?? []}
                    />
                </div>
            </div>
        </div>
    );
}
