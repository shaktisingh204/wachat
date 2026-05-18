'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Download, LoaderCircle } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateBatchExpiryReportData } from '@/app/actions/crm-reports.actions';

import Papa from 'papaparse';
import { format } from "date-fns";

import { EntityListShell } from '@/components/crm/entity-list-shell';

type ReportData = {
    expiringIn30: any[];
    expiringIn60: any[];
    expiringIn90: any[];
    expired: any[];
    safe: any[];
};

const StatCard = ({ title, value }: { title: string, value: number }) => (
    <ZoruCard>
        <p className="text-[12.5px] font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-[26px] font-semibold text-foreground">{value.toLocaleString()}</p>
    </ZoruCard>
);

const BatchTable = ({ title, batches }: { title: string, batches: any[] }) => (
    <ZoruCard>
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-border hover:bg-transparent">
                        <ZoruTableHead className="text-muted-foreground">Product</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Batch No.</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Expiry Date</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground text-right">Stock</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {batches.length > 0 ? (
                        batches.map(item => (
                            <ZoruTableRow key={`${item.productId}-${item.batchId}`} className="border-border">
                                <ZoruTableCell className="font-medium text-foreground">{item.productName}</ZoruTableCell>
                                <ZoruTableCell className="font-mono text-[11.5px] text-foreground">{item.batchNumber}</ZoruTableCell>
                                <ZoruTableCell className="text-foreground">{format(new Date(item.expiryDate), 'PPP')}</ZoruTableCell>
                                <ZoruTableCell className="text-right font-semibold text-foreground">{item.stock}</ZoruTableCell>
                            </ZoruTableRow>
                        ))
                    ) : (
                        <ZoruTableRow className="border-border"><ZoruTableCell colSpan={4} className="h-24 text-center text-muted-foreground">No items in this category.</ZoruTableCell></ZoruTableRow>
                    )}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    </ZoruCard>
);

export default function BatchExpiryReportPage() {
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

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
        <EntityListShell
            title="Batch Expiry Report"
            subtitle="Track expiry dates for your batch-managed items to reduce wastage."
            primaryAction={
                <ZoruButton variant="outline" onClick={() => handleDownload(allBatches, 'full_expiry_report')} disabled={allBatches.length === 0}>
                    Download Full Report
                </ZoruButton>
            }
        >

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Expired Stock" value={reportData.expired.length} />
                <StatCard title="Expiring in 30 Days" value={reportData.expiringIn30.length} />
                <StatCard title="Expiring in 60 Days" value={reportData.expiringIn60.length} />
                <StatCard title="Expiring in 90 Days" value={reportData.expiringIn90.length} />
            </div>

            <div defaultValue="expiring_soon">
                <div className="grid w-full grid-cols-3">
                    <button type="button">Expiring Soon</button>
                    <button type="button">Expired</button>
                    <button type="button">Safe Stock</button>
                </div>
                <div className="space-y-6 mt-6">
                    <BatchTable title="Expiring in 30 Days" batches={reportData.expiringIn30} />
                    <BatchTable title="Expiring in 60 Days" batches={reportData.expiringIn60} />
                    <BatchTable title="Expiring in 90 Days" batches={reportData.expiringIn90} />
                </div>
                 <div className="mt-6">
                    <BatchTable title="Expired Items" batches={reportData.expired} />
                </div>
                 <div className="mt-6">
                     <BatchTable title="Safe Stock (Expires > 90 days)" batches={reportData.safe} />
                </div>
            </div>
        </EntityListShell>
    )
}
