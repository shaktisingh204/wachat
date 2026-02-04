'use server';

import { Suspense } from 'react';
import { getPayouts } from '@/app/actions/crm-payouts.actions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';

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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Payout Receipts</h1>
                    <p className="text-muted-foreground">Record and track payments made to vendors.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/purchases/payouts/new">
                        <Plus className="mr-2 h-4 w-4" /> Record Payout
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Payouts</CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search payouts..."
                                className="pl-8"
                                defaultValue={query}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Reference #</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payouts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No payouts found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    payouts.map((payout) => (
                                        <TableRow key={payout._id.toString()}>
                                            <TableCell>{format(new Date(payout.paymentDate), 'PP')}</TableCell>
                                            <TableCell className="font-mono text-xs">{payout.referenceNumber || '-'}</TableCell>
                                            <TableCell>
                                                {payout.vendorId ? <span className="text-muted-foreground italic">Vendor {payout.vendorId.toString().slice(-4)}</span> : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{payout.paymentMode}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {payout.currency} {payout.amount.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <div className="text-xs text-muted-foreground">
                        Showing {payouts.length} of {total} payouts
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
