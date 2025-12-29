
'use client';

import type { WalletTransaction } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Receipt } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { getSession } from '@/app/actions';
import { useEffect, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { LoaderCircle } from 'lucide-react';

export default function BillingHistoryPage() {
    const [transactions, setTransactions] = useState<WithId<WalletTransaction>[]>([]);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const session = await getSession();
            // Transactions are now part of the user's wallet object
            const walletTransactions = session?.user?.wallet?.transactions || [];
            // Sort by most recent first
            const sortedTransactions = walletTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setTransactions(sortedTransactions);
        });
    }, []);

    const getStatusVariant = (status: string) => {
        if (status === 'SUCCESS') return 'default';
        if (status === 'PENDING') return 'secondary';
        return 'destructive';
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href="/dashboard/user/billing"><ChevronLeft className="mr-2 h-4 w-4" />Back to Billing</Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Billing History</h1>
                <p className="text-muted-foreground">A record of all your plan upgrades and credit purchases.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Your Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-48 text-center">
                                            <div className="flex justify-center items-center">
                                                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : transactions.length > 0 ? (
                                    transactions.map(t => (
                                        <TableRow key={t._id.toString()}>
                                            <TableCell>{format(new Date(t.createdAt), 'PPpp')}</TableCell>
                                            <TableCell>{t.reason}</TableCell>
                                            <TableCell>₹{(t.amount / 100).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Badge variant={t.type === 'CREDIT' ? 'default' : 'secondary'}>
                                                    {t.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell><Badge variant={getStatusVariant(t.status)}>{t.status}</Badge></TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-48 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <Receipt className="h-12 w-12 text-muted-foreground" />
                                                <p className="text-muted-foreground">You don't have any transactions yet.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
