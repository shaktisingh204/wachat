/**
 * Credit Note detail page.
 *
 * Server component sibling of the quotation/invoice detail pages.
 * Renders the credit note header, line items, reason/refund mode, and
 * the cross-feature <LineageRail> so the document chain is visible.
 * Mirrors the layout of /dashboard/crm/sales/invoices/[invoiceId]
 * (CrmPageHeader on top, 1fr_320px grid below: body card on the left,
 * lineage rail on the right). See crm_function_plan.md §13.5.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileMinus, Undo2 } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getCreditNoteById } from '@/app/actions/crm-credit-notes.actions';
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
    Issued: 'warning',
    Applied: 'success',
    Refunded: 'success',
    Void: 'danger',
    Cancelled: 'ghost',
};

// Statuses where a refund can still be issued. Empty/Draft/Issued/
// Applied are eligible; Refunded/Void/Cancelled are terminal.
const REFUNDABLE_STATUSES = new Set<string>(['Draft', 'Issued', 'Applied', '']);

export default async function CreditNoteDetailPage({
    params,
}: {
    params: Promise<{ creditNoteId: string }>;
}) {
    const { creditNoteId } = await params;
    const cn = await getCreditNoteById(creditNoteId);

    if (!cn) {
        notFound();
    }

    const id = (cn._id as any)?.toString?.() ?? String(cn._id);
    const accountId = cn.accountId
        ? ((cn.accountId as any)?.toString?.() ?? String(cn.accountId))
        : '';
    const account = accountId ? await getCrmAccountById(accountId) : null;
    const clientName =
        (account as any)?.displayName ?? (account as any)?.name ?? '(unknown client)';
    const billing = (account as any)?.billingAddress ?? null;
    const clientLocation = [billing?.city, billing?.state].filter(Boolean).join(', ');
    const lineItems = cn.lineItems ?? [];

    // CrmCreditNote does not (currently) carry first-class `status` or
    // `refundMode` fields, but the spec asks us to surface them when
    // present. Read defensively so we render whatever the document has
    // without forcing a schema migration.
    const status: string = (cn as any).status ?? '';
    const refundMode: string = (cn as any).refundMode ?? '';
    const cnNo: string = (cn as any).cnNo ?? cn.creditNoteNumber ?? 'Credit Note';

    const canRefund = REFUNDABLE_STATUSES.has(status);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={cnNo}
                subtitle="Credit note detail"
                icon={FileMinus}
                actions={
                    <Link href="/dashboard/crm/sales/credit-notes">
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
                                <h2 className="text-[16px] text-zoru-ink">{cnNo}</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Issued {fmtDate(cn.creditNoteDate)}
                                    {cn.originalInvoiceNumber
                                        ? ` • Against invoice ${cn.originalInvoiceNumber}`
                                        : ''}
                                </p>
                            </div>
                            {status && (
                                <ZoruBadge variant={STATUS_VARIANT[status] ?? 'ghost'}>
                                    {status}
                                </ZoruBadge>
                            )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
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
                                <div className="text-zoru-ink-muted">Reason</div>
                                <div className="text-zoru-ink">{cn.reason || '—'}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Refund mode</div>
                                <div className="text-zoru-ink">{refundMode || '—'}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Total</div>
                                <div className="text-zoru-ink">{fmtMoney(cn.total, cn.currency)}</div>
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
                                                <td className="p-3 text-right text-zoru-ink">{fmtMoney(li.rate, cn.currency)}</td>
                                                <td className="p-3 text-right text-zoru-ink">
                                                    {fmtMoney((li.quantity || 0) * (li.rate || 0), cn.currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-6 flex flex-wrap items-center gap-2">
                            {/* Edit subroute does not exist yet — button hidden per spec. */}
                            {canRefund && (
                                <ZoruButton type="button" variant="default" disabled>
                                    <Undo2 className="h-4 w-4" />
                                    + Issue Refund
                                </ZoruButton>
                            )}
                        </div>
                    </ZoruCard>
                </div>

                <div className="flex flex-col gap-6">
                    <LineageRail
                        current={{
                            kind: 'creditNote',
                            id,
                            no: cnNo,
                            status: status || undefined,
                        }}
                        lineage={cn.lineage ?? []}
                    />
                </div>
            </div>
        </div>
    );
}
