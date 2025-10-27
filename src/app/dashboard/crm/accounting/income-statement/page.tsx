
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState, useEffect, useTransition } from 'react';
import { generateIncomeStatementData } from "@/app/actions/crm-accounting.actions";
import { getSession } from "@/app/actions";
import { LoaderCircle } from "lucide-react";

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

const yourBusinessDetails = {
    name: 'WAPLIA DIGITAL SOLUTIONS',
    address: 'D-829, Malviya Nagar, Jaipur, Rajasthan, India - 302017',
    gstin: '08FNSPK2133N1ZE',
};

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
                    <React.Fragment key={mainGroup}>
                        <DataRow label={mainGroup} level={1} />
                        {subGroups.map(group => (
                            <React.Fragment key={group.groupName}>
                                <DataRow label={group.groupName} level={2} />
                                {group.accounts.map(acc => (
                                    <DataRow key={acc.accountName} label={acc.accountName} value={-acc.balance} level={3} />
                                ))}
                                <DataRow label={`Total for ${group.groupName}`} value={-group.total} level={2} />
                            </React.Fragment>
                        ))}
                        <DataRow label={`Total for ${mainGroup}`} value={-subGroupTotal} level={1} />
                    </React.Fragment>
                )
            })}
            <DataRow label={`Total for ${title}`} value={-total} />
        </>
    );
}

export default function IncomeStatementPage() {
    const [data, setData] = useState<{ incomeData: GroupData[], expenseData: GroupData[], netSurplus: number } | null>(null);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const result = await generateIncomeStatementData();
            setData(result);
        });
    }, []);

    if (isLoading || !data) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    const { incomeData, expenseData, netSurplus } = data;

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center rounded-full text-3xl font-bold">
                        W
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{yourBusinessDetails.name}</h1>
                        <p className="text-sm text-muted-foreground">GSTIN: {yourBusinessDetails.gstin}</p>
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
                            <DropdownMenuItem>PDF</DropdownMenuItem>
                            <DropdownMenuItem>XLS</DropdownMenuItem>
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
