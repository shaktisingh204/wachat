

'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, CreditCard, LoaderCircle, Eye } from "lucide-react";
import Link from 'next/link';
import { getPaymentReceipts } from '@/app/actions/crm-payment-receipts.actions';
import type { WithId, CrmPaymentReceipt } from '@/lib/definitions';

export default function PaymentReceiptsPage() {
    const [receipts, setReceipts] = useState<WithId<CrmPaymentReceipt>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getPaymentReceipts();
            setReceipts(data.receipts);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <CreditCard className="h-8 w-8" />
                        Payment Receipts
                    </h1>
                    <p className="text-muted-foreground">Record and manage payments received from clients.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/sales/receipts/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Receipt
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Receipts</CardTitle>
                    <CardDescription>A list of payments you have recorded.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Receipt #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : receipts.length > 0 ? (
                                    receipts.map(r => (
                                        <TableRow key={r._id.toString()} className="cursor-pointer" onClick={() => { /* router.push(`/dashboard/crm/sales/receipts/${r._id.toString()}`) */ }}>
                                            <TableCell className="font-medium">{r.receiptNumber}</TableCell>
                                            <TableCell>Client Name Placeholder</TableCell>
                                            <TableCell>{new Date(r.receiptDate).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: r.currency || 'INR' }).format(r.totalAmountReceived)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No receipts found.
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

