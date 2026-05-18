'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Download, ChevronDown } from 'lucide-react';

import { generateBalanceSheetData } from "@/app/actions/crm-accounting.actions";

import { useEffect, useState, useTransition, useCallback } from "react";
import Papa from "papaparse";
import { LoaderCircle } from "lucide-react";

import { EntityListShell } from '@/components/crm/entity-list-shell';

const StatCard = ({ title, value }: { title: string; value: string }) => (
    <div className="bg-secondary border border-border p-4 rounded-lg">
        <p className="text-[12.5px] text-muted-foreground">{title}</p>
        <p className="mt-1 text-[22px] font-semibold text-foreground">{value}</p>
    </div>
);

const BalanceSheetClient = ({ data }: { data: any }) => {
    const { toast } = useZoruToast();
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
        <EntityListShell
            title="Balance Sheet"
            subtitle="A snapshot of your company's financial health."
        >

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Summary</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">Figures are in INR (₹)</p>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Total Assets" value={`₹${summary.totalAssets.toFixed(2)}`} />
                    <StatCard title="Total Liabilities" value={`₹${summary.totalLiabilities.toFixed(2)}`} />
                    <StatCard title="Total Capital" value={`₹${summary.totalCapital.toFixed(2)}`} />
                    <StatCard title="Debt to Equity Ratio" value={`${summary.debtToEquity.toFixed(2)}%`} />
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
                                    <ZoruTableCell className={`text-foreground ${entry.isSub ? 'pl-8' : ''}`}>{entry.account}</ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-foreground">₹{entry.amount.toFixed(2)}</ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-foreground">{totalAll > 0 ? ((Math.abs(entry.amount) / totalAll) * 100).toFixed(2) : '0.00'}%</ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
                <div className="flex items-center justify-between pt-4 text-[11.5px] text-muted-foreground">
                    <p>Showing 1 to {entries.length} of {entries.length} entries</p>
                    <p>* Reports are in your business currency INR</p>
                </div>
            </ZoruCard>
        </EntityListShell>
    )
}

export default function BalanceSheetPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateBalanceSheetData();
            setData(result);
        });
    }, []);

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
                <p>Could not generate balance sheet data. Please ensure you have accounts and transactions.</p>
            </div>
        );
    }

    return <BalanceSheetClient data={data} />;
}
