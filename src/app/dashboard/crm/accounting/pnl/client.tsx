'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { format, isValid, parseISO } from 'date-fns';
import Papa from 'papaparse';
import { Download, ChevronDown, SlidersHorizontal, LoaderCircle } from "lucide-react";

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
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { generateProfitAndLossData } from "@/app/actions/crm-accounting.actions";

const StatCard = ({ title, value, percentage, isProfit }: { title: string; value: string; percentage?: string, isProfit?: boolean }) => (
    <div className="bg-secondary border border-border p-4 rounded-lg text-center">
        <p className="text-[12.5px] text-muted-foreground">{title}</p>
        <p className={`mt-1 text-[22px] font-semibold ${isProfit ? (parseFloat(value.replace(/[^0-9.-]+/g,"")) >= 0 ? 'text-emerald-500' : 'text-destructive') : 'text-foreground'}`}>{value}</p>
        {percentage && <p className="text-[11.5px] text-muted-foreground">{percentage}</p>}
    </div>
);

interface PnlClientProps {
    initialData: any;
    initialStartDate?: Date;
    initialEndDate?: Date;
}

export function PnlClient({ initialData, initialStartDate, initialEndDate }: PnlClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate);
    const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate);

    // Keep local state in sync with URL
    useEffect(() => {
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
    }, [initialStartDate, initialEndDate]);

    const handleApplyFilters = () => {
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (startDate) {
                params.set('from', format(startDate, 'yyyy-MM-dd'));
            } else {
                params.delete('from');
            }
            
            if (endDate) {
                params.set('to', format(endDate, 'yyyy-MM-dd'));
            } else {
                params.delete('to');
            }
            
            router.push(`${pathname}?${params.toString()}`);
        });
    };

    const handleDownload = (formatType: 'csv' | 'xls' | 'pdf') => {
        if (!initialData || !initialData.summary) {
            toast({ title: "Error", description: "No data to download.", variant: "destructive" });
            return;
        }

        if (formatType === 'csv') {
            const { summary, entries } = initialData;
            const csvData = entries.map((entry: any) => ({
                "Account": entry.account,
                "Amount": entry.amount.toFixed(2),
                "% of Total": summary.totalIncome > 0 ? ((entry.amount / summary.totalIncome) * 100).toFixed(2) : '0.00'
            }));
            const csv = Papa.unparse(csvData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `profit-and-loss-${format(new Date(), 'yyyy-MM-dd')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            toast({ title: "Not Implemented", description: `Export to ${formatType.toUpperCase()} is not yet available.`});
        }
    };

    if (!initialData || !initialData.summary) {
        return (
            <EntityListShell
                title="Profit & Loss"
                subtitle="An overview of your business's profitability."
                primaryAction={
                    <Popover>
                        <ZoruPopoverTrigger asChild>
                            <Button variant="outline">
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                Filters
                            </Button>
                        </ZoruPopoverTrigger>
                        <ZoruPopoverContent className="w-80 space-y-4" align="end">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <DatePicker value={startDate} onChange={setStartDate} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <DatePicker value={endDate} onChange={setEndDate} />
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button onClick={handleApplyFilters} disabled={isPending}>
                                    {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                                    Apply Filters
                                </Button>
                            </div>
                        </ZoruPopoverContent>
                    </Popover>
                }
            >
                <div className="text-center py-12 text-[13px] text-muted-foreground bg-card border rounded-lg shadow-sm">
                    <p>Could not generate Profit & Loss data. Please ensure you have income/expense accounts and transactions.</p>
                </div>
            </EntityListShell>
        );
    }

    const { summary, entries } = initialData;

    return (
        <EntityListShell
            title="Profit & Loss"
            subtitle="An overview of your business's profitability."
            primaryAction={
                <Popover>
                    <ZoruPopoverTrigger asChild>
                        <Button variant="outline">
                            <SlidersHorizontal className="mr-2 h-4 w-4" />
                            Filters
                        </Button>
                    </ZoruPopoverTrigger>
                    <ZoruPopoverContent className="w-80 space-y-4" align="end">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <DatePicker value={startDate} onChange={setStartDate} />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <DatePicker value={endDate} onChange={setEndDate} />
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button onClick={handleApplyFilters} disabled={isPending}>
                                {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                                Apply Filters
                            </Button>
                        </div>
                    </ZoruPopoverContent>
                </Popover>
            }
        >
            <div className={`flex w-full flex-col gap-6 transition-opacity duration-200 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
                <Card>
                    <div className="flex justify-between items-center p-6 pb-2">
                        <h2 className="text-[16px] font-semibold text-foreground">Summary</h2>
                        <p className="text-[12.5px] text-muted-foreground">
                            For period: {initialStartDate ? format(initialStartDate, 'dd MMM, yyyy') : '...'} - {initialEndDate ? format(initialEndDate, 'dd MMM, yyyy') : '...'}
                        </p>
                    </div>
                    <div className="p-6 pt-0 mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard title="Income" value={`₹${summary.totalIncome.toFixed(2)}`} />
                        <StatCard title="Cost Of Goods Sold" value={`₹${summary.totalCogs.toFixed(2)}`} />
                        <StatCard 
                            title="Expense" 
                            value={`₹${summary.totalExpense.toFixed(2)}`} 
                            percentage={`${summary.totalIncome > 0 ? ((summary.totalExpense / summary.totalIncome) * 100).toFixed(0) : 0}% of Income`} 
                        />
                        <StatCard 
                            title="Net Profit" 
                            value={`₹${summary.netProfit.toFixed(2)}`} 
                            percentage={`${summary.totalIncome > 0 ? ((summary.netProfit / summary.totalIncome) * 100).toFixed(0) : 0}% of Income`} 
                            isProfit={true}
                        />
                    </div>
                </Card>

                <Card>
                    <div className="p-6 pb-4 flex justify-between items-center border-b border-border">
                        <h3 className="font-medium text-sm">Account Breakdown</h3>
                        <DropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Download className="mr-2 h-4 w-4" />
                                    Download As
                                </Button>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                                <ZoruDropdownMenuItem onSelect={() => handleDownload('csv')}>CSV Document</ZoruDropdownMenuItem>
                                <ZoruDropdownMenuItem disabled>Excel Spreadsheet (XLS)</ZoruDropdownMenuItem>
                                <ZoruDropdownMenuItem disabled>PDF Document</ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <ZoruTableHeader className="bg-muted/50">
                                <ZoruTableRow className="border-border hover:bg-transparent">
                                    <ZoruTableHead className="text-muted-foreground">Accounts</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">Amount</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">% of Total</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {entries.map((entry: any, index: number) => (
                                    <ZoruTableRow key={index} className={`border-border ${entry.isMain ? 'bg-secondary/50 font-semibold' : ''}`}>
                                        <ZoruTableCell className="text-foreground pl-6">{index + 1}. {entry.account}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground">₹{entry.amount.toFixed(2)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground pr-6">{summary.totalIncome > 0 ? ((entry.amount / summary.totalIncome) * 100).toFixed(2) : '0.00'}%</ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </EntityListShell>
    );
}
