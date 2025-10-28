'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText as FileTextIcon, LoaderCircle, Eye } from "lucide-react";
import Link from 'next/link';
import { getInvoices } from '@/app/actions/crm-invoices.actions';
import type { WithId, CrmInvoice, CrmAccount } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<WithId<CrmInvoice>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [invoicesData, accountsData] = await Promise.all([
                getInvoices(),
                getCrmAccounts()
            ]);
            setInvoices(invoicesData.invoices);
            const newMap = new Map(accountsData.accounts.map(acc => [acc._id.toString(), acc.name]));
            setAccountsMap(newMap);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        const s = status.toLowerCase();
        if(s === 'paid') return 'default';
        if(s === 'sent') return 'secondary';
        if(s === 'overdue') return 'destructive';
        return 'outline'; // Draft
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <FileTextIcon className="h-8 w-8" />
                        Invoices
                    </h1>
                    <p className="text-muted-foreground">Create and manage your sales invoices.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/sales/invoices/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Invoice
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Invoices</CardTitle>
                    <CardDescription>A list of invoices you have created.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : invoices.length > 0 ? (
                                    invoices.map(q => (
                                        <TableRow key={q._id.toString()} className="cursor-pointer" onClick={() => { /* router.push(`/dashboard/crm/sales/invoices/${q._id.toString()}`) */ }}>
                                            <TableCell className="font-medium">{q.invoiceNumber}</TableCell>
                                            <TableCell>{accountsMap.get(q.accountId.toString()) || 'Unknown Client'}</TableCell>
                                            <TableCell>{new Date(q.invoiceDate).toLocaleDateString()}</TableCell>
                                            <TableCell>{q.dueDate ? new Date(q.dueDate).toLocaleDateString() : 'N/A'}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(q.status)}>{q.status}</Badge></TableCell>
                                            <TableCell className="text-right">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: q.currency || 'INR' }).format(q.total)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No invoices found.
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
