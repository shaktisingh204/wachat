
'use client';

import { notFound, useRouter } from 'next/navigation';
import { getCrmChartOfAccountById, getVoucherEntriesForAccount } from '@/app/actions/crm-accounting.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, SlidersHorizontal, Trash2, Edit, ChevronDown, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState, useTransition, useCallback } from 'react';
import type { WithId, CrmChartOfAccount, CrmVoucherEntry } from '@/lib/definitions';
import { DatePicker } from '@/components/ui/date-picker';
import { CrmChartOfAccountDialog } from '@/components/wabasimplify/crm-chart-of-account-dialog';

export default function AccountDetailPage({ params }: { params: { accountId: string } }) {
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
                // Potentially call notFound() if this were a server component,
                // or handle error state for client component.
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
        return <div>Loading...</div>; // Replace with Skeleton
    }

    if (!account) {
        return <div>Account not found.</div>;
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
            <div className="space-y-6">
                <div>
                     <Button variant="ghost" asChild className="mb-2 -ml-4">
                        <Link href="/dashboard/crm/accounting/charts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Chart of Accounts</Link>
                    </Button>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold font-headline">{account.name}</h1>
                            <p className="text-muted-foreground">{account.accountGroupName} [{account.accountGroupCategory?.replace(/_/g, ' ')}]</p>
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
                                    <Button variant="outline">
                                        Actions
                                        <ChevronDown className="ml-2 h-4 w-4"/>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>Edit Account</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="outline" disabled><Download className="mr-2 h-4 w-4" />Download CSV</Button>
                        </div>
                    </div>
                </div>

                <Card>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                        {balanceDetails.map(item => (
                            <div key={item.label} className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm text-muted-foreground">{item.label}</p>
                                <p className="text-2xl font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: account.currency }).format(item.value)}</p>
                                <p className="text-xs font-mono text-muted-foreground">{item.type}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                 <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Voucher Book</TableHead>
                                <TableHead>Voucher #</TableHead>
                                <TableHead>Note</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/>
                                    </TableCell>
                                </TableRow>
                             ) : entries.length > 0 ? (
                                entries.map(entry => {
                                    const debitAmount = entry.debitEntries.find(d => d.accountId.toString() === account._id.toString())?.amount || 0;
                                    const creditAmount = entry.creditEntries.find(c => c.accountId.toString() === account._id.toString())?.amount || 0;
                                    
                                    return (
                                        <TableRow key={entry._id.toString()}>
                                            <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                                            <TableCell>Voucher Book Name</TableCell>
                                            <TableCell className="font-mono text-xs">{entry.voucherNumber}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{entry.note}</TableCell>
                                            <TableCell className="text-right font-mono">{debitAmount > 0 ? debitAmount.toFixed(2) : '-'}</TableCell>
                                            <TableCell className="text-right font-mono">{creditAmount > 0 ? creditAmount.toFixed(2) : '-'}</TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
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
