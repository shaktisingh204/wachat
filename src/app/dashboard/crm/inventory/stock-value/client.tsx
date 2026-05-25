'use client';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    Button,
    Card,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';
import {
    Box,
    Download,
    IndianRupee,
    PackageOpen,
    Snowflake,
    Zap,
} from 'lucide-react';
import {
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { useCallback, useMemo } from 'react';
import { fmtINR, fmtDate } from '@/lib/utils';
import { type StockValueDeepKpis } from '@/app/actions/crm-inventory.actions';
import { dateStamp, downloadCsv, downloadXlsx, type ExportRow } from '@/lib/crm-list-export';

type StockRow = {
    productId: string;
    productName: string;
    sku?: string;
    warehouseId?: string;
    warehouseName: string;
    stock: number;
    unitCost: number;
    stockValue: number;
};

type ReportSummary = {
    totalValue?: number;
    totalUnits?: number;
    productCount?: number;
};

const PIE_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--muted-foreground))',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
];

function KpiTile({
    label,
    value,
    sub,
    icon: Icon,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
}): React.JSX.Element {
    return (
        <Card>
            <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <p className="mt-2 truncate text-[22px] font-semibold text-foreground">{value}</p>
            {sub ? <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{sub}</p> : null}
        </Card>
    );
}

export default function StockValueDeepClient({
    reportData,
    summary,
    kpis,
}: {
    reportData: StockRow[];
    summary: ReportSummary;
    kpis: StockValueDeepKpis;
}): React.JSX.Element {
    const { toast } = useZoruToast();

    const exportRows = useMemo<ExportRow[]>(
        () =>
            reportData.map((d) => ({
                'Product Name': d.productName,
                SKU: d.sku ?? '',
                Warehouse: d.warehouseName,
                'Stock Quantity': d.stock,
                'Unit Cost': d.unitCost.toFixed(2),
                'Stock Value': d.stockValue.toFixed(2),
            })),
        [reportData],
    );

    const exportHeaders = [
        'Product Name',
        'SKU',
        'Warehouse',
        'Stock Quantity',
        'Unit Cost',
        'Stock Value',
    ];

    const handleCsv = useCallback(() => {
        if (exportRows.length === 0) {
            toast({ title: 'No data', description: 'Nothing to export.' });
            return;
        }
        downloadCsv(`stock_value_${dateStamp()}.csv`, exportHeaders, exportRows);
    }, [exportRows, toast]);

    const handleXlsx = useCallback(() => {
        if (exportRows.length === 0) {
            toast({ title: 'No data', description: 'Nothing to export.' });
            return;
        }
        void downloadXlsx(
            `stock_value_${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'StockValue',
        );
    }, [exportRows, toast]);

    return (
        <EntityListShell
            title="Stock value report"
            subtitle="Real-time valuation of every SKU across every warehouse."
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
                    label="Total stock value"
                    value={fmtINR(kpis.totalStockValue || summary.totalValue || 0)}
                    sub={`${(summary.totalUnits ?? 0).toLocaleString('en-IN')} units · ${(summary.productCount ?? 0).toLocaleString('en-IN')} SKUs`}
                    icon={IndianRupee}
                />
                <KpiTile
                    label="Fast-moving value"
                    value={fmtINR(kpis.fastMovingValue)}
                    sub="≥ 10 units sold in last 90d"
                    icon={Zap}
                />
                <KpiTile
                    label="Slow-moving value"
                    value={fmtINR(kpis.slowMovingValue)}
                    sub="0 units sold in last 90d"
                    icon={Snowflake}
                />
                <KpiTile
                    label="Warehouses tracked"
                    value={kpis.byWarehouse.length.toLocaleString('en-IN')}
                    sub={kpis.byWarehouse[0] ? `Top: ${kpis.byWarehouse[0].warehouseName}` : 'No data'}
                    icon={PackageOpen}
                />
            </div>

            <Card className="mt-4">
                <h2 className="text-[16px] font-semibold text-foreground">Value by warehouse</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    Where your inventory dollars are sitting.
                </p>
                <div className="mt-4 h-[280px] w-full">
                    {kpis.byWarehouse.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[12.5px] text-muted-foreground">
                            <Box className="mr-2 h-4 w-4" />
                            No warehouse stock recorded yet.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={kpis.byWarehouse}
                                    dataKey="value"
                                    nameKey="warehouseName"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={(props) => {
                                        const wh = (props as { warehouseName?: string }).warehouseName;
                                        return wh ?? '';
                                    }}
                                >
                                    {kpis.byWarehouse.map((entry, index) => (
                                        <Cell
                                            key={entry.warehouseId}
                                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => fmtINR(Number(value))} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </Card>

            <Card className="mt-4">
                <h2 className="text-[16px] font-semibold text-foreground">Valuation details</h2>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Product</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Warehouse</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Stock</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Unit cost</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Stock value</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {reportData.length > 0 ? (
                                reportData.map((item) => (
                                    <ZoruTableRow
                                        key={`${item.productId}-${item.warehouseId ?? 'default'}`}
                                        className="border-border"
                                    >
                                        <ZoruTableCell>
                                            <p className="font-medium text-foreground">{item.productName}</p>
                                            <p className="font-mono text-[11.5px] text-muted-foreground">
                                                {item.sku || 'N/A'}
                                            </p>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {item.warehouseName}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-medium text-foreground">
                                            {item.stock}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground">
                                            {fmtINR(item.unitCost)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-semibold text-foreground">
                                            {fmtINR(item.stockValue)}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell
                                        colSpan={5}
                                        className="h-64 text-center text-muted-foreground"
                                    >
                                        No stock data found for any products.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
                <p className="mt-4 text-[11.5px] text-muted-foreground">
                    Valuation uses each product&rsquo;s buying price (cost). If the cost is unset, the selling price is used as a fallback.
                </p>
            </Card>
        </EntityListShell>
    );
}
