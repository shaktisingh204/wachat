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
import { IndianRupee, Box, Download, LoaderCircle, DollarSign } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateStockValueReport } from "@/app/actions/crm-reports.actions";

import Papa from "papaparse";
import { format } from "date-fns";

import { CrmPageHeader } from '../../_components/crm-page-header';

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <ZoruCard>
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-muted-foreground">{title}</p>
            <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="mt-2 text-[22px] font-semibold text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </ZoruCard>
);

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

export default function StockValueReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({});
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

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
                    <ZoruButton variant="outline" onClick={handleDownload} disabled={isLoading || reportData.length === 0}>
                        Download CSV
                    </ZoruButton>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Inventory Value" value={formatCurrency(summary.totalValue || 0)} icon={IndianRupee} />
                <StatCard title="Total Units in Stock" value={summary.totalUnits || 0} icon={Box} />
                <StatCard title="Products with Stock" value={summary.productCount || 0} icon={Box} />
            </div>

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Inventory Valuation Details</h2>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Product</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Warehouse</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Stock Quantity</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Unit Cost</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Stock Value</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={5} className="h-64 text-center"><LoaderCircle className="mx-auto animate-spin h-8 w-8 text-muted-foreground"/></ZoruTableCell></ZoruTableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(item => (
                                    <ZoruTableRow key={`${item.productId}-${item.warehouseId}`} className="border-border">
                                        <ZoruTableCell>
                                            <p className="font-medium text-foreground">{item.productName}</p>
                                            <p className="text-[11.5px] text-muted-foreground font-mono">{item.sku || 'N/A'}</p>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{item.warehouseName}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-medium text-foreground">{item.stock}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground">{formatCurrency(item.unitCost)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-semibold text-foreground">{formatCurrency(item.stockValue)}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={5} className="h-64 text-center text-muted-foreground">No stock data found for any products.</ZoruTableCell></ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
                <p className="mt-4 text-[11.5px] text-muted-foreground">This report is based on the 'Buying Price' (cost) set for each product. If cost is not set, it falls back to the 'Selling Price'.</p>
            </ZoruCard>
        </div>
    );
}
