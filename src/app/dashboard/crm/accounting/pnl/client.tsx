'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { format, isValid, parseISO } from 'date-fns';
import Papa from 'papaparse';
import { Download, ChevronDown, SlidersHorizontal, LoaderCircle } from "lucide-react";

import { Button, Card, DatePicker, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Label, Popover, PopoverContent, PopoverTrigger, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { generateProfitAndLossData } from "@/app/actions/crm-accounting.actions";

const StatCard = ({ title, value, percentage, isProfit }: { title: string; value: string; percentage?: string, isProfit?: boolean }) => (
    <div className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] p-4 rounded-lg text-center">
        <p className="text-[12.5px] text-[var(--st-text-secondary)]">{title}</p>
        <p className={`mt-1 text-[22px] font-semibold ${isProfit ? (parseFloat(value.replace(/[^0-9.-]+/g,"")) >= 0 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]') : 'text-[var(--st-text)]'}`}>{value}</p>
        {percentage && <p className="text-[11.5px] text-[var(--st-text-secondary)]">{percentage}</p>}
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
    const { toast } = useToast();
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
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                Filters
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 space-y-4" align="end">
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
                        </PopoverContent>
                    </Popover>
                }
            >
                <div className="text-center py-12 text-[13px] text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)] border rounded-lg shadow-sm">
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
                    <PopoverTrigger asChild>
                        <Button variant="outline">
                            <SlidersHorizontal className="mr-2 h-4 w-4" />
                            Filters
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 space-y-4" align="end">
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
                    </PopoverContent>
                </Popover>
            }
        >
            <div className={`flex w-full flex-col gap-6 transition-opacity duration-200 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
                <Card>
                    <div className="flex justify-between items-center p-6 pb-2">
                        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Summary</h2>
                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
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
                    <div className="p-6 pb-4 flex justify-between items-center border-b border-[var(--st-border)]">
                        <h3 className="font-medium text-sm">Account Breakdown</h3>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Download className="mr-2 h-4 w-4" />
                                    Download As
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleDownload('csv')}>CSV Document</DropdownMenuItem>
                                <DropdownMenuItem disabled>Excel Spreadsheet (XLS)</DropdownMenuItem>
                                <DropdownMenuItem disabled>PDF Document</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <THead className="bg-[var(--st-bg-muted)]/50">
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Accounts</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Amount</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">% of Total</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {entries.map((entry: any, index: number) => (
                                    <Tr key={index} className={`border-[var(--st-border)] ${entry.isMain ? 'bg-[var(--st-bg-muted)]/50 font-semibold' : ''}`}>
                                        <Td className="text-[var(--st-text)] pl-6">{index + 1}. {entry.account}</Td>
                                        <Td className="text-right font-mono text-[var(--st-text)]">₹{entry.amount.toFixed(2)}</Td>
                                        <Td className="text-right font-mono text-[var(--st-text)] pr-6">{summary.totalIncome > 0 ? ((entry.amount / summary.totalIncome) * 100).toFixed(2) : '0.00'}%</Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </EntityListShell>
    );
}
