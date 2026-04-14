'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Receipt, LoaderCircle, FileMinus } from "lucide-react";
import Link from 'next/link';
import { getInvoices } from '@/app/actions/crm-invoices.actions';
import { convertInvoiceToCreditNote } from '@/app/actions/crm-services.actions';
import type { WithId, CrmInvoice } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

import { ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<WithId<CrmInvoice>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const [convertingId, setConvertingId] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

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

    const handleConvert = async (invoiceId: string) => {
        setConvertingId(invoiceId);
        const res = await convertInvoiceToCreditNote(invoiceId);
        setConvertingId(null);
        if (res.success && res.creditNoteId) {
            toast({
                title: 'Converted',
                description: 'Credit note created from invoice.',
            });
            router.push(`/dashboard/crm/sales/credit-notes`);
        } else {
            toast({
                title: 'Error',
                description: res.error || 'Failed to convert invoice.',
                variant: 'destructive',
            });
        }
    };

    const getStatusTone = (status: string): 'green' | 'amber' | 'red' | 'rose-soft' => {
        const s = status.toLowerCase();
        if (s === 'paid') return 'green';
        if (s === 'sent') return 'amber';
        if (s === 'overdue') return 'red';
        return 'rose-soft';
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Invoices"
                subtitle="Create and manage your sales invoices."
                icon={Receipt}
                actions={
                    <Link href="/dashboard/crm/sales/invoices/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Invoice
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Recent Invoices</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">A list of invoices you have created.</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Invoice #</TableHead>
                                <TableHead className="text-clay-ink-muted">Client</TableHead>
                                <TableHead className="text-clay-ink-muted">Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Due Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Status</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Amount</TableHead>
                                <TableHead className="text-clay-ink-muted text-right w-[180px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={7} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted" />
                                    </TableCell>
                                </TableRow>
                            ) : invoices.length > 0 ? (
                                invoices.map(q => {
                                    const invoiceId = q._id.toString();
                                    const isConverting = convertingId === invoiceId;
                                    return (
                                    <TableRow key={invoiceId} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{q.invoiceNumber}</TableCell>
                                        <TableCell className="text-clay-ink">{accountsMap.get(q.accountId.toString()) || 'Unknown Client'}</TableCell>
                                        <TableCell className="text-clay-ink">{new Date(q.invoiceDate).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-clay-ink">{q.dueDate ? new Date(q.dueDate).toLocaleDateString() : 'N/A'}</TableCell>
                                        <TableCell><ClayBadge tone={getStatusTone(q.status)} dot>{q.status}</ClayBadge></TableCell>
                                        <TableCell className="text-right font-medium text-clay-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: q.currency || 'INR' }).format(q.total)}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <ClayButton
                                                        variant="pill"
                                                        size="sm"
                                                        disabled={isConverting}
                                                        leading={isConverting ? (
                                                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <FileMinus className="h-3.5 w-3.5" />
                                                        )}
                                                    >
                                                        Credit Note
                                                    </ClayButton>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-clay-ink">Convert to Credit Note?</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-clay-ink-muted">
                                                            This will create a new draft credit note from invoice {q.invoiceNumber}. The original invoice will remain unchanged.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleConvert(invoiceId)}>
                                                            Convert
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No invoices found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
