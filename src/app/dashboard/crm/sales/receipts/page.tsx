'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileCheck, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getPaymentReceipts } from '@/app/actions/crm-payment-receipts.actions';
import type { WithId, CrmPaymentReceipt } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';

import {
    ZoruButton,
    ZoruCard,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
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
                        <ZoruButton>
                            <Plus className="h-4 w-4" strokeWidth={1.75} />
                            New Receipt
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Recent Receipts</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">A list of payments you have recorded.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Receipt #</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Amount</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : receipts.length > 0 ? (
                                receipts.map(r => (
                                    <ZoruTableRow key={r._id.toString()} className="border-zoru-line cursor-pointer">
                                        <ZoruTableCell className="text-zoru-ink">{r.receiptNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{accountsMap.get(r.accountId.toString()) || 'Unknown Client'}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{new Date(r.receiptDate).toLocaleDateString()}</ZoruTableCell>
                                        <ZoruTableCell className="text-right text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: r.currency || 'INR' }).format(r.totalAmountReceived)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <Link
                                                href={`/dashboard/crm/sales/receipts/${r._id}/edit`}
                                                className="text-[12.5px] font-medium text-zoru-ink hover:underline"
                                            >
                                                Edit
                                            </Link>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No receipts found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
