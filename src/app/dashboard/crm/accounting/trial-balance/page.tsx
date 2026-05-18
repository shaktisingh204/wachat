'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruButton,
  ZoruCard,
  ZoruDatePicker,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruLabel,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruSwitch,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Download, SlidersHorizontal, ChevronDown, AlertCircle } from 'lucide-react';

import { useState, useEffect, useTransition, useCallback } from "react";
import { generateTrialBalanceData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";

import Papa from "papaparse";
import { getSession } from "@/app/actions";

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

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
    const { toast } = useZoruToast();

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
            <ZoruCard>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-2xl font-semibold">
                            {businessProfile?.name?.charAt(0) || 'B'}
                        </div>
                        <div>
                            <h2 className="text-[16px] font-semibold text-foreground">{businessProfile?.name || 'Your Business'}</h2>
                            <p className="text-[12.5px] text-muted-foreground">{businessProfile?.address || 'Your Address'}</p>
                            <p className="text-[12.5px] text-muted-foreground">GSTIN: {businessProfile?.gstin || 'N/A'}</p>
                        </div>
                    </div>
                    <ZoruDropdownMenu>
                        <ZoruDropdownMenuTrigger asChild>
                            <ZoruButton variant="outline">
                                Download As
                            </ZoruButton>
                        </ZoruDropdownMenuTrigger>
                        <ZoruDropdownMenuContent>
                            <ZoruDropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem disabled>XLS</ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem disabled>PDF</ZoruDropdownMenuItem>
                        </ZoruDropdownMenuContent>
                    </ZoruDropdownMenu>
                </div>
            </ZoruCard>

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Trial Balance</h2>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Account</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Opening Balance</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Debit</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Credit</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Closing Balance</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {filteredData.length > 0 ? (
                                filteredData.map(entry => (
                                    <ZoruTableRow key={entry.accountId} className="border-border">
                                        <ZoruTableCell className="font-medium text-foreground">{entry.accountName}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground">{Math.abs(entry.openingBalance).toFixed(2)} {entry.openingBalanceType}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground">{entry.totalDebit.toFixed(2)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground">{entry.totalCredit.toFixed(2)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground">{Math.abs(entry.closingBalance).toFixed(2)} {entry.closingBalanceType}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-muted-foreground">No Data</ZoruTableCell>
                                </ZoruTableRow>
                            )}
                            <ZoruTableRow className="border-border bg-secondary font-semibold">
                                <ZoruTableCell className="text-foreground">Total</ZoruTableCell>
                                <ZoruTableCell className="text-right font-mono text-foreground">{Math.abs(totals.totalOpening).toFixed(2)} {totals.totalOpening >= 0 ? 'Dr' : 'Cr'}</ZoruTableCell>
                                <ZoruTableCell className="text-right font-mono text-foreground">{totals.totalDebit.toFixed(2)}</ZoruTableCell>
                                <ZoruTableCell className="text-right font-mono text-foreground">{totals.totalCredit.toFixed(2)}</ZoruTableCell>
                                <ZoruTableCell className="text-right font-mono text-foreground">{Math.abs(totals.totalClosing).toFixed(2)} {totals.totalClosing >= 0 ? 'Dr' : 'Cr'}</ZoruTableCell>
                            </ZoruTableRow>
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
                <div className="flex items-center justify-end mt-4">
                    <div className="flex items-center space-x-2">
                        <ZoruSwitch id="hide-zero" checked={hideZero} onCheckedChange={setHideZero} />
                        <ZoruLabel htmlFor="hide-zero" className="text-[13px] text-foreground">Hide Zero-Entry Accounts</ZoruLabel>
                    </div>
                </div>
            </ZoruCard>
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
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!user.businessProfile?.name || !user.businessProfile.address) {
        return (
            <ZoruAlert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Business Profile Incomplete</ZoruAlertTitle>
                <ZoruAlertDescription>
                    Please complete your business profile in the user settings to view accounting reports.
                    <ZoruButton asChild variant="link" className="p-0 h-auto ml-2"><Link href="/dashboard/user/settings/profile">Go to Settings</Link></ZoruButton>
                </ZoruAlertDescription>
            </ZoruAlert>
        );
    }

    return (
        <EntityListShell
            title="Trial Balance"
            subtitle="Review debits and credits across all accounts."
            primaryAction={
                <ZoruPopover>
                    <ZoruPopoverTrigger asChild>
                        <ZoruButton variant="outline">
                            Filters
                        </ZoruButton>
                    </ZoruPopoverTrigger>
                    <ZoruPopoverContent className="w-96 space-y-4">
                        <div className="space-y-2">
                            <ZoruLabel>Start Date</ZoruLabel>
                            <ZoruDatePicker value={startDate} onChange={setStartDate} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>End Date</ZoruLabel>
                            <ZoruDatePicker value={endDate} onChange={setEndDate} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <ZoruButton variant="ghost" onClick={handleClearFilters}>Clear</ZoruButton>
                            <ZoruButton onClick={fetchData} disabled={isLoading}>
                                {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                                Apply
                            </ZoruButton>
                        </div>
                    </ZoruPopoverContent>
                </ZoruPopover>
            }
        >
            <TrialBalanceClient data={data.data} totals={data.totals} user={user} />
        </EntityListShell>
    );
}
