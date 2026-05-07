/**
 * Payout detail page.
 *
 * Server component sibling of the invoice / quotation detail surfaces.
 * Renders the payout header, optional apply-to-bills table, and the
 * cross-feature <LineageRail> so the procurement chain is visible
 * (RFQ -> Bid -> PO -> GRN -> Bill -> Payout). Mirrors the layout of
 * /dashboard/crm/sales/quotations/[quotationId]: CrmPageHeader on top,
 * 1fr_320px grid below with body card on the left and lineage rail on
 * the right.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getPayoutById } from '@/app/actions/crm-payouts.actions';
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
    Pending: 'warning',
    Cleared: 'success',
    Failed: 'danger',
    Cancelled: 'ghost',
    Reconciled: 'success',
};

export default async function PayoutDetailPage({
    params,
}: {
    params: Promise<{ payoutId: string }>;
}) {
    const { payoutId } = await params;
    const payout = await getPayoutById(payoutId);

    if (!payout) {
        notFound();
    }

    const id = (payout._id as any)?.toString?.() ?? String(payout._id);

    // CrmPayout stores `referenceNumber` as the human-friendly number.
    // Some forward-compat callers may stamp `paymentNo`; prefer that
    // when present so the rail stays in sync with payment numbering.
    const paymentNo =
        ((payout as any).paymentNo as string | undefined) ??
        payout.referenceNumber ??
        '';
    const status = ((payout as any).status as string | undefined) ?? 'Cleared';
    const bankAccount =
        ((payout as any).bankAccount as string | undefined) ??
        ((payout as any).bankAccountId as string | undefined) ??
        '';

    const vendorId = payout.vendorId
        ? ((payout.vendorId as any)?.toString?.() ?? String(payout.vendorId))
        : '';
    const vendor = vendorId ? await getCrmVendorById(vendorId) : null;
    const vendorName =
        (vendor as any)?.displayName ?? (vendor as any)?.name ?? '(unknown vendor)';

    // applyTo[] is the canonical multi-bill settlement field per
    // crm_function_plan.md §13.5. Older docs may carry the same data
    // under `appliedBills` — accept either shape.
    const rawApplyTo =
        ((payout as any).applyTo as Array<{ billId?: string; billNo?: string; amount?: number }> | undefined) ??
        ((payout as any).appliedBills as Array<{ billId?: string; billNo?: string; amount?: number }> | undefined) ??
        [];
    const applyTo = Array.isArray(rawApplyTo) ? rawApplyTo : [];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={paymentNo || 'Payout'}
                subtitle="Payout detail"
                icon={Wallet}
                actions={
                    <Link href="/dashboard/crm/purchases/payouts">
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
                                <h2 className="text-[16px] text-zoru-ink">{paymentNo || 'Payout'}</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Paid {fmtDate(payout.paymentDate)}
                                    {payout.paymentMode ? ` • ${payout.paymentMode}` : ''}
                                </p>
                            </div>
                            <ZoruBadge variant={STATUS_VARIANT[status] ?? 'ghost'}>
                                {status}
                            </ZoruBadge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
                            <div>
                                <div className="text-zoru-ink-muted">Vendor</div>
                                <div className="text-zoru-ink">{vendorName}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Mode</div>
                                <div className="text-zoru-ink">{payout.paymentMode || '—'}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Bank Account</div>
                                <div className="text-zoru-ink">{bankAccount || '—'}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Amount</div>
                                <div className="text-zoru-ink">{fmtMoney(payout.amount, payout.currency)}</div>
                            </div>
                        </div>

                        {applyTo.length > 0 && (
                            <div className="mt-6 overflow-x-auto rounded-lg border border-zoru-line">
                                <table className="w-full text-sm">
                                    <thead className="bg-zoru-surface-2">
                                        <tr className="border-b border-zoru-line">
                                            <th className="p-3 text-left text-zoru-ink">Bill Ref</th>
                                            <th className="p-3 text-right text-zoru-ink">Amount Applied</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {applyTo.map((row, i) => {
                                            const ref =
                                                row.billNo ??
                                                (row.billId ? row.billId.toString() : '') ??
                                                '';
                                            return (
                                                <tr
                                                    key={(row.billId ?? `${i}`)?.toString()}
                                                    className="border-b border-zoru-line last:border-b-0"
                                                >
                                                    <td className="p-3 text-zoru-ink">
                                                        {ref || `Bill ${i + 1}`}
                                                    </td>
                                                    <td className="p-3 text-right text-zoru-ink">
                                                        {fmtMoney(row.amount ?? 0, payout.currency)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {payout.referenceNumber && payout.referenceNumber !== paymentNo && (
                            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] text-zoru-ink-muted">Reference</div>
                                <div className="mt-1 font-mono text-[13px] text-zoru-ink">
                                    {payout.referenceNumber}
                                </div>
                            </div>
                        )}

                        {payout.notes && (
                            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] text-zoru-ink-muted">Notes</div>
                                <div className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                                    {payout.notes}
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex flex-wrap items-center gap-2">
                            {/* Edit subroute does not exist yet — button hidden per spec. */}
                        </div>
                    </ZoruCard>
                </div>

                <div className="flex flex-col gap-6">
                    <LineageRail
                        current={{
                            kind: 'payout',
                            id,
                            no: paymentNo,
                            status,
                        }}
                        lineage={payout.lineage ?? []}
                    />
                </div>
            </div>
        </div>
    );
}
