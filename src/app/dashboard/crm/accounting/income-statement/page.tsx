'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Download, ChevronDown, AlertCircle, TrendingUp } from 'lucide-react';

import { useState, useEffect, useTransition, Fragment } from 'react';
import { generateIncomeStatementData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";

import Papa from "papaparse";
import { getSession } from "@/app/actions";

import Link from 'next/link';

import { CrmPageHeader } from '../../_components/crm-page-header';

type AccountData = {
    accountName: string;
    balance: number;
}

type GroupData = {
    groupName: string;
    category: string;
    accounts: AccountData[];
    total: number;
}

const DataRow = ({ label, value, level = 0 }: { label: string; value?: number; level?: number }) => (
    <ZoruTableRow className={`border-border ${level === 0 ? 'font-semibold bg-secondary' : ''}`}>
        <ZoruTableCell className="text-foreground" style={{ paddingLeft: `${1 + level * 1.5}rem` }}>{label}</ZoruTableCell>
        <ZoruTableCell className="text-right font-mono text-foreground">
            {value !== undefined ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value) : ''}
        </ZoruTableCell>
    </ZoruTableRow>
);

const Section = ({ title, data }: { title: string, data: GroupData[] }) => {
    const total = data.reduce((sum, group) => sum + group.total, 0);
    const mainGroups = [...new Set(data.map(g => g.category.replace(/_/g, ' ')))];

    return (
        <>
            <DataRow label={title} />
            {mainGroups.map(mainGroup => {
                const subGroups = data.filter(g => g.category.replace(/_/g, ' ') === mainGroup);
                const subGroupTotal = subGroups.reduce((sum, g) => sum + g.total, 0);

                return (
                    <Fragment key={mainGroup}>
                        <DataRow label={mainGroup} level={1} value={-subGroupTotal} />
                        {subGroups.map(group => (
                            <Fragment key={group.groupName}>
                                {group.accounts.map(acc => (
                                    <DataRow key={acc.accountName} label={acc.accountName} value={-acc.balance} level={2} />
                                ))}
                            </Fragment>
                        ))}
                    </Fragment>
                )
            })}
            <DataRow label={`Total for ${title}`} value={-total} />
        </>
    );
}

export default function IncomeStatementPage() {
    const [data, setData] = useState<{ incomeData: GroupData[], expenseData: GroupData[], netSurplus: number } | null>(null);
    const [user, setUser] = useState<any>(null);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

    useEffect(() => {
        startTransition(async () => {
            const [dataResult, session] = await Promise.all([
                generateIncomeStatementData(),
                getSession()
            ]);
            setData(dataResult);
            setUser(session?.user);
        });
    }, []);

    const handleDownload = (format: 'csv' | 'xls' | 'pdf') => {
        if (!data) return;
        if (format === 'csv') {
            let csvData: any[] = [];
            const addSectionToCsv = (title: string, sectionData: GroupData[]) => {
                csvData.push({ Account: title, Balance: '' });
                const total = sectionData.reduce((sum, group) => sum + group.total, 0);
                 sectionData.forEach(group => {
                     csvData.push({ Account: `  ${group.groupName}`, Balance: '' });
                     group.accounts.forEach(acc => {
                         csvData.push({ Account: `    ${acc.accountName}`, Balance: (-acc.balance).toFixed(2) });
                     });
                     csvData.push({ Account: `  Total for ${group.groupName}`, Balance: (-group.total).toFixed(2) });
                });
                csvData.push({ Account: `Total for ${title}`, Balance: (-total).toFixed(2) });
            };

            addSectionToCsv("Income", data.incomeData);
            addSectionToCsv("Expense", data.expenseData);
            csvData.push({ Account: 'Net Surplus', Balance: data.netSurplus.toFixed(2) });

            const csv = Papa.unparse(csvData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'income-statement.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
             toast({ title: "Not Implemented", description: `Export to ${format.toUpperCase()} is not yet available.`});
        }
    };

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

    const { incomeData, expenseData, netSurplus } = data;
    const businessProfile = user.businessProfile;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Income Statement"
                subtitle="Profitability snapshot from income & expense accounts."
                icon={TrendingUp}
                actions={
                    <div className="flex items-center gap-2">
                        {/* TODO §1E: fiscal year picker — static year list, no matching enum; needs fiscalYearRange enum or date-range input */}
                        <ZoruSelect defaultValue="fy2526">
                            <ZoruSelectTrigger className="w-[180px]"><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="fy2526">FY 2025-2026</ZoruSelectItem>
                                <ZoruSelectItem value="fy2425">FY 2024-2025</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
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
                }
            />

            <ZoruCard>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-semibold">
                        {businessProfile?.name?.charAt(0) || 'B'}
                    </div>
                    <div>
                        <h2 className="text-[16px] font-semibold text-foreground">{businessProfile.name}</h2>
                        <p className="text-[12.5px] text-muted-foreground">GSTIN: {businessProfile.gstin}</p>
                    </div>
                </div>
            </ZoruCard>

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Income Statement</h2>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Account</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Balance</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            <Section title="Income" data={incomeData} />
                            <Section title="Expense" data={expenseData} />
                            <ZoruTableRow className="border-border bg-accent font-semibold">
                                <ZoruTableCell className="text-accent-foreground">Net Surplus</ZoruTableCell>
                                <ZoruTableCell className="text-right font-mono text-accent-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(netSurplus)}</ZoruTableCell>
                            </ZoruTableRow>
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
                <p className="mt-4 text-[11.5px] text-muted-foreground">* Reports are in your business currency INR</p>
            </ZoruCard>
        </div>
    )
}
