'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, CalendarClock, LoaderCircle } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateBatchExpiryReportData } from '@/app/actions/crm-reports.actions';
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

type ReportData = {
    expiringIn30: any[];
    expiringIn60: any[];
    expiringIn90: any[];
    expired: any[];
    safe: any[];
};

const StatCard = ({ title, value }: { title: string, value: number }) => (
    <ClayCard>
        <p className="text-[12.5px] font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-[26px] font-semibold text-foreground">{value.toLocaleString()}</p>
    </ClayCard>
);

const BatchTable = ({ title, batches }: { title: string, batches: any[] }) => (
    <ClayCard>
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Product</TableHead>
                        <TableHead className="text-muted-foreground">Batch No.</TableHead>
                        <TableHead className="text-muted-foreground">Expiry Date</TableHead>
                        <TableHead className="text-muted-foreground text-right">Stock</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {batches.length > 0 ? (
                        batches.map(item => (
                            <TableRow key={`${item.productId}-${item.batchId}`} className="border-border">
                                <TableCell className="font-medium text-foreground">{item.productName}</TableCell>
                                <TableCell className="font-mono text-[11.5px] text-foreground">{item.batchNumber}</TableCell>
                                <TableCell className="text-foreground">{format(new Date(item.expiryDate), 'PPP')}</TableCell>
                                <TableCell className="text-right font-semibold text-foreground">{item.stock}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow className="border-border"><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No items in this category.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    </ClayCard>
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Batch Expiry Report"
                subtitle="Track expiry dates for your batch-managed items to reduce wastage."
                icon={CalendarClock}
                actions={
                    <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} onClick={() => handleDownload(allBatches, 'full_expiry_report')} disabled={allBatches.length === 0}>
                        Download Full Report
                    </ClayButton>
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Expired Stock" value={reportData.expired.length} />
                <StatCard title="Expiring in 30 Days" value={reportData.expiringIn30.length} />
                <StatCard title="Expiring in 60 Days" value={reportData.expiringIn60.length} />
                <StatCard title="Expiring in 90 Days" value={reportData.expiringIn90.length} />
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
