'use client';

import { useRouter } from 'next/navigation';
import { getCrmChartOfAccountById, getVoucherEntriesForAccount } from '@/app/actions/crm-accounting.actions';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, ChevronDown, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState, useTransition, useCallback, use } from 'react';
import type { WithId, CrmChartOfAccount, CrmVoucherEntry } from '@/lib/definitions';
import { CrmChartOfAccountDialog } from '@/components/wabasimplify/crm-chart-of-account-dialog';

import { ClayCard, ClayButton } from '@/components/clay';

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
        const startDate = new Date(startYear, 3, 1);
        const endDate = new Date(startYear + 1, 2, 31);
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
                    <Button variant="ghost" asChild className="mb-2 -ml-4 text-muted-foreground hover:text-foreground">
                        <Link href="/dashboard/crm/accounting/charts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Chart of Accounts</Link>
                    </Button>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-[24px] font-semibold tracking-tight text-foreground">{account.name}</h1>
                            <p className="mt-1 text-[13px] text-muted-foreground">{(account as any).accountGroupName} [{(account as any).accountGroupCategory?.replace(/_/g, ' ')}]</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={financialYear} onValueChange={setFinancialYear}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fy2526">FY 2025-2026</SelectItem>
                                    <SelectItem value="fy2425">FY 2024-2025</SelectItem>
                                </SelectContent>
                            </Select>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <ClayButton variant="pill" trailing={<ChevronDown className="h-4 w-4" strokeWidth={1.75} />}>
                                        Actions
                                    </ClayButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>Edit Account</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} disabled>
                                Download CSV
                            </ClayButton>
                        </div>
                    </div>
                </div>

                <ClayCard>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {balanceDetails.map(item => (
                            <div key={item.label} className="p-4 bg-secondary border border-border rounded-lg">
                                <p className="text-[12.5px] text-muted-foreground">{item.label}</p>
                                <p className="mt-1 text-[22px] font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: account.currency }).format(item.value)}</p>
                                <p className="text-[11.5px] font-mono text-muted-foreground">{item.type}</p>
                            </div>
                        ))}
                    </div>
                </ClayCard>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Voucher Book</TableHead>
                                <TableHead className="text-muted-foreground">Voucher #</TableHead>
                                <TableHead className="text-muted-foreground">Note</TableHead>
                                <TableHead className="text-muted-foreground text-right">Debit</TableHead>
                                <TableHead className="text-muted-foreground text-right">Credit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground"/>
                                    </TableCell>
                                </TableRow>
                            ) : entries.length > 0 ? (
                                entries.map(entry => {
                                    const debitAmount = entry.debitEntries.find(d => d.accountId.toString() === account._id.toString())?.amount || 0;
                                    const creditAmount = entry.creditEntries.find(c => c.accountId.toString() === account._id.toString())?.amount || 0;

                                    return (
                                        <TableRow key={entry._id.toString()} className="border-border">
                                            <TableCell className="text-foreground">{new Date(entry.date).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-foreground">Voucher Book Name</TableCell>
                                            <TableCell className="font-mono text-[11.5px] text-foreground">{entry.voucherNumber}</TableCell>
                                            <TableCell className="text-muted-foreground text-[11.5px]">{entry.note}</TableCell>
                                            <TableCell className="text-right font-mono text-foreground">{debitAmount > 0 ? debitAmount.toFixed(2) : '-'}</TableCell>
                                            <TableCell className="text-right font-mono text-foreground">{creditAmount > 0 ? creditAmount.toFixed(2) : '-'}</TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow className="border-border">
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No transactions for this period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </>
    );
}
