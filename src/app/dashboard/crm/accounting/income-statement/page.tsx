
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ChevronDown, Building, AlertCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState, useEffect, useTransition, Fragment } from 'react';
import { generateIncomeStatementData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { getSession } from "@/app/actions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Link from 'next/link';

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
    <TableRow className={level === 0 ? 'font-bold bg-muted/50' : ''}>
        <TableCell style={{ paddingLeft: `${1 + level * 1.5}rem` }}>{label}</TableCell>
        <TableCell className="text-right font-mono">
            {value !== undefined ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value) : ''}
        </TableCell>
    </TableRow>
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
    const { toast } = useToast();

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
    
    const { incomeData, expenseData, netSurplus } = data;
    const businessProfile = user.businessProfile;

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center rounded-full text-3xl font-bold">
                        {businessProfile?.name?.charAt(0) || 'B'}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{businessProfile.name}</h1>
                        <p className="text-sm text-muted-foreground">GSTIN: {businessProfile.gstin}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Select defaultValue="fy2526">
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fy2526">FY 2025-2026</SelectItem>
                            <SelectItem value="fy2425">FY 2024-2025</SelectItem>
                        </SelectContent>
                    </Select>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4"/>
                                Download As
                                <ChevronDown className="ml-2 h-4 w-4"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</DropdownMenuItem>
                            <DropdownMenuItem disabled>XLS</DropdownMenuItem>
                            <DropdownMenuItem disabled>PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>
            
            <Card>
                <CardHeader>
                    <CardTitle>Income Statement</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Account</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <Section title="Income" data={incomeData} />
                                <Section title="Expense" data={expenseData} />
                                <TableRow className="bg-primary/10 font-bold">
                                    <TableCell>Net Surplus</TableCell>
                                    <TableCell className="text-right font-mono">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(netSurplus)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 <CardFooter>
                    <p className="text-xs text-muted-foreground">* Reports are in your business currency INR</p>
                </CardFooter>
            </Card>
        </div>
    )
}
