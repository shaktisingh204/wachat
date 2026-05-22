'use client';

import {
  Button,
  Card,
  DatePicker,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Label,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Download, ChevronDown, SlidersHorizontal } from "lucide-react";

import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateProfitAndLossData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";
import { format } from "date-fns";
import Papa from 'papaparse';

import { EntityListShell } from '@/components/crm/entity-list-shell';

const StatCard = ({ title, value, percentage, isProfit }: { title: string; value: string; percentage?: string, isProfit?: boolean }) => (
    <div className="bg-secondary border border-border p-4 rounded-lg text-center">
        <p className="text-[12.5px] text-muted-foreground">{title}</p>
        <p className={`mt-1 text-[22px] font-semibold ${isProfit ? (parseFloat(value.replace(/[^0-9.-]+/g,"")) >= 0 ? 'text-emerald-500' : 'text-destructive') : 'text-foreground'}`}>{value}</p>
        {percentage && <p className="text-[11.5px] text-muted-foreground">{percentage}</p>}
    </div>
);

const PnlClient = ({ data, startDate, endDate }: { data: any, startDate?: Date, endDate?: Date }) => {
    const { summary, entries } = data;
    const { toast } = useZoruToast();

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
            <ZoruCard>
                <div className="flex justify-between items-center">
                    <h2 className="text-[16px] font-semibold text-foreground">Summary</h2>
                    <p className="text-[12.5px] text-muted-foreground">
                        For period: {startDate ? format(startDate, 'dd MMM, yyyy') : '...'} - {endDate ? format(endDate, 'dd MMM, yyyy') : '...'}
                    </p>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Income" value={`₹${summary.totalIncome.toFixed(2)}`} />
                    <StatCard title="Cost Of Goods Sold" value={`₹${summary.totalCogs.toFixed(2)}`} />
                    <StatCard title="Expense" value={`₹${summary.totalExpense.toFixed(2)}`} percentage={`${summary.totalIncome > 0 ? ((summary.totalExpense / summary.totalIncome) * 100).toFixed(0) : 0}% of Income`} />
                    <StatCard title="Net Profit" value={`₹${summary.netProfit.toFixed(2)}`} percentage={`${summary.totalIncome > 0 ? ((summary.netProfit / summary.totalIncome) * 100).toFixed(0) : 0}% of Income`} isProfit={true}/>
                </div>
            </ZoruCard>

            <ZoruCard>
                <div className="flex justify-end mb-4">
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
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Accounts</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Amount</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">% of Total</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {entries.map((entry: any, index: number) => (
                                <ZoruTableRow key={index} className={`border-border ${entry.isMain ? 'bg-secondary font-semibold' : ''}`}>
                                    <ZoruTableCell className="text-foreground">{index + 1}. {entry.account}</ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-foreground">₹{entry.amount.toFixed(2)}</ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-foreground">{summary.totalIncome > 0 ? ((entry.amount / summary.totalIncome) * 100).toFixed(2) : '0.00'}%</ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
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
            <div className="text-center py-10 text-[13px] text-muted-foreground">
                <p>Could not generate Profit & Loss data. Please ensure you have income/expense accounts and transactions.</p>
            </div>
        )
    }

    return (
        <EntityListShell
            title="Profit & Loss"
            subtitle="An overview of your business's profitability."
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
                        <div className="flex justify-end">
                            <ZoruButton onClick={fetchData} disabled={isLoading}>
                                {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                                Apply
                            </ZoruButton>
                        </div>
                    </ZoruPopoverContent>
                </ZoruPopover>
            }
        >
            <PnlClient data={data} startDate={startDate} endDate={endDate} />
        </EntityListShell>
    );
}
