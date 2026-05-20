'use client';

/**
 * Inventory — Product P&L deep view.
 *
 * KPI tiles (gross sales, COGS, margin %, top profitable item) sit above
 * a 6-month line chart of revenue vs. COGS, followed by the sortable
 * per-product table. Multi-tenant via the server actions.
 */

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
    LoaderCircle,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useTransition,
} from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
import { generateProductPnlData } from '@/app/actions/crm-reports.actions';
import {
    getPnlDeepKpis,
    type PnlDeepKpis,
} from '@/app/actions/crm-inventory.actions';
import {
    dateStamp,
    downloadCsv,
    downloadXlsx,
    type ExportRow,
} from '@/lib/crm-list-export';

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

const fmtCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);

const KPI_EMPTY: PnlDeepKpis = {
    grossSales: 0,
    totalCogs: 0,
    grossMarginPct: 0,
    topProfitable: null,
    monthlyPnl: [],
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
}): React.JSX.Element {
    const toneClass =
        tone === 'positive'
            ? 'text-emerald-500'
            : tone === 'negative'
              ? 'text-destructive'
              : 'text-foreground';
    return (
        <ZoruCard>
            <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <p className={`mt-2 truncate text-[22px] font-semibold ${toneClass}`}>{value}</p>
            {sub ? <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{sub}</p> : null}
        </ZoruCard>
    );
}

export default function ProductPnlDeepPage(): React.JSX.Element {
    const { toast } = useZoruToast();
    const [reportData, setReportData] = useState<ProductPnlData[]>([]);
    const [kpis, setKpis] = useState<PnlDeepKpis>(KPI_EMPTY);
    const [isLoading, startTransition] = useTransition();
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: 'grossProfit',
        direction: 'descending',
    });

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [pnl, deep] = await Promise.all([
                generateProductPnlData(),
                getPnlDeepKpis(),
            ]);
            if (pnl.error) {
                toast({
                    title: 'Error',
                    description: pnl.error,
                    variant: 'destructive',
                });
            } else {
                setReportData((pnl.data as ProductPnlData[]) ?? []);
            }
            setKpis(deep);
        });
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const sortedData = useMemo(() => {
        const next = [...reportData];
        next.sort((a, b) => {
            const left = a[sortConfig.key];
            const right = b[sortConfig.key];
            if (left < right) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (left > right) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return next;
    }, [reportData, sortConfig]);

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
    }): React.JSX.Element => (
        <ZoruTableHead
            onClick={() => requestSort(columnKey)}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
        >
            <div className="flex items-center gap-2">
                {label}
                <ArrowUpDown className="h-3 w-3" />
            </div>
        </ZoruTableHead>
    );

    const marginTone: 'positive' | 'negative' =
        kpis.grossMarginPct >= 0 ? 'positive' : 'negative';

    return (
        <EntityListShell
            title="Product-wise P&L"
            subtitle="Per-product profitability over the trailing six months."
            primaryAction={
                <div className="flex items-center gap-2">
                    <ZoruButton
                        variant="outline"
                        onClick={handleCsv}
                        disabled={isLoading || exportRows.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        CSV
                    </ZoruButton>
                    <ZoruButton
                        variant="outline"
                        onClick={handleXlsx}
                        disabled={isLoading || exportRows.length === 0}
                    >
                        XLSX
                    </ZoruButton>
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <KpiTile
                    label="Gross sales"
                    value={fmtCurrency(kpis.grossSales)}
                    sub="Last 6 months"
                    icon={TrendingUp}
                />
                <KpiTile
                    label="COGS"
                    value={fmtCurrency(kpis.totalCogs)}
                    sub="Buying-price × qty sold"
                    icon={TrendingDown}
                />
                <KpiTile
                    label="Gross margin"
                    value={`${kpis.grossMarginPct.toFixed(2)}%`}
                    tone={marginTone}
                    icon={BadgePercent}
                />
                <KpiTile
                    label="Top profitable item"
                    value={kpis.topProfitable ? kpis.topProfitable.name : '—'}
                    sub={kpis.topProfitable ? `${fmtCurrency(kpis.topProfitable.profit)} profit` : 'No data'}
                    icon={Award}
                />
            </div>

            <ZoruCard className="mt-4">
                <h2 className="text-[16px] font-semibold text-foreground">Monthly P&L</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    Revenue vs. COGS, with the resulting gross profit line.
                </p>
                <div className="mt-4 h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={kpis.monthlyPnl}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(value) => fmtCurrency(Number(value))} />
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
            </ZoruCard>

            <ZoruCard className="mt-4">
                <h2 className="text-[16px] font-semibold text-foreground">Per-product profitability</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">All figures are in INR (₹).</p>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <SortableHeader columnKey="productName" label="Product" />
                                <SortableHeader columnKey="netSoldQty" label="Net qty" />
                                <SortableHeader columnKey="totalRevenue" label="Revenue" />
                                <SortableHeader columnKey="avgSellingPrice" label="Avg sell" />
                                <SortableHeader columnKey="totalCogs" label="COGS" />
                                <SortableHeader columnKey="grossProfit" label="Profit" />
                                <SortableHeader columnKey="grossMargin" label="Margin" />
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={7} className="h-64 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : sortedData.length > 0 ? (
                                sortedData.map((item) => (
                                    <ZoruTableRow key={item.productId} className="border-border">
                                        <ZoruTableCell>
                                            <p className="font-medium text-foreground">{item.productName}</p>
                                            <p className="font-mono text-[11.5px] text-muted-foreground">{item.sku}</p>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-center text-foreground">
                                            {item.netSoldQty}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {fmtCurrency(item.totalRevenue)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {fmtCurrency(item.avgSellingPrice)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {fmtCurrency(item.totalCogs)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-semibold text-foreground">
                                            {fmtCurrency(item.grossProfit)}
                                        </ZoruTableCell>
                                        <ZoruTableCell
                                            className={`font-semibold ${
                                                item.grossMargin < 0 ? 'text-destructive' : 'text-foreground'
                                            }`}
                                        >
                                            {item.grossMargin.toFixed(2)}%
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                                        No sales data found to generate the report.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
