'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ChevronDown, View } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { generateBalanceSheetData } from "@/app/actions/crm-accounting.actions";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useTransition } from "react";
import Papa from "papaparse";
import { LoaderCircle } from "lucide-react";

const StatCard = ({ title, value }: { title: string; value: string }) => (
    <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
    </div>
);

const BalanceSheetClient = ({ data }: { data: any }) => {
    const { toast } = useToast();
    const { summary, entries } = data;

    const totalAll = Math.abs(summary.totalAssets) + Math.abs(summary.totalLiabilities) + Math.abs(summary.totalCapital);

    const handleDownload = (format: 'csv' | 'xls' | 'pdf') => {
        if (format === 'csv') {
            const csvData = entries.map((entry: any) => ({
                "Accounts": entry.isSub ? `  ${entry.account}` : entry.account,
                "Amount": entry.amount.toFixed(2),
                "% of Total": totalAll > 0 ? ((Math.abs(entry.amount) / totalAll) * 100).toFixed(2) : '0.00'
            }));
            const csv = Papa.unparse(csvData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'balance-sheet.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            toast({ title: "Not Implemented", description: `Export to ${format.toUpperCase()} is not yet available.`});
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Balance Sheet</h1>
                    <p className="text-muted-foreground">A snapshot of your company's financial health.</p>
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
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Summary</CardTitle>
                    <CardDescription>Figures are in INR (₹)</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Total Assets" value={`₹${summary.totalAssets.toFixed(2)}`} />
                    <StatCard title="Total Liabilities" value={`₹${summary.totalLiabilities.toFixed(2)}`} />
                    <StatCard title="Total Capital" value={`₹${summary.totalCapital.toFixed(2)}`} />
                    <StatCard title="Debt to Equity Ratio" value={`${summary.debtToEquity.toFixed(2)}%`} />
                </CardContent>
            </Card>

            <Card>
                 <CardContent className="pt-6">
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Accounts</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">% of Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map((entry: any, index: number) => (
                                    <TableRow key={index} className={entry.isMain ? 'bg-muted/50 font-semibold' : ''}>
                                        <TableCell className={entry.isSub ? 'pl-8' : ''}>{entry.account}</TableCell>
                                        <TableCell className="text-right font-mono">₹{entry.amount.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono">{totalAll > 0 ? ((Math.abs(entry.amount) / totalAll) * 100).toFixed(2) : '0.00'}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
                        <p>Showing 1 to {entries.length} of {entries.length} entries</p>
                        <p>* Reports are in your business currency INR</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function BalanceSheetPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const result = await generateBalanceSheetData();
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
    
    if (!data.summary) {
         return (
            <div className="text-center py-10">
                <p>Could not generate balance sheet data. Please ensure you have accounts and transactions.</p>
            </div>
        );
    }
    
    return <BalanceSheetClient data={data} />;
}
