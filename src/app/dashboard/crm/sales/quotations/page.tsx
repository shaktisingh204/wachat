'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, LoaderCircle } from 'lucide-react';
import { getQuotations } from '@/app/actions/crm-quotations.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmQuotation } from '@/lib/definitions';
import Link from 'next/link';

import { ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

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

    const getStatusTone = (status: string): 'green' | 'amber' | 'red' | 'rose-soft' => {
        const s = status.toLowerCase();
        if (s === 'accepted') return 'green';
        if (s === 'sent') return 'amber';
        if (s === 'declined' || s === 'expired') return 'red';
        return 'rose-soft';
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Quotations & Estimates"
                subtitle="Create and manage your sales quotations."
                icon={FileText}
                actions={
                    <Link href="/dashboard/crm/sales/quotations/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Quotation
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Recent Quotations</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">A list of quotations you have created.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Quotation #</TableHead>
                                <TableHead className="text-muted-foreground">Client</TableHead>
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                                <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={5} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : quotations.length > 0 ? (
                                quotations.map(q => (
                                    <TableRow key={q._id.toString()} className="border-border cursor-pointer">
                                        <TableCell className="font-medium text-foreground">{q.quotationNumber}</TableCell>
                                        <TableCell className="text-foreground">{accountsMap.get(q.accountId.toString()) || 'Unknown Client'}</TableCell>
                                        <TableCell className="text-foreground">{new Date(q.quotationDate).toLocaleDateString()}</TableCell>
                                        <TableCell><ClayBadge tone={getStatusTone(q.status)} dot>{q.status}</ClayBadge></TableCell>
                                        <TableCell className="text-right font-medium text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: q.currency || 'INR' }).format(q.total)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-border">
                                    <TableCell colSpan={5} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No quotations found.
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
