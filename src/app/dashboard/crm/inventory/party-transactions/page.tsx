'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruDatePicker,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Download, Users, LoaderCircle } from "lucide-react";
import { useState, useEffect, useTransition } from 'react';
import { generatePartyTransactionReport } from '@/app/actions/crm-reports.actions';

import Papa from "papaparse";

import { format } from 'date-fns';
import { EntityPicker } from '@/components/crm/entity-picker';

import { CrmPageHeader } from '../../_components/crm-page-header';

type PartyTransaction = {
    date: Date;
    type: string;
    reference: string;
    itemName: string;
    quantity: number;
    rate: number;
};

export default function PartyTransactionsReportPage() {
    const [reportData, setReportData] = useState<PartyTransaction[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const [partyType, setPartyType] = useState<'customer' | 'vendor'>('customer');
    const [partyId, setPartyId] = useState<string>('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    // Reset selected party + report when toggling between customer/vendor.
    useEffect(() => {
        setPartyId('');
        setReportData([]);
    }, [partyType]);

    const handleGenerateReport = () => {
        if (!partyId) {
            toast({ title: 'Please select a party', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const result = await generatePartyTransactionReport(partyId, partyType, startDate, endDate);
            if (result.error) {
                toast({ title: "Error generating report", description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data || []);
            }
        });
    };

    const handleDownload = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download.' });
            return;
        }
        const csv = Papa.unparse(reportData.map(d => ({
            "Date": format(new Date(d.date), 'PPP'),
            "Type": d.type,
            "Reference": d.reference,
            "Item Name": d.itemName,
            "Quantity": d.quantity,
            "Rate": d.rate.toFixed(2),
            "Total": (d.quantity * d.rate).toFixed(2),
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `party_transactions_${partyId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Party Transactions Report"
                subtitle="View all inventory transactions for a specific customer or vendor."
                icon={Users}
                actions={
                    <ZoruButton variant="outline" onClick={handleDownload} disabled={reportData.length === 0}>
                        Download CSV
                    </ZoruButton>
                }
            />

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Filters</h2>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1"><ZoruLabel>Party Type</ZoruLabel><ZoruSelect value={partyType} onValueChange={(val) => setPartyType(val as any)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="customer">Customer</ZoruSelectItem><ZoruSelectItem value="vendor">Vendor</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                    <div className="space-y-1">
                        <ZoruLabel>Select Party</ZoruLabel>
                        {partyType === 'customer' ? (
                            <EntityPicker
                                entity="client"
                                value={partyId || null}
                                placeholder="Select customer…"
                                onChange={(next) => setPartyId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                            />
                        ) : (
                            <EntityPicker
                                entity="vendor"
                                value={partyId || null}
                                placeholder="Select vendor…"
                                onChange={(next) => setPartyId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                            />
                        )}
                    </div>
                    <div className="space-y-1"><ZoruLabel>Start Date</ZoruLabel><ZoruDatePicker value={startDate} onChange={setStartDate} /></div>
                    <div className="space-y-1"><ZoruLabel>End Date</ZoruLabel><ZoruDatePicker value={endDate} onChange={setEndDate} /></div>
                </div>
                <div className="mt-4">
                    <ZoruButton onClick={handleGenerateReport} disabled={isLoading || !partyId}>
                        {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Generate Report
                    </ZoruButton>
                </div>
            </ZoruCard>

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Report Data</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">Showing transactions for the selected party and date range.</p>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reference</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Item Name</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Quantity</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Rate</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Total</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></ZoruTableCell></ZoruTableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <ZoruTableRow key={index} className="border-border">
                                        <ZoruTableCell className="text-foreground">{format(new Date(row.date), 'PPP')}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.type}</ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-[11.5px] text-foreground">{row.reference}</ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-foreground">{row.itemName}</ZoruTableCell>
                                        <ZoruTableCell className="text-right text-foreground">{row.quantity}</ZoruTableCell>
                                        <ZoruTableCell className="text-right text-foreground">₹{row.rate.toFixed(2)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-semibold text-foreground">₹{(row.quantity * row.rate).toFixed(2)}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={7} className="h-24 text-center text-muted-foreground">No transactions found for the selected criteria.</ZoruTableCell></ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
