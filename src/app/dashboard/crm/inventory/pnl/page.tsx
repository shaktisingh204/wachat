'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, BarChart, LoaderCircle, ArrowUpDown } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { generateProductPnlData } from '@/app/actions/crm-reports.actions';
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';

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
    const { toast } = useToast();
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
        <TableHead onClick={() => requestSort(columnKey)} className="cursor-pointer hover:bg-muted">
            <div className="flex items-center gap-2">
                {label}
                <ArrowUpDown className="h-3 w-3" />
            </div>
        </TableHead>
    );


    return (
         <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <BarChart className="h-8 w-8" />
                        Product-wise P&L
                    </h1>
                    <p className="text-muted-foreground">Analyze the profitability of each product in your inventory.</p>
                </div>
                 <Button variant="outline" onClick={handleDownload} disabled={isLoading || reportData.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Download CSV
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Profitability Report</CardTitle>
                    <CardDescription>All figures are in INR (₹)</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader columnKey="productName" label="Product" />
                                    <SortableHeader columnKey="netSoldQty" label="Net Qty Sold" />
                                    <SortableHeader columnKey="totalRevenue" label="Total Revenue" />
                                    <SortableHeader columnKey="avgSellingPrice" label="Avg. Selling Price" />
                                    <SortableHeader columnKey="totalCogs" label="Total COGS" />
                                    <SortableHeader columnKey="grossProfit" label="Gross Profit" />
                                    <SortableHeader columnKey="grossMargin" label="Gross Margin" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-64 text-center"><LoaderCircle className="mx-auto animate-spin h-8 w-8 text-primary"/></TableCell></TableRow>
                                ) : sortedData.length > 0 ? (
                                    sortedData.map(item => (
                                        <TableRow key={item.productId}>
                                            <TableCell>
                                                <p className="font-medium">{item.productName}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                                            </TableCell>
                                            <TableCell className="text-center">{item.netSoldQty}</TableCell>
                                            <TableCell>{formatCurrency(item.totalRevenue)}</TableCell>
                                            <TableCell>{formatCurrency(item.avgSellingPrice)}</TableCell>
                                            <TableCell>{formatCurrency(item.totalCogs)}</TableCell>
                                            <TableCell className="font-semibold">{formatCurrency(item.grossProfit)}</TableCell>
                                            <TableCell className="font-semibold">{item.grossMargin.toFixed(2)}%</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="h-64 text-center text-muted-foreground">No sales data found to generate the report.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}