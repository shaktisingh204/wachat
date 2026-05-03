import { getPayouts } from '@/app/actions/crm-payouts.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

import { ClayCard, ClayBadge } from '@/components/clay';
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

            <ClayCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-foreground">All Payouts</h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">Showing {payouts.length} of {total} payouts</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search payouts..."
                            className="h-10 rounded-lg border-border bg-card pl-9 text-[13px]"
                            defaultValue={query}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Reference #</TableHead>
                                <TableHead className="text-muted-foreground">Vendor</TableHead>
                                <TableHead className="text-muted-foreground">Mode</TableHead>
                                <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payouts.length === 0 ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={5} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No payouts found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                payouts.map((payout) => (
                                    <TableRow key={payout._id.toString()} className="border-border">
                                        <TableCell className="text-[13px] text-foreground">{format(new Date(payout.paymentDate), 'PP')}</TableCell>
                                        <TableCell className="font-mono text-xs text-foreground">{payout.referenceNumber || '-'}</TableCell>
                                        <TableCell>
                                            {payout.vendorId ? <span className="text-[12.5px] italic text-muted-foreground">Vendor {payout.vendorId.toString().slice(-4)}</span> : <span className="text-[13px] text-foreground">-</span>}
                                        </TableCell>
                                        <TableCell>
                                            <ClayBadge tone="rose-soft">{payout.paymentMode}</ClayBadge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-foreground">
                                            {payout.currency} {payout.amount.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
