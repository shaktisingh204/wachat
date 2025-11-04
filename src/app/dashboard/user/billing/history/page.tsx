

import { getTransactionsForUser } from '@/app/actions/index.ts';
import type { Transaction } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Receipt } from 'lucide-react';

export const dynamic = 'force-dynamic';

const getStatusVariant = (status: Transaction['status']) => {
    switch (status) {
        case 'SUCCESS': return 'default';
        case 'FAILED': return 'destructive';
        case 'PENDING': return 'secondary';
        default: return 'outline';
    }
};

export default async function BillingHistoryPage() {
    const transactions = await getTransactionsForUser();

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
                                    <TableHead>Status</TableHead>
                                    <TableHead>Transaction ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.length > 0 ? (
                                    transactions.map((t) => (
                                        <TableRow key={t._id.toString()}>
                                            <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                                            <TableCell className="font-medium">{t.description}</TableCell>
                                            <TableCell>₹{(t.amount / 100).toFixed(2)}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(t.status)}>{t.status}</Badge></TableCell>
                                            <TableCell className="font-mono text-xs">{t._id.toString()}</TableCell>
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

    
