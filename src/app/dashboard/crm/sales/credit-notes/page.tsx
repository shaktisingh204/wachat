
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Repeat, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getCreditNotes } from '@/app/actions/crm-credit-notes.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmCreditNote, CrmAccount } from '@/lib/definitions';

export default function CreditNotesPage() {
    const [notes, setNotes] = useState<WithId<CrmCreditNote>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [notesData, accountsData] = await Promise.all([
                getCreditNotes(),
                getCrmAccounts()
            ]);
            setNotes(notesData.notes);
            const newMap = new Map(accountsData.accounts.map(acc => [acc._id.toString(), acc.name]));
            setAccountsMap(newMap);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading && notes.length === 0) {
        return (
             <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
        )
    }

    if (!isLoading && notes.length === 0) {
        return (
            <div className="flex justify-center items-center h-full">
                <Card className="text-center max-w-2xl">
                    <CardHeader>
                        <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                             <Repeat className="h-12 w-12 text-primary" />
                        </div>
                        <CardTitle className="mt-4 text-2xl">Credit Notes</CardTitle>
                        <CardDescription>
                            Issue refunds or credits to your customers with professional credit notes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild>
                            <Link href="/dashboard/crm/sales/credit-notes/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Create First Credit Note
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Repeat className="h-8 w-8" />
                        Credit Notes
                    </h1>
                    <p className="text-muted-foreground">Manage your credit notes.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/sales/credit-notes/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Credit Note
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Credit Notes</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Credit Note #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Original Invoice #</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {notes.map(note => (
                                    <TableRow key={note._id.toString()}>
                                        <TableCell className="font-medium">{note.creditNoteNumber}</TableCell>
                                        <TableCell>{accountsMap.get(note.accountId.toString()) || 'Unknown'}</TableCell>
                                        <TableCell>{new Date(note.creditNoteDate).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{note.reason}</TableCell>
                                        <TableCell className="font-mono text-xs">{note.originalInvoiceNumber || 'N/A'}</TableCell>
                                        <TableCell className="text-right">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: note.currency || 'INR' }).format(note.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
