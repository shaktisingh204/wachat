/**
 * /portal/client/estimates — Estimate list.
 *
 * Each estimate has an "Accept" link to the public estimate-accept page
 * when the estimate is still waiting and has a `publicHash`.
 */

export const dynamic = 'force-dynamic';

import { getClientEstimates } from '@/app/actions/client-portal.actions';
import { ZoruBadge } from '@/components/zoruui/badge';
import { ZoruButton } from '@/components/zoruui/button';
import {
    ZoruCard,
    ZoruCardContent,
} from '@/components/zoruui/card';
import {
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui/table';
import { ZoruEmptyState } from '@/components/zoruui/empty-state';

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

export default async function ClientEstimatesPage() {
    const estimates = await getClientEstimates();

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">Estimates</h1>
                <p className="text-sm text-zoru-ink-muted">
                    Review and accept estimates from your account manager.
                </p>
            </div>

            {estimates.length === 0 ? (
                <ZoruEmptyState
                    title="No estimates yet"
                    description="Estimates sent to you will appear here."
                />
            ) : (
                <ZoruCard>
                    <ZoruCardContent className="p-0">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Number</ZoruTableHead>
                                    <ZoruTableHead>Valid Till</ZoruTableHead>
                                    <ZoruTableHead>Total</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Action</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {estimates.map((est) => {
                                    const waiting = ['waiting', 'sent', 'Sent'].includes(est.status);
                                    return (
                                        <ZoruTableRow key={est._id}>
                                            <ZoruTableCell className="font-medium text-zoru-ink">{est.number}</ZoruTableCell>
                                            <ZoruTableCell>{fmtDate(est.validTill)}</ZoruTableCell>
                                            <ZoruTableCell>{fmtCurrency(est.total, est.currency)}</ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge variant="outline">{est.status}</ZoruBadge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                {waiting && est.publicHash ? (
                                                    <ZoruButton asChild size="sm">
                                                        <a href={`/share/estimate/${est.publicHash}`}>Review</a>
                                                    </ZoruButton>
                                                ) : (
                                                    <span className="text-xs text-zoru-ink-muted">—</span>
                                                )}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </ZoruTable>
                    </ZoruCardContent>
                </ZoruCard>
            )}
        </div>
    );
}
