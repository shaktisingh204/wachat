

'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, CalendarClock, LoaderCircle, AlertCircle, TrendingUp, TrendingDown, Hourglass, CheckCircle } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateBatchExpiryReportData } from '@/app/actions/crm-reports.actions';
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import { format, formatDistanceToNow } from "date-fns";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ReportData = {
    expiringIn30: any[];
    expiringIn60: any[];
    expiringIn90: any[];
    expired: any[];
    safe: any[];
};

const StatCard = ({ title, value, variant }: { title: string, value: number, variant?: 'default' | 'destructive' | 'secondary' }) => (
    <Card>
        <CardHeader>
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-3xl font-bold">{value.toLocaleString()}</p>
        </CardContent>
    </Card>
);

const BatchTable = ({ title, batches }: { title: string, batches: any[] }) => (
    <Card>
        <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Batch No.</TableHead>
                            <TableHead>Expiry Date</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {batches.length > 0 ? (
                            batches.map(item => (
                                <TableRow key={`${item.productId}-${item.batchId}`}>
                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                    <TableCell className="font-mono text-xs">{item.batchNumber}</TableCell>
                                    <TableCell>{format(new Date(item.expiryDate), 'PPP')}</TableCell>
                                    <TableCell className="text-right font-semibold">{item.stock}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow><TableCell colSpan={4} className="h-24 text-center">No items in this category.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
);

export default function BatchExpiryReportPage() {
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateBatchExpiryReportData();
            if(result.error) {
                 toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data as ReportData);
            }
        });
    }, [toast]);
    
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDownload = (dataToDownload: any[], fileName: string) => {
         if (dataToDownload.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download for this category.'});
            return;
        }
        const csv = Papa.unparse(dataToDownload.map(d => ({
            "Product": d.productName,
            "SKU": d.sku,
            "Batch Number": d.batchNumber,
            "Stock": d.stock,
            "Expiry Date": format(new Date(d.expiryDate), 'yyyy-MM-dd'),
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${fileName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading || !reportData) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    const allBatches = [
        ...reportData.expired, ...reportData.expiringIn30, ...reportData.expiringIn60, ...reportData.expiringIn90, ...reportData.safe
    ];
    
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <CalendarClock className="h-8 w-8" />
                        Batch Expiry Report
                    </h1>
                    <p className="text-muted-foreground">Track expiry dates for your batch-managed items to reduce wastage.</p>
                </div>
                 <Button variant="outline" onClick={() => handleDownload(allBatches, 'full_expiry_report')} disabled={allBatches.length === 0}>
                    <Download className="mr-2 h-4 w-4"/>Download Full Report
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Expired Stock" value={reportData.expired.length} variant="destructive"/>
                <StatCard title="Expiring in 30 Days" value={reportData.expiringIn30.length} variant="destructive"/>
                <StatCard title="Expiring in 60 Days" value={reportData.expiringIn60.length} variant="secondary"/>
                <StatCard title="Expiring in 90 Days" value={reportData.expiringIn90.length} variant="secondary"/>
            </div>
            
            <Tabs defaultValue="expiring_soon">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="expiring_soon">Expiring Soon</TabsTrigger>
                    <TabsTrigger value="expired">Expired</TabsTrigger>
                    <TabsTrigger value="safe">Safe Stock</TabsTrigger>
                </TabsList>
                <TabsContent value="expiring_soon" className="space-y-6 mt-6">
                    <BatchTable title="Expiring in 30 Days" batches={reportData.expiringIn30} />
                    <BatchTable title="Expiring in 60 Days" batches={reportData.expiringIn60} />
                    <BatchTable title="Expiring in 90 Days" batches={reportData.expiringIn90} />
                </TabsContent>
                 <TabsContent value="expired" className="mt-6">
                    <BatchTable title="Expired Items" batches={reportData.expired} />
                </TabsContent>
                 <TabsContent value="safe" className="mt-6">
                     <BatchTable title="Safe Stock (Expires > 90 days)" batches={reportData.safe} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
