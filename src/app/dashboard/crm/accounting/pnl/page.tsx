
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState, useEffect, useTransition } from 'react';
import { generateProfitAndLossData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";
import { format } from "date-fns";

const StatCard = ({ title, value, percentage, isProfit }: { title: string; value: string; percentage?: string, isProfit?: boolean }) => (
    <div className="bg-muted/50 p-4 rounded-lg text-center">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={`text-2xl font-bold ${isProfit ? (parseFloat(value) >= 0 ? 'text-primary' : 'text-destructive') : ''}`}>{value}</p>
        {percentage && <p className="text-xs text-muted-foreground">{percentage}</p>}
    </div>
);

const PnlClient = ({ data }: { data: any }) => {
    const { summary, entries } = data;
    
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Profit & Loss</h1>
                    <p className="text-muted-foreground">An overview of your business's profitability.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">Add a comparison period</Button>
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
                            <DropdownMenuItem>CSV</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Summary</CardTitle>
                         <p className="text-sm text-muted-foreground">For period: {format(new Date(), 'dd MMM, yyyy')} - {format(new Date(), 'dd MMM, yyyy')}</p>
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
                                        <TableCell>{index + 1}. {entry.account}</TableCell>
                                        <TableCell className="text-right font-mono">₹{entry.amount.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono">{summary.totalIncome > 0 ? ((entry.amount / summary.totalIncome) * 100).toFixed(2) : '0.00'}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between text-sm text-muted-foreground">
                    <p>Showing 1 to 5 of 5 Clients</p>
                </CardFooter>
            </Card>
        </div>
    )
}

export default function PnlPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const result = await generateProfitAndLossData();
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
                 <p>Could not generate Profit & Loss data. Please ensure you have income/expense accounts and transactions.</p>
            </div>
        )
    }

    return <PnlClient data={data} />;
}
