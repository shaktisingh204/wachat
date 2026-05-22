'use client';

/**
 * Inventory — All Transactions deep view.
 *
 * Combines KPI tiles (txn this month + by type + top item + total value)
 * with a 6-month bar chart and the existing transaction log table. Filters
 * collapse into a popover; export ships via the shared CSV/XLSX helpers in
 * `src/lib/crm-list-export.ts`. Multi-tenant — all reads scope to the
 * current session user via the server actions.
 */

import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    ArrowLeftRight,
    BadgeIndianRupee,
    Boxes,
    Download,
    LoaderCircle,
    Package,
    Receipt,
    TrendingDown,
} from 'lucide-react';
import { format } from 'date-fns';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useTransition,
} from 'react';

import {
    generateAllTransactionsReport,
} from '@/app/actions/crm-reports.actions';
import {
    getAllTransactionsDeepKpis,
    type AllTransactionsDeepKpis,
} from '@/app/actions/crm-inventory.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
    Badge,
    Button,
    Card,
    DatePicker,
    Label,
    Popover,
    ZoruPopoverContent,
    ZoruPopoverTrigger,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';
import {
    dateStamp,
    downloadCsv,
    downloadXlsx,
    type ExportRow,
} from '@/lib/crm-list-export';

type Transaction = {
    date: Date;
    type: 'Sale' | 'Sales Return' | 'Stock Adjustment';
    itemName: string;
    quantity: number;
    reference: string;
    partyName: string;
    warehouseName: string;
};

const fmtCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);

const fmtNumber = (n: number): string => n.toLocaleString('en-IN');

const KPI_EMPTY: AllTransactionsDeepKpis = {
    txnThisMonth: 0,
    saleCount: 0,
    returnCount: 0,
    adjustmentCount: 0,
    topItem: null,
    totalValue: 0,
    monthlySeries: [],
};

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

export default function AllTransactionsDeepPage(): React.JSX.Element {
    const { toast } = useZoruToast();
    const [reportData, setReportData] = useState<Transaction[]>([]);
    const [kpis, setKpis] = useState<AllTransactionsDeepKpis>(KPI_EMPTY);
    const [isLoading, startTransition] = useTransition();

    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [transactionType, setTransactionType] = useState<string>('all');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [reportResult, kpiResult] = await Promise.all([
                generateAllTransactionsReport({
                    startDate,
                    endDate,
                    type: transactionType === 'all' ? undefined : transactionType,
                }),
                getAllTransactionsDeepKpis(),
            ]);
            if (reportResult.error) {
                toast({
                    title: 'Error generating report',
                    description: reportResult.error,
                    variant: 'destructive',
                });
            } else {
                setReportData((reportResult.data as Transaction[]) ?? []);
            }
            setKpis(kpiResult);
        });
    }, [startDate, endDate, transactionType, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const exportRows = useMemo<ExportRow[]>(
        () =>
            reportData.map((d) => ({
                Date: format(new Date(d.date), 'PPP p'),
                Type: d.type,
                Reference: d.reference,
                'Item Name': d.itemName,
                Quantity: d.quantity,
                Warehouse: d.warehouseName || 'N/A',
                Party: d.partyName || 'N/A',
            })),
        [reportData],
    );

    const exportHeaders = [
        'Date',
        'Type',
        'Reference',
        'Item Name',
        'Quantity',
        'Warehouse',
        'Party',
    ];

    const handleCsv = useCallback(() => {
        if (exportRows.length === 0) {
            toast({ title: 'No data', description: 'Nothing to export.' });
            return;
        }
        downloadCsv(
            `inventory_transactions_${dateStamp()}.csv`,
            exportHeaders,
            exportRows,
        );
    }, [exportRows, toast]);

    const handleXlsx = useCallback(() => {
        if (exportRows.length === 0) {
            toast({ title: 'No data', description: 'Nothing to export.' });
            return;
        }
        void downloadXlsx(
            `inventory_transactions_${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'Transactions',
        );
    }, [exportRows, toast]);

    const getTypeTone = (type: string): 'rose-soft' | 'red' | 'neutral' => {
        if (type.includes('Sale') && !type.includes('Return')) return 'rose-soft';
        if (type.includes('Return')) return 'red';
        return 'neutral';
    };

    return (
        <EntityListShell
            title="All inventory transactions"
            subtitle="Every stock movement across sales, returns, and adjustments."
            primaryAction={
                <div className="flex items-center gap-2">
                    <Popover>
                        <ZoruPopoverTrigger asChild>
                            <Button variant="outline">Filters</Button>
                        </ZoruPopoverTrigger>
                        <ZoruPopoverContent className="w-80 space-y-4">
                            <div className="space-y-2">
                                <Label>Start date</Label>
                                <DatePicker value={startDate} onChange={setStartDate} />
                            </div>
                            <div className="space-y-2">
                                <Label>End date</Label>
                                <DatePicker value={endDate} onChange={setEndDate} />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <EnumFilterField
                                    enumName="inventoryTransactionType"
                                    value={transactionType}
                                    onChange={setTransactionType}
                                    allLabel="All types"
                                />
                            </div>
                            <Button onClick={fetchData} disabled={isLoading} className="w-full">
                                Apply
                            </Button>
                        </ZoruPopoverContent>
                    </Popover>
                    <Button
                        variant="outline"
                        onClick={handleCsv}
                        disabled={isLoading || exportRows.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        CSV
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleXlsx}
                        disabled={isLoading || exportRows.length === 0}
                    >
                        XLSX
                    </Button>
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <KpiTile
                    label="Transactions this month"
                    value={fmtNumber(kpis.txnThisMonth)}
                    sub={`Sales ${kpis.saleCount} · Returns ${kpis.returnCount} · Adj ${kpis.adjustmentCount}`}
                    icon={Receipt}
                />
                <KpiTile
                    label="Total value (6 months)"
                    value={fmtCurrency(kpis.totalValue)}
                    icon={BadgeIndianRupee}
                />
                <KpiTile
                    label="Top item by volume"
                    value={kpis.topItem ? kpis.topItem.name : '—'}
                    sub={kpis.topItem ? `${fmtNumber(kpis.topItem.quantity)} units moved` : 'No data'}
                    icon={Package}
                />
                <KpiTile
                    label="Breakdown by type"
                    value={fmtNumber(kpis.saleCount + kpis.returnCount + kpis.adjustmentCount)}
                    sub="Last 6 months"
                    icon={ArrowLeftRight}
                />
            </div>

            <Card className="mt-4">
                <h2 className="text-[16px] font-semibold text-foreground">Monthly volume</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    Transaction count and gross value across the last six months.
                </p>
                <div className="mt-4 h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kpis.monthlySeries}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                                cursor={{ opacity: 0.1 }}
                                formatter={(value, name) => {
                                    const n = Number(value);
                                    return name === 'Value (INR)' ? fmtCurrency(n) : fmtNumber(n);
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="count" name="Transactions" fill="hsl(var(--primary))" />
                            <Bar dataKey="value" name="Value (INR)" fill="hsl(var(--muted-foreground))" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card className="mt-4">
                <h2 className="text-[16px] font-semibold text-foreground">Transaction log</h2>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Item</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Quantity</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Party</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reference</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Warehouse</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={7} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <ZoruTableRow
                                        key={`${row.reference}-${index}`}
                                        className="border-border"
                                    >
                                        <ZoruTableCell className="text-[11.5px] text-foreground">
                                            {format(new Date(row.date), 'PP p')}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-foreground">
                                            {row.itemName}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge variant={getTypeTone(row.type) as any}>
                                                {row.type}
                                            </Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell
                                            className={`font-semibold ${
                                                row.quantity < 0 ? 'text-destructive' : 'text-emerald-500'
                                            }`}
                                        >
                                            {row.quantity}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.partyName || 'N/A'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-[11.5px] text-foreground">
                                            {row.reference}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.warehouseName || 'Default'}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <TrendingDown className="h-6 w-6 text-muted-foreground" />
                                            <Boxes className="hidden h-6 w-6" />
                                            <p>No transactions match the current filters.</p>
                                        </div>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
            </Card>
        </EntityListShell>
    );
}
