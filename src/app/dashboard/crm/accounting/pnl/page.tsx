'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateProfitAndLossData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";
import { format } from "date-fns";
import Papa from 'papaparse';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";


const StatCard = ({ title, value, percentage, isProfit }: { title: string; value: string; percentage?: string, isProfit?: boolean }) => (
    <div className="bg-muted/50 p-4 rounded-lg text-center">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={`text-2xl font-bold ${isProfit ? (parseFloat(value.replace(/[^0-9.-]+/g,"")) >= 0 ? 'text-primary' : 'text-destructive') : ''}`}>{value}</p>
        {percentage && <p className="text-xs text-muted-foreground">{percentage}</p>}
    </div>
);

const PnlClient = ({ data, startDate, endDate }: { data: any, startDate?: Date, endDate?: Date }) => {
    const { summary, entries } = data;
    const { toast } = useToast();
    
    const handleDownload = (format: 'csv' | 'xls' | 'pdf') => {
        if (format === 'csv') {
            const csvData = entries.map((entry: any) => ({
                "Account": entry.account,
                "Amount": entry.amount.toFixed(2),
                "% of Total": summary.totalIncome > 0 ? ((entry.amount / summary.totalIncome) * 100).toFixed(2) : '0.00'
            }));
            const csv = Papa.unparse(csvData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'profit-and-loss.csv');
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
                    <h1 className="text-3xl font-bold font-headline">Profit & Loss</h1>
                    <p className="text-muted-foreground">An overview of your business's profitability.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Summary</CardTitle>
                         <p className="text-sm text-muted-foreground">
                            For period: {startDate ? format(startDate, 'dd MMM, yyyy') : '...'} - {endDate ? format(endDate, 'dd MMM, yyyy') : '...'}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Income" value={`₹${summary.totalIncome.toFixed(2)}`} />
                    <StatCard title="Cost Of Goods Sold" value={`₹${summary.totalCogs.toFixed(2)}`} />
                    <StatCard title="Expense" value={`₹${summary.totalExpense.toFixed(2)}`} percentage={`${summary.totalIncome > 0 ? ((summary.totalExpense / summary.totalIncome) * 100).toFixed(0) : 0}% of Income`} />
                    <StatCard title="Net Profit" value={`₹${summary.netProfit.toFixed(2)}`} percentage={`${summary.totalIncome > 0 ? ((summary.netProfit / summary.totalIncome) * 100).toFixed(0) : 0}% of Income`} isProfit={true}/>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                     <div className="flex justify-end">
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
                 </CardHeader>
                 <CardContent>
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
                                        <TableCell>{index + 1}. {entry.account}</TableCell>
                                        <TableCell className="text-right font-mono">₹{entry.amount.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono">{summary.totalIncome > 0 ? ((entry.amount / summary.totalIncome) * 100).toFixed(2) : '0.00'}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function PnlPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, startTransition] = useTransition();
    const [startDate, setStartDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), 0, 1));
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateProfitAndLossData(startDate, endDate);
            setData(result);
        });
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
                 <p>Could not generate Profit & Loss data. Please ensure you have income/expense accounts and transactions.</p>
            </div>
        )
    }

    return (
        <>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" /> Filters</Button>
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
                    <div className="flex justify-end">
                        <Button onClick={fetchData} disabled={isLoading}>
                            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                            Apply
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
            <div className="mt-6">
                <PnlClient data={data} startDate={startDate} endDate={endDate} />
            </div>
        </>
    );
}
