'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDatePicker,
  ZoruLabel,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { Download, SlidersHorizontal, LoaderCircle } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateAllTransactionsReport } from "@/app/actions/crm-reports.actions";

import Papa from "papaparse";
import { format } from "date-fns";

import { EntityListShell } from '@/components/crm/entity-list-shell';

type Transaction = {
    date: Date;
    type: 'Sale' | 'Sales Return' | 'Stock Adjustment';
    itemName: string;
    quantity: number;
    reference: string;
    partyName: string;
    warehouseName: string;
};

export default function AllTransactionsReportPage() {
    const [reportData, setReportData] = useState<Transaction[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [transactionType, setTransactionType] = useState<string>('all');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateAllTransactionsReport({
                startDate,
                endDate,
                type: transactionType === 'all' ? undefined : transactionType,
            });
            if (result.error) {
                toast({ title: "Error generating report", description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data || []);
            }
        });
    }, [startDate, endDate, transactionType, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDownload = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download.' });
            return;
        }
        const csv = Papa.unparse(reportData.map(d => ({
            "Date": format(new Date(d.date), 'PPP p'),
            "Type": d.type,
            "Reference": d.reference,
            "Item Name": d.itemName,
            "Quantity": d.quantity,
            "Warehouse": d.warehouseName || 'N/A',
            "Party": d.partyName || 'N/A',
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'all_inventory_transactions.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getTypeTone = (type: string): 'rose-soft' | 'red' | 'neutral' => {
        if (type.includes('Sale')) return 'rose-soft';
        if (type.includes('Return')) return 'red';
        return 'neutral';
    }

    return (
        <EntityListShell
            title="All Inventory Transactions"
            subtitle="A complete log of all stock movements."
            primaryAction={
                <div className="flex items-center gap-2">
                    <ZoruPopover>
                        <ZoruPopoverTrigger asChild>
                            <ZoruButton variant="outline">
                                Filters
                            </ZoruButton>
                        </ZoruPopoverTrigger>
                        <ZoruPopoverContent className="w-80 space-y-4">
                            <div className="space-y-2"><ZoruLabel>Start Date</ZoruLabel><ZoruDatePicker value={startDate} onChange={setStartDate} /></div>
                            <div className="space-y-2"><ZoruLabel>End Date</ZoruLabel><ZoruDatePicker value={endDate} onChange={setEndDate} /></div>
                            <div className="space-y-2"><ZoruLabel>Transaction Type</ZoruLabel><EnumFilterField enumName="inventoryTransactionType" value={transactionType} onChange={setTransactionType} allLabel="All Types" /></div>
                            <ZoruButton onClick={fetchData} disabled={isLoading} className="w-full">Apply</ZoruButton>
                        </ZoruPopoverContent>
                    </ZoruPopover>
                    <ZoruButton variant="outline" onClick={handleDownload} disabled={isLoading || reportData.length === 0}>
                        Download CSV
                    </ZoruButton>
                </div>
            }
        >

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Transaction Log</h2>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Item Name</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Quantity</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Party</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reference</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Warehouse</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={7} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-muted-foreground"/></ZoruTableCell></ZoruTableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <ZoruTableRow key={index} className="border-border">
                                        <ZoruTableCell className="text-[11.5px] text-foreground">{format(new Date(row.date), 'PP p')}</ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-foreground">{row.itemName}</ZoruTableCell>
                                        <ZoruTableCell><ZoruBadge variant={(getTypeTone(row.type)) as any}>{row.type}</ZoruBadge></ZoruTableCell>
                                        <ZoruTableCell className={`font-semibold ${row.quantity < 0 ? 'text-destructive' : 'text-emerald-500'}`}>{row.quantity}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.partyName || 'N/A'}</ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-[11.5px] text-foreground">{row.reference}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.warehouseName || 'Default'}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={7} className="h-48 text-center text-muted-foreground">No transactions found for the selected filters.</ZoruTableCell></ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
