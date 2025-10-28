'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, LoaderCircle } from 'lucide-react';
import { getQuotations } from '@/app/actions/crm-quotations.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmQuotation, CrmAccount } from '@/lib/definitions';
import Link from 'next/link';

export default function QuotationsPage() {
    const [quotations, setQuotations] = useState<WithId<CrmQuotation>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [quotationsData, accountsData] = await Promise.all([
                getQuotations(),
                getCrmAccounts()
            ]);
            setQuotations(quotationsData.quotations);
            const newMap = new Map(accountsData.accounts.map(acc => [acc._id.toString(), acc.name]));
            setAccountsMap(newMap);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        const s = status.toLowerCase();
        if(s === 'accepted') return 'default';
        if(s === 'sent') return 'secondary';
        if(s === 'declined' || s === 'expired') return 'destructive';
        return 'outline';
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <FileText className="h-8 w-8" />
                        Quotations & Estimates
                    </h1>
                    <p className="text-muted-foreground">Create and manage your sales quotations.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/sales/quotations/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Quotation
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Quotations</CardTitle>
                    <CardDescription>A list of quotations you have created.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Quotation #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : quotations.length > 0 ? (
                                    quotations.map(q => (
                                        <TableRow key={q._id.toString()} className="cursor-pointer" onClick={() => { /* router.push(`/dashboard/crm/sales/quotations/${q._id.toString()}`) */ }}>
                                            <TableCell className="font-medium">{q.quotationNumber}</TableCell>
                                            <TableCell>{accountsMap.get(q.accountId.toString()) || 'Unknown Client'}</TableCell>
                                            <TableCell>{new Date(q.quotationDate).toLocaleDateString()}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(q.status)}>{q.status}</Badge></TableCell>
                                            <TableCell className="text-right">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: q.currency || 'INR' }).format(q.total)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No quotations found.
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
