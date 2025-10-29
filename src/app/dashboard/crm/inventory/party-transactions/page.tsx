
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, SlidersHorizontal, Users, LoaderCircle } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generatePartyTransactionReport, getCrmAccountsForSelection, getCrmVendorsForSelection } from '@/app/actions/crm-reports.actions';
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';

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

    // Filters State
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
            setPartyId(''); // Reset selected party
            setReportData([]); // Clear old report data
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
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Users /> Party Transactions Report</h1>
                    <p className="text-muted-foreground">View all inventory transactions for a specific customer or vendor.</p>
                </div>
                 <Button variant="outline" onClick={handleDownload} disabled={reportData.length === 0}><Download className="mr-2 h-4 w-4"/>Download CSV</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1"><Label>Party Type</Label><Select value={partyType} onValueChange={(val) => setPartyType(val as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="vendor">Vendor</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label>Select Party</Label><Select value={partyId} onValueChange={setPartyId}><SelectTrigger><SelectValue placeholder="Select a party..."/></SelectTrigger><SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Start Date</Label><DatePicker date={startDate} setDate={setStartDate} /></div>
                    <div className="space-y-1"><Label>End Date</Label><DatePicker date={endDate} setDate={setEndDate} /></div>
                </CardContent>
                 <CardFooter>
                    <Button onClick={handleGenerateReport} disabled={isLoading || !partyId}>
                         {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Generate Report
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Report Data</CardTitle>
                    <CardDescription>Showing transactions for the selected party and date range.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Item Name</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                ) : reportData.length > 0 ? (
                                    reportData.map((row, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{format(new Date(row.date), 'PPP')}</TableCell>
                                            <TableCell>{row.type}</TableCell>
                                            <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                                            <TableCell className="font-medium">{row.itemName}</TableCell>
                                            <TableCell className="text-right">{row.quantity}</TableCell>
                                            <TableCell className="text-right">₹{row.rate.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-semibold">₹{(row.quantity * row.rate).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center">No transactions found for the selected criteria.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
