'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IndianRupee, Box, Download, LoaderCircle, DollarSign } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateStockValueReport } from "@/app/actions/crm-reports.actions";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { format } from "date-fns";

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <ClayCard>
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-clay-ink-muted">{title}</p>
            <Icon className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
        </div>
        <div className="mt-2 text-[22px] font-semibold text-clay-ink">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </ClayCard>
);

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

export default function StockValueReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({});
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateStockValueReport();
            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data);
                setSummary(result.summary);
            }
        });
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDownload = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no report data to download.' });
            return;
        }
        const csv = Papa.unparse(reportData.map(d => ({
            "Product Name": d.productName,
            "SKU": d.sku,
            "Warehouse": d.warehouseName,
            "Stock Quantity": d.stock,
            "Unit Cost": d.unitCost.toFixed(2),
            "Stock Value": d.stockValue.toFixed(2),
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `stock_value_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Stock Value Report"
                subtitle="Get a real-time valuation of your entire inventory."
                icon={DollarSign}
                actions={
                    <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} onClick={handleDownload} disabled={isLoading || reportData.length === 0}>
                        Download CSV
                    </ClayButton>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Inventory Value" value={formatCurrency(summary.totalValue || 0)} icon={IndianRupee} />
                <StatCard title="Total Units in Stock" value={summary.totalUnits || 0} icon={Box} />
                <StatCard title="Products with Stock" value={summary.productCount || 0} icon={Box} />
            </div>

            <ClayCard>
                <h2 className="text-[16px] font-semibold text-clay-ink">Inventory Valuation Details</h2>
                <div className="mt-4 overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Product</TableHead>
                                <TableHead className="text-clay-ink-muted">Warehouse</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Stock Quantity</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Unit Cost</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Stock Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border"><TableCell colSpan={5} className="h-64 text-center"><LoaderCircle className="mx-auto animate-spin h-8 w-8 text-clay-ink-muted"/></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(item => (
                                    <TableRow key={`${item.productId}-${item.warehouseId}`} className="border-clay-border">
                                        <TableCell>
                                            <p className="font-medium text-clay-ink">{item.productName}</p>
                                            <p className="text-[11.5px] text-clay-ink-muted font-mono">{item.sku || 'N/A'}</p>
                                        </TableCell>
                                        <TableCell className="text-clay-ink">{item.warehouseName}</TableCell>
                                        <TableCell className="text-right font-medium text-clay-ink">{item.stock}</TableCell>
                                        <TableCell className="text-right font-mono text-clay-ink">{formatCurrency(item.unitCost)}</TableCell>
                                        <TableCell className="text-right font-semibold text-clay-ink">{formatCurrency(item.stockValue)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-clay-border"><TableCell colSpan={5} className="h-64 text-center text-clay-ink-muted">No stock data found for any products.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <p className="mt-4 text-[11.5px] text-clay-ink-muted">This report is based on the 'Buying Price' (cost) set for each product. If cost is not set, it falls back to the 'Selling Price'.</p>
            </ClayCard>
        </div>
    );
}
