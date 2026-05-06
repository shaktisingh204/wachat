'use client';
import { ZoruButton, ZoruCard, ZoruDropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { getCrmChartOfAccountById, getVoucherEntriesForAccount } from '@/app/actions/crm-accounting.actions';

import { ArrowLeft, Download, ChevronDown, LoaderCircle } from 'lucide-react';
import Link from 'next/link';

import { useEffect, useState, useTransition, useCallback, use } from 'react';
import type { WithId, CrmChartOfAccount, CrmVoucherEntry } from '@/lib/definitions';
import { CrmChartOfAccountDialog } from '@/components/wabasimplify/crm-chart-of-account-dialog';

export default function AccountDetailPage(props: { params: Promise<{ accountId: string }> }) {
    const params = use(props.params);
    const [account, setAccount] = useState<WithId<CrmChartOfAccount> | null>(null);
    const [entries, setEntries] = useState<WithId<CrmVoucherEntry>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [financialYear, setFinancialYear] = useState('fy2526');
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const router = useRouter();

    const getDatesFromFy = (fy: string) => {
        const startYear = parseInt(fy.substring(2, 4), 10) + 2000;
        const startDate = new Date(startYear, 3, 1); // April 1st
        const endDate = new Date(startYear + 1, 2, 31); // March 31st
        return { startDate, endDate };
    }

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const { startDate, endDate } = getDatesFromFy(financialYear);
            const [accountData, entriesData] = await Promise.all([
                getCrmChartOfAccountById(params.accountId),
                getVoucherEntriesForAccount(params.accountId, startDate, endDate)
            ]);
            if (!accountData) {
                console.error("Account not found");
                return;
            }
            setAccount(accountData);
            setEntries(entriesData);
        });
    }, [params.accountId, financialYear]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading && !account) {
        return <div className="flex justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground"/></div>;
    }

    if (!account) {
        return <div className="py-10 text-center text-[13px] text-muted-foreground">Account not found.</div>;
    }

    const openingBalance = account.balanceType === 'Cr' ? -account.openingBalance : account.openingBalance;
    const { totalDebit, totalCredit } = entries.reduce((acc, entry) => {
        entry.debitEntries.forEach(de => {
            if (de.accountId.toString() === account._id.toString()) acc.totalDebit += de.amount;
        });
        entry.creditEntries.forEach(ce => {
            if (ce.accountId.toString() === account._id.toString()) acc.totalCredit += ce.amount;
        });
        return acc;
    }, { totalDebit: 0, totalCredit: 0 });

    const currentBalance = openingBalance + totalDebit - totalCredit;

    const balanceDetails = [
        { label: 'Opening Balance', value: account.openingBalance, type: account.balanceType },
        { label: 'Current Balance', value: Math.abs(currentBalance), type: currentBalance >= 0 ? 'Dr' : 'Cr' },
    ];

    return (
        <>
            <CrmChartOfAccountDialog
                isOpen={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                initialData={account}
                onSave={fetchData}
                accountGroups={[]}
            />
            <div className="flex w-full flex-col gap-6">
                <div>
                    <ZoruButton variant="ghost" asChild className="mb-2 -ml-4 text-muted-foreground hover:text-foreground">
                        <Link href="/dashboard/crm/accounting/charts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Chart of Accounts</Link>
                    </ZoruButton>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-[24px] font-semibold tracking-tight text-foreground">{account.name}</h1>
                            <p className="mt-1 text-[13px] text-muted-foreground">{(account as any).accountGroupName} [{(account as any).accountGroupCategory?.replace(/_/g, ' ')}]</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ZoruSelect value={financialYear} onValueChange={setFinancialYear}>
                                <ZoruSelectTrigger className="w-[180px]"><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="fy2526">FY 2025-2026</ZoruSelectItem>
                                    <ZoruSelectItem value="fy2425">FY 2024-2025</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                            <ZoruDropdownMenu>
                                <ZoruDropdownMenuTrigger asChild>
                                    <ZoruButton variant="outline">
                                        Actions
                                    </ZoruButton>
                                </ZoruDropdownMenuTrigger>
                                <ZoruDropdownMenuContent align="end">
                                    <ZoruDropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>Edit Account</ZoruDropdownMenuItem>
                                </ZoruDropdownMenuContent>
                            </ZoruDropdownMenu>
                            <ZoruButton variant="outline" disabled>
                                Download CSV
                            </ZoruButton>
                        </div>
                    </div>
                </div>

                <ZoruCard>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {balanceDetails.map(item => (
                            <div key={item.label} className="p-4 bg-secondary border border-border rounded-lg">
                                <p className="text-[12.5px] text-muted-foreground">{item.label}</p>
                                <p className="mt-1 text-[22px] font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: account.currency }).format(item.value)}</p>
                                <p className="text-[11.5px] font-mono text-muted-foreground">{item.type}</p>
                            </div>
                        ))}
                    </div>
                </ZoruCard>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Voucher Book</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Voucher #</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Note</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Debit</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Credit</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={6} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground"/>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : entries.length > 0 ? (
                                entries.map(entry => {
                                    const debitAmount = entry.debitEntries.find(d => d.accountId.toString() === account._id.toString())?.amount || 0;
                                    const creditAmount = entry.creditEntries.find(c => c.accountId.toString() === account._id.toString())?.amount || 0;

                                    return (
                                        <ZoruTableRow key={entry._id.toString()} className="border-border">
                                            <ZoruTableCell className="text-foreground">{new Date(entry.date).toLocaleDateString()}</ZoruTableCell>
                                            <ZoruTableCell className="text-foreground">Voucher Book Name</ZoruTableCell>
                                            <ZoruTableCell className="font-mono text-[11.5px] text-foreground">{entry.voucherNumber}</ZoruTableCell>
                                            <ZoruTableCell className="text-muted-foreground text-[11.5px]">{entry.note}</ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-foreground">{debitAmount > 0 ? debitAmount.toFixed(2) : '-'}</ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-foreground">{creditAmount > 0 ? creditAmount.toFixed(2) : '-'}</ZoruTableCell>
                                        </ZoruTableRow>
                                    )
                                })
                            ) : (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No transactions for this period.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </div>
        </>
    );
}
