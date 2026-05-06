import { ZoruBadge, ZoruCard, ZoruInput, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import { getPayouts } from '@/app/actions/crm-payouts.actions';

import { Plus, Search, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { format } from 'date-fns';

import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function PayoutReceiptsPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        page?: string;
    }>;
}) {
    const params = await searchParams;
    const query = params?.query || '';
    const currentPage = Number(params?.page) || 1;
    const { payouts, total } = await getPayouts(currentPage, 20, query);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Payout Receipts"
                subtitle="Record and track payments made to vendors."
                icon={ArrowUpRight}
                actions={
                    <Link
                        href="/dashboard/crm/purchases/payouts/new"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-medium text-white hover:bg-foreground/90"
                    >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        Record Payout
                    </Link>
                }
            />

            <ZoruCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-foreground">All Payouts</h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">Showing {payouts.length} of {total} payouts</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <ZoruInput
                            type="search"
                            placeholder="Search payouts..."
                            className="h-10 rounded-lg border-border bg-card pl-9 text-[13px]"
                            defaultValue={query}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reference #</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Vendor</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Mode</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Amount</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {payouts.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No payouts found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                payouts.map((payout) => (
                                    <ZoruTableRow key={payout._id.toString()} className="border-border">
                                        <ZoruTableCell className="text-[13px] text-foreground">{format(new Date(payout.paymentDate), 'PP')}</ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-xs text-foreground">{payout.referenceNumber || '-'}</ZoruTableCell>
                                        <ZoruTableCell>
                                            {payout.vendorId ? <span className="text-[12.5px] italic text-muted-foreground">Vendor {payout.vendorId.toString().slice(-4)}</span> : <span className="text-[13px] text-foreground">-</span>}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruBadge variant="ghost">{payout.paymentMode}</ZoruBadge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-medium text-foreground">
                                            {payout.currency} {payout.amount.toFixed(2)}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
