'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, SlidersHorizontal, History, LoaderCircle } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateAllTransactionsReport } from "@/app/actions/crm-reports.actions";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
    const { toast } = useToast();

    // Filters
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

    const getTypeVariant = (type: string) => {
        if (type.includes('Sale')) return 'default';
        if (type.includes('Return')) return 'destructive';
        return 'secondary';
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><History /> All Inventory Transactions</h1>
                    <p className="text-muted-foreground">A complete log of all stock movements.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4"/>Filters</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 space-y-4">
                            <div className="space-y-2"><Label>Start Date</Label><DatePicker date={startDate} setDate={setStartDate} /></div>
                            <div className="space-y-2"><Label>End Date</Label><DatePicker date={endDate} setDate={setEndDate} /></div>
                            <div className="space-y-2"><Label>Transaction Type</Label><Select value={transactionType} onValueChange={setTransactionType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="Sale">Sales</SelectItem><SelectItem value="Sales Return">Sales Returns</SelectItem><SelectItem value="Stock Adjustment">Stock Adjustments</SelectItem></SelectContent></Select></div>
                            <Button onClick={fetchData} disabled={isLoading} className="w-full">Apply</Button>
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" onClick={handleDownload} disabled={isLoading || reportData.length === 0}><Download className="mr-2 h-4 w-4"/>Download CSV</Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Transaction Log</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Item Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Party</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin"/></TableCell></TableRow>
                                ) : reportData.length > 0 ? (
                                    reportData.map((row, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="text-xs">{format(new Date(row.date), 'PP p')}</TableCell>
                                            <TableCell className="font-medium">{row.itemName}</TableCell>
                                            <TableCell><Badge variant={getTypeVariant(row.type)}>{row.type}</Badge></TableCell>
                                            <TableCell className={`font-semibold ${row.quantity < 0 ? 'text-destructive' : 'text-green-600'}`}>{row.quantity}</TableCell>
                                            <TableCell>{row.partyName || 'N/A'}</TableCell>
                                            <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                                            <TableCell>{row.warehouseName || 'Default'}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground">No transactions found for the selected filters.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
