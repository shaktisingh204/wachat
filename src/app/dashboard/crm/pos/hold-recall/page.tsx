import { ZoruButton, ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import {
  PauseCircle,
  ShoppingCart } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

/**
 * POS held tickets — `/dashboard/crm/pos/hold-recall`.
 *
 * Server component. Lists currently-held tickets; per-row Recall
 * affordance routes the cashier back to the terminal with the hold
 * pre-loaded into the cart. Per CRM_REBUILD_PLAN §6.3.
 */

import Link from 'next/link';

import { getPosHolds } from '@/app/actions/crm-pos.actions';

export const dynamic = 'force-dynamic';

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function fmtMoney(v: number | null | undefined): string {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return inr.format(v);
}

function fmtDateTime(v: string | null | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default async function PosHoldRecallPage() {
    const holds = await getPosHolds({ status: 'held' });

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Held tickets"
                subtitle="Parked transactions waiting to be recalled."
                icon={PauseCircle}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'POS', href: '/dashboard/crm/pos' },
                    { label: 'Held tickets' },
                ]}
                actions={
                    <ZoruButton size="sm" variant="outline" asChild>
                        <Link href="/dashboard/crm/pos/terminal">
                            <ShoppingCart className="h-4 w-4" /> Back to
                            terminal
                        </Link>
                    </ZoruButton>
                }
            />
            <ZoruCard className="p-0">
                <div className="overflow-x-auto">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead>Customer</ZoruTableHead>
                                <ZoruTableHead>Lines</ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Subtotal
                                </ZoruTableHead>
                                <ZoruTableHead>Cashier</ZoruTableHead>
                                <ZoruTableHead>Held at</ZoruTableHead>
                                <ZoruTableHead>Reason</ZoruTableHead>
                                <ZoruTableHead className="text-right">
                                    Action
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {holds.length === 0 ? (
                                <ZoruTableRow>
                                    <ZoruTableCell
                                        colSpan={7}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        No held tickets right now.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                holds.map((h) => {
                                    const subtotal = h.lineItems.reduce(
                                        (sum, l) => sum + (l.total ?? 0),
                                        0,
                                    );
                                    return (
                                        <ZoruTableRow key={h._id}>
                                            <ZoruTableCell>
                                                {h.customerName || 'Walk-in'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                {h.lineItems.length}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right tabular-nums">
                                                {fmtMoney(subtotal)}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                {h.heldByName || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                {fmtDateTime(h.heldAt)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="max-w-[200px] truncate text-[12px] text-zoru-ink-muted">
                                                {h.holdReason || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton
                                                    size="sm"
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`/dashboard/crm/pos/terminal?holdId=${h._id}`}
                                                    >
                                                        Recall
                                                    </Link>
                                                </ZoruButton>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
