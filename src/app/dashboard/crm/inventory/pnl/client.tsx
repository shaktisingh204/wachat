'use client';

import { fmtINR } from "@/lib/utils";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    ArrowUpDown,
    Award,
    BadgePercent,
    Download,
    MoreHorizontal,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';
import { useRouter } from "next/navigation";

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Table, TBody, Td, Th, THead, Tr, useToast, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/sabcrm/20ui/compat';
import { type PnlDeepKpis } from '@/app/actions/crm-inventory.actions';
import {
    dateStamp,
    downloadCsv,
    downloadXlsx,
    type ExportRow,
} from '@/lib/crm-list-export';

export type ProductPnlData = {
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

function KpiTile({
    label,
    value,
    sub,
    icon: Icon,
    tone,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    tone?: 'positive' | 'negative';
}) {
    const toneClass =
        tone === 'positive'
            ? 'text-[var(--st-text)]'
            : tone === 'negative'
              ? 'text-[var(--st-text)]'
              : 'text-[var(--st-text)]';
    return (
        <Card>
            <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">{label}</p>
                <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
            </div>
            <p className={`mt-2 truncate text-[22px] font-semibold ${toneClass}`}>{value}</p>
            {sub ? <p className="mt-0.5 truncate text-[11.5px] text-[var(--st-text-secondary)]">{sub}</p> : null}
        </Card>
    );
}

export function ProductPnlClient({
    initialReportData,
    initialKpis,
}: {
    initialReportData: ProductPnlData[];
    initialKpis: PnlDeepKpis;
}) {
    const { toast } = useToast();
    const router = useRouter();
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: 'grossProfit',
        direction: 'descending',
    });

    const sortedData = useMemo(() => {
        const next = [...initialReportData];
        next.sort((a, b) => {
            const left = a[sortConfig.key];
            const right = b[sortConfig.key];
            if (left < right) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (left > right) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return next;
    }, [initialReportData, sortConfig]);

    const requestSort = (key: keyof ProductPnlData): void => {
        setSortConfig((cur) =>
            cur.key === key && cur.direction === 'ascending'
                ? { key, direction: 'descending' }
                : { key, direction: 'ascending' },
        );
    };

    const exportRows = useMemo<ExportRow[]>(
        () =>
            sortedData.map((d) => ({
                'Product Name': d.productName,
                SKU: d.sku,
                'Net Qty Sold': d.netSoldQty,
                'Total Revenue': d.totalRevenue.toFixed(2),
                'Avg Selling Price': d.avgSellingPrice.toFixed(2),
                'Total COGS': d.totalCogs.toFixed(2),
                'Gross Profit': d.grossProfit.toFixed(2),
                'Gross Margin (%)': d.grossMargin.toFixed(2),
            })),
        [sortedData],
    );

    const exportHeaders = [
        'Product Name',
        'SKU',
        'Net Qty Sold',
        'Total Revenue',
        'Avg Selling Price',
        'Total COGS',
        'Gross Profit',
        'Gross Margin (%)',
    ];

    const handleCsv = useCallback(() => {
        if (exportRows.length === 0) {
            toast({ title: 'No data', description: 'Nothing to export.' });
            return;
        }
        downloadCsv(`product_pnl_${dateStamp()}.csv`, exportHeaders, exportRows);
    }, [exportRows, toast]);

    const handleXlsx = useCallback(() => {
        if (exportRows.length === 0) {
            toast({ title: 'No data', description: 'Nothing to export.' });
            return;
        }
        void downloadXlsx(
            `product_pnl_${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'ProductPnL',
        );
    }, [exportRows, toast]);

    const SortableHeader = ({
        columnKey,
        label,
    }: {
        columnKey: keyof ProductPnlData;
        label: string;
    }) => (
        <Th
            onClick={() => requestSort(columnKey)}
            className="cursor-pointer text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        >
            <div className="flex items-center gap-2">
                {label}
                <ArrowUpDown className="h-3 w-3" />
            </div>
        </Th>
    );

    const marginTone: 'positive' | 'negative' =
        initialKpis.grossMarginPct >= 0 ? 'positive' : 'negative';

    return (
        <EntityListShell
            title="Product-wise P&L"
            subtitle="Per-product profitability over the trailing six months."
            primaryAction={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleCsv}
                        disabled={exportRows.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        CSV
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleXlsx}
                        disabled={exportRows.length === 0}
                    >
                        XLSX
                    </Button>
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <KpiTile
                    label="Gross sales"
                    value={fmtINR(initialKpis.grossSales)}
                    sub="Last 6 months"
                    icon={TrendingUp}
                />
                <KpiTile
                    label="COGS"
                    value={fmtINR(initialKpis.totalCogs)}
                    sub="Buying-price × qty sold"
                    icon={TrendingDown}
                />
                <KpiTile
                    label="Gross margin"
                    value={`${initialKpis.grossMarginPct.toFixed(2)}%`}
                    tone={marginTone}
                    icon={BadgePercent}
                />
                <KpiTile
                    label="Top profitable item"
                    value={initialKpis.topProfitable ? initialKpis.topProfitable.name : '—'}
                    sub={initialKpis.topProfitable ? `${fmtINR(initialKpis.topProfitable.profit)} profit` : 'No data'}
                    icon={Award}
                />
            </div>

            <Card className="mt-4">
                <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Monthly P&L</h2>
                <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                    Revenue vs. COGS, with the resulting gross profit line.
                </p>
                <div className="mt-4 h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={initialKpis.monthlyPnl}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(value) => fmtINR(Number(value))} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line
                                type="monotone"
                                dataKey="revenue"
                                stroke="hsl(var(--primary))"
                                name="Revenue"
                                strokeWidth={2}
                            />
                            <Line
                                type="monotone"
                                dataKey="cogs"
                                stroke="hsl(var(--destructive))"
                                name="COGS"
                                strokeWidth={2}
                            />
                            <Line
                                type="monotone"
                                dataKey="profit"
                                stroke="#10b981"
                                name="Profit"
                                strokeWidth={2}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card className="mt-4">
                <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Per-product profitability</h2>
                <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">All figures are in INR (₹).</p>
                <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <SortableHeader columnKey="productName" label="Product" />
                                <SortableHeader columnKey="netSoldQty" label="Net qty" />
                                <SortableHeader columnKey="totalRevenue" label="Revenue" />
                                <SortableHeader columnKey="avgSellingPrice" label="Avg sell" />
                                <SortableHeader columnKey="totalCogs" label="COGS" />
                                <SortableHeader columnKey="grossProfit" label="Profit" />
                                <SortableHeader columnKey="grossMargin" label="Margin" />
                                <Th className="w-[50px]"></Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {sortedData.length > 0 ? (
                                sortedData.map((item) => (
                                    <Tr key={item.productId} className="border-[var(--st-border)]">
                                        <Td>
                                            <p className="font-medium text-[var(--st-text)]">{item.productName}</p>
                                            <p className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">{item.sku}</p>
                                        </Td>
                                        <Td className="text-center text-[var(--st-text)]">
                                            {item.netSoldQty}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {fmtINR(item.totalRevenue)}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {fmtINR(item.avgSellingPrice)}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {fmtINR(item.totalCogs)}
                                        </Td>
                                        <Td className="font-semibold text-[var(--st-text)]">
                                            {fmtINR(item.grossProfit)}
                                        </Td>
                                        <Td
                                            className={`font-semibold ${
                                                item.grossMargin < 0 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'
                                            }`}
                                        >
                                            {item.grossMargin.toFixed(2)}%
                                        </Td>
                                        <Td>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            router.push(`/dashboard/crm/inventory/products/${item.productId}`);
                                                        }}
                                                    >
                                                        View Product
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(item.sku);
                                                            toast({ title: 'Copied', description: 'SKU copied to clipboard' });
                                                        }}
                                                    >
                                                        Copy SKU
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </Td>
                                    </Tr>
                                ))
                            ) : (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={8} className="h-64 text-center text-[var(--st-text-secondary)]">
                                        No sales data found to generate the report.
                                    </Td>
                                </Tr>
                            )}
                        </TBody>
                    </Table>
                </div>
            </Card>
        </EntityListShell>
    );
}
