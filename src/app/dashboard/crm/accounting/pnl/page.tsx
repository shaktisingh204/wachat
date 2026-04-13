'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, ChevronDown, SlidersHorizontal, TrendingUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateProfitAndLossData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";
import { format } from "date-fns";
import Papa from 'papaparse';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';


const StatCard = ({ title, value, percentage, isProfit }: { title: string; value: string; percentage?: string, isProfit?: boolean }) => (
    <div className="bg-clay-surface-2 border border-clay-border p-4 rounded-clay-md text-center">
        <p className="text-[12.5px] text-clay-ink-muted">{title}</p>
        <p className={`mt-1 text-[22px] font-semibold ${isProfit ? (parseFloat(value.replace(/[^0-9.-]+/g,"")) >= 0 ? 'text-clay-green' : 'text-clay-red') : 'text-clay-ink'}`}>{value}</p>
        {percentage && <p className="text-[11.5px] text-clay-ink-muted">{percentage}</p>}
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
        <div className="flex w-full flex-col gap-6">
            <ClayCard>
                <div className="flex justify-between items-center">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Summary</h2>
                    <p className="text-[12.5px] text-clay-ink-muted">
                        For period: {startDate ? format(startDate, 'dd MMM, yyyy') : '...'} - {endDate ? format(endDate, 'dd MMM, yyyy') : '...'}
                    </p>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Income" value={`₹${summary.totalIncome.toFixed(2)}`} />
                    <StatCard title="Cost Of Goods Sold" value={`₹${summary.totalCogs.toFixed(2)}`} />
                    <StatCard title="Expense" value={`₹${summary.totalExpense.toFixed(2)}`} percentage={`${summary.totalIncome > 0 ? ((summary.totalExpense / summary.totalIncome) * 100).toFixed(0) : 0}% of Income`} />
                    <StatCard title="Net Profit" value={`₹${summary.netProfit.toFixed(2)}`} percentage={`${summary.totalIncome > 0 ? ((summary.netProfit / summary.totalIncome) * 100).toFixed(0) : 0}% of Income`} isProfit={true}/>
                </div>
            </ClayCard>

            <ClayCard>
                <div className="flex justify-end mb-4">
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
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Accounts</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Amount</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">% of Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((entry: any, index: number) => (
                                <TableRow key={index} className={`border-clay-border ${entry.isMain ? 'bg-clay-surface-2 font-semibold' : ''}`}>
                                    <TableCell className="text-clay-ink">{index + 1}. {entry.account}</TableCell>
                                    <TableCell className="text-right font-mono text-clay-ink">₹{entry.amount.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono text-clay-ink">{summary.totalIncome > 0 ? ((entry.amount / summary.totalIncome) * 100).toFixed(2) : '0.00'}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
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
                <LoaderCircle className="h-8 w-8 animate-spin text-clay-ink-muted" />
            </div>
        );
    }

    if (!data.summary) {
        return (
            <div className="text-center py-10 text-[13px] text-clay-ink-muted">
                <p>Could not generate Profit & Loss data. Please ensure you have income/expense accounts and transactions.</p>
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Profit & Loss"
                subtitle="An overview of your business's profitability."
                icon={TrendingUp}
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
                            <div className="flex justify-end">
                                <ClayButton variant="obsidian" onClick={fetchData} disabled={isLoading}>
                                    {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                                    Apply
                                </ClayButton>
                            </div>
                        </PopoverContent>
                    </Popover>
                }
            />
            <PnlClient data={data} startDate={startDate} endDate={endDate} />
        </div>
    );
}
