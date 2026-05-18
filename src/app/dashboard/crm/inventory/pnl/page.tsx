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
import { Download, LoaderCircle, ArrowUpDown } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { generateProductPnlData } from '@/app/actions/crm-reports.actions';

import Papa from 'papaparse';

import { EntityListShell } from '@/components/crm/entity-list-shell';

type ProductPnlData = {
    productId: string;
    productName: string;
    sku: string;
    totalSoldQty: number;
    totalReturnedQty: number;
    netSoldQty: number;
    totalRevenue: number;
    avgSellingPrice: number;
    totalCogs: number;
    grossProfit: number;
    grossMargin: number;
};

type SortConfig = {
    key: keyof ProductPnlData;
    direction: 'ascending' | 'descending';
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

export default function ProductPnlPage() {
    const [reportData, setReportData] = useState<ProductPnlData[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'grossProfit', direction: 'descending' });

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateProductPnlData();
            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data || []);
            }
        });
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const sortedData = useMemo(() => {
        let sortableItems = [...reportData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [reportData, sortConfig]);

    const requestSort = (key: keyof ProductPnlData) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleDownload = () => {
        if (sortedData.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download.'});
            return;
        }
        const csv = Papa.unparse(sortedData.map(d => ({
            "Product Name": d.productName,
            "SKU": d.sku,
            "Net Qty Sold": d.netSoldQty,
            "Total Revenue": d.totalRevenue.toFixed(2),
            "Avg Selling Price": d.avgSellingPrice.toFixed(2),
            "Total COGS": d.totalCogs.toFixed(2),
            "Gross Profit": d.grossProfit.toFixed(2),
            "Gross Margin (%)": d.grossMargin.toFixed(2),
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'product_pnl_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const SortableHeader = ({ columnKey, label }: { columnKey: keyof ProductPnlData, label: string }) => (
        <ZoruTableHead onClick={() => requestSort(columnKey)} className="cursor-pointer text-muted-foreground hover:text-foreground">
            <div className="flex items-center gap-2">
                {label}
                <ArrowUpDown className="h-3 w-3" />
            </div>
        </ZoruTableHead>
    );

    return (
        <EntityListShell
            title="Product-wise P&L"
            subtitle="Analyze the profitability of each product in your inventory."
            primaryAction={
                <ZoruButton variant="outline" onClick={handleDownload} disabled={isLoading || reportData.length === 0}>
                    Download CSV
                </ZoruButton>
            }
        >

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Profitability Report</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">All figures are in INR (₹)</p>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <SortableHeader columnKey="productName" label="Product" />
                                <SortableHeader columnKey="netSoldQty" label="Net Qty Sold" />
                                <SortableHeader columnKey="totalRevenue" label="Total Revenue" />
                                <SortableHeader columnKey="avgSellingPrice" label="Avg. Selling Price" />
                                <SortableHeader columnKey="totalCogs" label="Total COGS" />
                                <SortableHeader columnKey="grossProfit" label="Gross Profit" />
                                <SortableHeader columnKey="grossMargin" label="Gross Margin" />
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={7} className="h-64 text-center"><LoaderCircle className="mx-auto animate-spin h-8 w-8 text-muted-foreground"/></ZoruTableCell></ZoruTableRow>
                            ) : sortedData.length > 0 ? (
                                sortedData.map(item => (
                                    <ZoruTableRow key={item.productId} className="border-border">
                                        <ZoruTableCell>
                                            <p className="font-medium text-foreground">{item.productName}</p>
                                            <p className="text-[11.5px] text-muted-foreground font-mono">{item.sku}</p>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-center text-foreground">{item.netSoldQty}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{formatCurrency(item.totalRevenue)}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{formatCurrency(item.avgSellingPrice)}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{formatCurrency(item.totalCogs)}</ZoruTableCell>
                                        <ZoruTableCell className="font-semibold text-foreground">{formatCurrency(item.grossProfit)}</ZoruTableCell>
                                        <ZoruTableCell className="font-semibold text-foreground">{item.grossMargin.toFixed(2)}%</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={7} className="h-64 text-center text-muted-foreground">No sales data found to generate the report.</ZoruTableCell></ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
