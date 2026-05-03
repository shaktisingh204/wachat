'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileCheck, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getPaymentReceipts } from '@/app/actions/crm-payment-receipts.actions';
import type { WithId, CrmPaymentReceipt } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function PaymentReceiptsPage() {
    const [receipts, setReceipts] = useState<WithId<CrmPaymentReceipt>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [receiptsData, accountsData] = await Promise.all([
                getPaymentReceipts(),
                getCrmAccounts()
            ]);
            setReceipts(receiptsData.receipts);
            const newMap = new Map(accountsData.accounts.map(acc => [acc._id.toString(), acc.name]));
            setAccountsMap(newMap);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Payment Receipts"
                subtitle="Record and manage payments received from clients."
                icon={FileCheck}
                actions={
                    <Link href="/dashboard/crm/sales/receipts/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Receipt
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Recent Receipts</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">A list of payments you have recorded.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Receipt #</TableHead>
                                <TableHead className="text-muted-foreground">Client</TableHead>
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={4} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : receipts.length > 0 ? (
                                receipts.map(r => (
                                    <TableRow key={r._id.toString()} className="border-border cursor-pointer">
                                        <TableCell className="font-medium text-foreground">{r.receiptNumber}</TableCell>
                                        <TableCell className="text-foreground">{accountsMap.get(r.accountId.toString()) || 'Unknown Client'}</TableCell>
                                        <TableCell className="text-foreground">{new Date(r.receiptDate).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right font-medium text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: r.currency || 'INR' }).format(r.totalAmountReceived)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-border">
                                    <TableCell colSpan={4} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No receipts found.
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
