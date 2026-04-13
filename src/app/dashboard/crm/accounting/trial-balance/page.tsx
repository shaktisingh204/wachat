'use client';

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, SlidersHorizontal, ChevronDown, AlertCircle, Scale } from 'lucide-react';
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Label } from '@/components/ui/label';
import { useState, useEffect, useTransition, useCallback } from "react";
import { generateTrialBalanceData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { getSession } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

type TrialBalanceEntry = {
    accountId: string;
    accountName: string;
    openingBalance: number;
    openingBalanceType: 'Cr' | 'Dr';
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    closingBalanceType: 'Cr' | 'Dr';
};

function TrialBalanceClient({ data, totals, user }: { data: TrialBalanceEntry[], totals: any, user: any }) {
    const [hideZero, setHideZero] = useState(false);
    const filteredData = hideZero ? data.filter(d => d.totalDebit > 0 || d.totalCredit > 0) : data;
    const { toast } = useToast();

    const businessProfile = user?.businessProfile;

    const handleDownload = (format: 'csv' | 'xls' | 'pdf') => {
        const dataToExport = filteredData.map(entry => ({
            "Account": entry.accountName,
            "Opening Balance": `${Math.abs(entry.openingBalance).toFixed(2)} ${entry.openingBalanceType}`,
            "Debit": entry.totalDebit.toFixed(2),
            "Credit": entry.totalCredit.toFixed(2),
            "Closing Balance": `${Math.abs(entry.closingBalance).toFixed(2)} ${entry.closingBalanceType}`
        }));

        if (format === 'csv') {
            const csv = Papa.unparse(dataToExport);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'trial-balance.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            toast({ title: "Not Implemented", description: `Export to ${format.toUpperCase()} is not yet available.`});
        }
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <ClayCard>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-clay-rose-soft text-clay-rose-ink flex items-center justify-center text-2xl font-semibold">
                            {businessProfile?.name?.charAt(0) || 'B'}
                        </div>
                        <div>
                            <h2 className="text-[16px] font-semibold text-clay-ink">{businessProfile?.name || 'Your Business'}</h2>
                            <p className="text-[12.5px] text-clay-ink-muted">{businessProfile?.address || 'Your Address'}</p>
                            <p className="text-[12.5px] text-clay-ink-muted">GSTIN: {businessProfile?.gstin || 'N/A'}</p>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} trailing={<ChevronDown className="h-4 w-4" strokeWidth={1.75} />}>
                                Download As
                            </ClayButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</DropdownMenuItem>
                            <DropdownMenuItem disabled>XLS</DropdownMenuItem>
                            <DropdownMenuItem disabled>PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </ClayCard>

            <ClayCard>
                <h2 className="text-[16px] font-semibold text-clay-ink">Trial Balance</h2>
                <div className="mt-4 overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Account</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Opening Balance</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Debit</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Credit</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Closing Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length > 0 ? (
                                filteredData.map(entry => (
                                    <TableRow key={entry.accountId} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{entry.accountName}</TableCell>
                                        <TableCell className="text-right font-mono text-clay-ink">{Math.abs(entry.openingBalance).toFixed(2)} {entry.openingBalanceType}</TableCell>
                                        <TableCell className="text-right font-mono text-clay-ink">{entry.totalDebit.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-clay-ink">{entry.totalCredit.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-clay-ink">{Math.abs(entry.closingBalance).toFixed(2)} {entry.closingBalanceType}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={5} className="h-24 text-center text-clay-ink-muted">No Data</TableCell>
                                </TableRow>
                            )}
                            <TableRow className="border-clay-border bg-clay-surface-2 font-semibold">
                                <TableCell className="text-clay-ink">Total</TableCell>
                                <TableCell className="text-right font-mono text-clay-ink">{Math.abs(totals.totalOpening).toFixed(2)} {totals.totalOpening >= 0 ? 'Dr' : 'Cr'}</TableCell>
                                <TableCell className="text-right font-mono text-clay-ink">{totals.totalDebit.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono text-clay-ink">{totals.totalCredit.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono text-clay-ink">{Math.abs(totals.totalClosing).toFixed(2)} {totals.totalClosing >= 0 ? 'Dr' : 'Cr'}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-end mt-4">
                    <div className="flex items-center space-x-2">
                        <Switch id="hide-zero" checked={hideZero} onCheckedChange={setHideZero} />
                        <Label htmlFor="hide-zero" className="text-[13px] text-clay-ink">Hide Zero-Entry Accounts</Label>
                    </div>
                </div>
            </ClayCard>
        </div>
    )
}

export default function TrialBalancePage() {
    const [data, setData] = useState<{data: TrialBalanceEntry[], totals: any} | null>(null);
    const [user, setUser] = useState<any>(null);
    const [isLoading, startTransition] = useTransition();

    const defaultStartDate = new Date(new Date().getFullYear(), 3, 1);
    const defaultEndDate = new Date(new Date().getFullYear() + 1, 2, 31);
    const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate);
    const [endDate, setEndDate] = useState<Date | undefined>(defaultEndDate);

    const fetchData = useCallback(() => {
         startTransition(async () => {
            const [dataResult, session] = await Promise.all([
                generateTrialBalanceData(startDate, endDate),
                getSession()
            ]);
            setData(dataResult);
            setUser(session?.user);
        });
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleClearFilters = () => {
        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
    }

    useEffect(() => {
        if (startDate === defaultStartDate && endDate === defaultEndDate) {
            fetchData();
        }
    }, [startDate, endDate, defaultStartDate, defaultEndDate, fetchData]);

    if (isLoading || !data || !user) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-clay-ink-muted" />
            </div>
        );
    }

    if (!user.businessProfile?.name || !user.businessProfile.address) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Business Profile Incomplete</AlertTitle>
                <AlertDescription>
                    Please complete your business profile in the user settings to view accounting reports.
                    <Button asChild variant="link" className="p-0 h-auto ml-2"><Link href="/dashboard/user/settings/profile">Go to Settings</Link></Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Trial Balance"
                subtitle="Review debits and credits across all accounts."
                icon={Scale}
                actions={
                    <Popover>
                        <PopoverTrigger asChild>
                            <ClayButton variant="pill" leading={<SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />}>
                                Filters
                            </ClayButton>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 space-y-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <DatePicker date={startDate} setDate={setStartDate} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <DatePicker date={endDate} setDate={setEndDate} />
                            </div>
                            <div className="flex justify-end gap-2">
                                <ClayButton variant="ghost" onClick={handleClearFilters}>Clear</ClayButton>
                                <ClayButton variant="obsidian" onClick={fetchData} disabled={isLoading}>
                                    {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                                    Apply
                                </ClayButton>
                            </div>
                        </PopoverContent>
                    </Popover>
                }
            />
            <TrialBalanceClient data={data.data} totals={data.totals} user={user} />
        </div>
    );
}
