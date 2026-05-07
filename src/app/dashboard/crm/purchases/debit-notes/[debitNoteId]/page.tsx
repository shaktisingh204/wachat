/**
 * Debit Note detail page.
 *
 * Server component mirroring the quotation/invoice detail layout
 * (CrmPageHeader on top, 1fr_320px grid below: body card on the left,
 * <LineageRail> on the right) so the purchase-side document chain is
 * visible. See crm_function_plan.md §13.5.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileMinus } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getDebitNoteById } from '@/app/actions/crm-debit-notes.actions';
import { getCrmVendorById } from '@/app/actions/crm-vendors.actions';
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
    Applied: 'success',
    Refunded: 'success',
};

export default async function DebitNoteDetailPage({
    params,
}: {
    params: Promise<{ debitNoteId: string }>;
}) {
    const { debitNoteId } = await params;
    const dn = await getDebitNoteById(debitNoteId);

    if (!dn) {
        notFound();
    }

    const id = (dn._id as any)?.toString?.() ?? String(dn._id);
    const vendorId = dn.vendorId
        ? ((dn.vendorId as any)?.toString?.() ?? String(dn.vendorId))
        : '';
    const vendor = vendorId ? await getCrmVendorById(vendorId) : null;
    const vendorName =
        (vendor as any)?.displayName ?? (vendor as any)?.name ?? '(unknown vendor)';
    const vendorLocation = [
        (vendor as any)?.city,
        (vendor as any)?.state,
    ].filter(Boolean).join(', ');
    const lineItems = dn.lineItems ?? [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={dn.noteNumber || 'Debit Note'}
                subtitle="Debit note detail"
                icon={FileMinus}
                actions={
                    <Link href="/dashboard/crm/purchases/debit-notes">
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
                                <h2 className="text-[16px] text-zoru-ink">{dn.noteNumber}</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Issued {fmtDate(dn.noteDate)}
                                </p>
                            </div>
                            <ZoruBadge variant={STATUS_VARIANT[dn.status] ?? 'ghost'}>
                                {dn.status}
                            </ZoruBadge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
                            <div>
                                <div className="text-zoru-ink-muted">Vendor</div>
                                <div className="text-zoru-ink">{vendorName}</div>
                                {vendorLocation && (
                                    <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                        {vendorLocation}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Reason</div>
                                <div className="text-zoru-ink">{dn.reason || '—'}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Total</div>
                                <div className="text-zoru-ink">{fmtMoney(dn.total, dn.currency)}</div>
                            </div>
                        </div>

                        {lineItems.length > 0 && (
                            <div className="mt-6 overflow-x-auto rounded-lg border border-zoru-line">
                                <table className="w-full text-sm">
                                    <thead className="bg-zoru-surface-2">
                                        <tr className="border-b border-zoru-line">
                                            <th className="p-3 text-left text-zoru-ink">Description</th>
                                            <th className="p-3 text-right text-zoru-ink">Qty</th>
                                            <th className="p-3 text-right text-zoru-ink">Rate</th>
                                            <th className="p-3 text-right text-zoru-ink">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.map((li, i) => (
                                            <tr key={i} className="border-b border-zoru-line last:border-b-0">
                                                <td className="p-3 text-zoru-ink">{li.description || '—'}</td>
                                                <td className="p-3 text-right text-zoru-ink">{li.quantity}</td>
                                                <td className="p-3 text-right text-zoru-ink">{fmtMoney(li.rate, dn.currency)}</td>
                                                <td className="p-3 text-right text-zoru-ink">
                                                    {fmtMoney(li.amount ?? (li.quantity || 0) * (li.rate || 0), dn.currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {dn.notes && (
                            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] text-zoru-ink-muted">Notes</div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">{dn.notes}</div>
                            </div>
                        )}

                        {/* Edit subroute does not exist yet — button hidden per spec. */}
                    </ZoruCard>
                </div>

                <div className="flex flex-col gap-6">
                    <LineageRail
                        current={{
                            kind: 'debitNote',
                            id,
                            no: dn.noteNumber,
                            status: dn.status,
                        }}
                        lineage={dn.lineage ?? []}
                    />
                </div>
            </div>
        </div>
    );
}
