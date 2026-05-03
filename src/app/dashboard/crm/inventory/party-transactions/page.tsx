'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, Users, LoaderCircle } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generatePartyTransactionReport, getCrmAccountsForSelection, getCrmVendorsForSelection } from '@/app/actions/crm-reports.actions';
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';
import { SmartClientSelect } from '@/components/crm/sales/smart-client-select';
import { SmartVendorSelect } from '@/components/crm/purchases/smart-vendor-select';

import { ClayCard, ClayButton } from '@/components/clay';
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
    const [parties, setParties] = useState<{ id: string, name: string }[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const [partyType, setPartyType] = useState<'customer' | 'vendor'>('customer');
    const [partyId, setPartyId] = useState<string>('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    const fetchParties = useCallback(async (type: 'customer' | 'vendor') => {
        startTransition(async () => {
            if (type === 'customer') {
                const data = await getCrmAccountsForSelection();
                setParties(data.map(p => ({ id: p._id, name: p.name })));
            } else {
                const data = await getCrmVendorsForSelection();
                setParties(data.map(p => ({ id: p._id, name: p.name })));
            }
            setPartyId('');
            setReportData([]);
        });
    }, []);

    useEffect(() => {
        fetchParties(partyType);
    }, [partyType, fetchParties]);

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
                    <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} onClick={handleDownload} disabled={reportData.length === 0}>
                        Download CSV
                    </ClayButton>
                }
            />

            <ClayCard>
                <h2 className="text-[16px] font-semibold text-foreground">Filters</h2>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1"><Label>Party Type</Label><Select value={partyType} onValueChange={(val) => setPartyType(val as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="vendor">Vendor</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1">
                        <Label>Select Party</Label>
                        {partyType === 'customer' ? (
                            <SmartClientSelect
                                value={partyId}
                                onSelect={setPartyId}
                                initialOptions={parties.map(p => ({ value: p.id, label: p.name }))}
                            />
                        ) : (
                            <SmartVendorSelect
                                value={partyId}
                                onSelect={setPartyId}
                                initialOptions={parties.map(p => ({ value: p.id, label: p.name }))}
                            />
                        )}
                    </div>
                    <div className="space-y-1"><Label>Start Date</Label><DatePicker date={startDate} setDate={setStartDate} /></div>
                    <div className="space-y-1"><Label>End Date</Label><DatePicker date={endDate} setDate={setEndDate} /></div>
                </div>
                <div className="mt-4">
                    <ClayButton variant="obsidian" onClick={handleGenerateReport} disabled={isLoading || !partyId}>
                        {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Generate Report
                    </ClayButton>
                </div>
            </ClayCard>

            <ClayCard>
                <h2 className="text-[16px] font-semibold text-foreground">Report Data</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">Showing transactions for the selected party and date range.</p>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Type</TableHead>
                                <TableHead className="text-muted-foreground">Reference</TableHead>
                                <TableHead className="text-muted-foreground">Item Name</TableHead>
                                <TableHead className="text-muted-foreground text-right">Quantity</TableHead>
                                <TableHead className="text-muted-foreground text-right">Rate</TableHead>
                                <TableHead className="text-muted-foreground text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-border"><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <TableRow key={index} className="border-border">
                                        <TableCell className="text-foreground">{format(new Date(row.date), 'PPP')}</TableCell>
                                        <TableCell className="text-foreground">{row.type}</TableCell>
                                        <TableCell className="font-mono text-[11.5px] text-foreground">{row.reference}</TableCell>
                                        <TableCell className="font-medium text-foreground">{row.itemName}</TableCell>
                                        <TableCell className="text-right text-foreground">{row.quantity}</TableCell>
                                        <TableCell className="text-right text-foreground">₹{row.rate.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-semibold text-foreground">₹{(row.quantity * row.rate).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-border"><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No transactions found for the selected criteria.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
