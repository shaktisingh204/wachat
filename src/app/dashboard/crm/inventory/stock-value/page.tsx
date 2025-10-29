
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { IndianRupee, Box, Download, LoaderCircle } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateStockValueReport } from "@/app/actions/crm-reports.actions";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { format } from "date-fns";

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </CardContent>
    </Card>
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
            "Unit Cost": d.buyingPrice.toFixed(2),
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
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <IndianRupee className="h-8 w-8" />
                        Stock Value Report
                    </h1>
                    <p className="text-muted-foreground">Get a real-time valuation of your entire inventory.</p>
                </div>
                 <Button variant="outline" onClick={handleDownload} disabled={isLoading || reportData.length === 0}>
                    <Download className="mr-2 h-4 w-4"/>Download CSV
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Inventory Value" value={formatCurrency(summary.totalValue || 0)} icon={IndianRupee} />
                <StatCard title="Total Units in Stock" value={summary.totalUnits || 0} icon={Box} />
                <StatCard title="Products with Stock" value={summary.productCount || 0} icon={Box} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Inventory Valuation Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead className="text-right">Stock Quantity</TableHead>
                                    <TableHead className="text-right">Unit Cost</TableHead>
                                    <TableHead className="text-right">Stock Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center"><LoaderCircle className="mx-auto animate-spin h-8 w-8 text-primary"/></TableCell></TableRow>
                                ) : reportData.length > 0 ? (
                                    reportData.map(item => (
                                        <TableRow key={`${item.productId}-${item.warehouseId}`}>
                                            <TableCell>
                                                <p className="font-medium">{item.productName}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{item.sku || 'N/A'}</p>
                                            </TableCell>
                                            <TableCell>{item.warehouseName}</TableCell>
                                            <TableCell className="text-right font-medium">{item.stock}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(item.buyingPrice)}</TableCell>
                                            <TableCell className="text-right font-bold">{formatCurrency(item.stockValue)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-64 text-center text-muted-foreground">No stock data found for any products.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 <CardFooter>
                    <p className="text-xs text-muted-foreground">This report is based on the 'Buying Price' set for each product.</p>
                </CardFooter>
            </Card>
        </div>
    );
}
