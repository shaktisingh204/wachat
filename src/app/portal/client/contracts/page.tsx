/**
 * /portal/client/contracts — Contract list with "Sign" CTA for unsigned.
 */

export const dynamic = 'force-dynamic';

import { getClientContracts } from '@/app/actions/client-portal.actions';
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

function fmtCurrency(n: number | undefined, ccy: string | undefined): string {
    if (typeof n !== 'number') return '—';
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy || 'USD' }).format(n);
    } catch {
        return String(n);
    }
}

export default async function ClientContractsPage() {
    const contracts = await getClientContracts();

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">Contracts</h1>
                <p className="text-sm text-zoru-ink-muted">
                    Active agreements and pending signatures.
                </p>
            </div>

            {contracts.length === 0 ? (
                <ZoruEmptyState
                    title="No contracts yet"
                    description="Contracts shared with you will appear here."
                />
            ) : (
                <ZoruCard>
                    <ZoruCardContent className="p-0">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Name</ZoruTableHead>
                                    <ZoruTableHead>Type</ZoruTableHead>
                                    <ZoruTableHead>Amount</ZoruTableHead>
                                    <ZoruTableHead>Period</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Action</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {contracts.map((c) => {
                                    const unsigned = !c.signedAt;
                                    return (
                                        <ZoruTableRow key={c._id}>
                                            <ZoruTableCell className="font-medium text-zoru-ink">{c.title}</ZoruTableCell>
                                            <ZoruTableCell>{c.type ?? '—'}</ZoruTableCell>
                                            <ZoruTableCell>{fmtCurrency(c.value, c.currency)}</ZoruTableCell>
                                            <ZoruTableCell className="text-xs text-zoru-ink-muted">
                                                {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge variant={unsigned ? 'outline' : 'secondary'}>
                                                    {c.signedAt ? 'Signed' : c.status}
                                                </ZoruBadge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                {unsigned && c.publicHash ? (
                                                    <ZoruButton asChild size="sm">
                                                        <a href={`/share/contract/${c.publicHash}`}>Review &amp; Sign</a>
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
