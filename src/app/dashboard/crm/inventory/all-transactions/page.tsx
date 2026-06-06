'use client';

import { fmtINR, fmtDate } from "@/lib/utils";
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
    BarChart, PieChart, Pie, Cell,
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
    MoreHorizontal,
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
    Suspense,
} from 'react';

import {
    generateAllTransactionsReport,
    type InventoryTransactionDto,
} from '@/app/actions/crm-reports.actions';
import {
    getAllTransactionsDeepKpis,
    type AllTransactionsDeepKpis,
} from '@/app/actions/crm-inventory.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { Badge, Button, Card, DatePicker, Label, Popover, PopoverContent, PopoverTrigger, Table, TBody, Td, Th, THead, Tr, useToast, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';
import {
    dateStamp,
    downloadCsv,
    downloadXlsx,
    type ExportRow,
} from '@/lib/crm-list-export';



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
                <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">{label}</p>
                <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
            </div>
            <p className="mt-2 truncate text-[22px] font-semibold text-[var(--st-text)]">{value}</p>
            {sub ? <p className="mt-0.5 truncate text-[11.5px] text-[var(--st-text-secondary)]">{sub}</p> : null}
        </Card>
    );
}

function AllTransactionsDeepContent(): React.JSX.Element {
    const { toast } = useToast();
    const [reportData, setReportData] = useState<InventoryTransactionDto[]>([]);
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
                setReportData(reportResult.data ?? []);
            }
            setKpis(kpiResult);
        });
    }, [startDate, endDate, transactionType, toast]);

    useEffect(() => {
        fetchData();

        // Real-time updates using WebSockets for live inventory tracking
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/realtime/inventory`);
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'inventory-update') {
                    toast({
                        title: 'Live Update',
                        description: 'New inventory transaction recorded.',
                    });
                    fetchData();
                }
            } catch (err) {
                console.error('Failed to parse websocket message', err);
            }
        };

        return () => {
            ws.close();
        };
    }, [fetchData, toast]);

    const exportRows = useMemo<ExportRow[]>(
        () =>
            reportData.map((d) => ({
                Date: fmtDate(d.date),
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

    const getTypeTone = (type: string): 'default' | 'destructive' | 'secondary' => {
        if (type.includes('Sale') && !type.includes('Return')) return 'default';
        if (type.includes('Return')) return 'destructive';
        return 'secondary';
    };

    return (
        <EntityListShell
            title="All inventory transactions"
            subtitle="Every stock movement across sales, returns, and adjustments."
            primaryAction={
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline">Filters</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 space-y-4">
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
                        </PopoverContent>
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
                    value={fmtINR(kpis.totalValue)}
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

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Monthly volume</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
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
                                        return name === 'Value (INR)' ? fmtINR(n) : fmtNumber(n);
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="count" name="Transactions" fill="hsl(var(--primary))" />
                                <Bar dataKey="value" name="Value (INR)" fill="hsl(var(--muted-foreground))" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                
                <Card>
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Transaction Breakdown</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                        Distribution of transaction types over the selected period.
                    </p>
                    <div className="mt-4 h-[260px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Sales', value: kpis.saleCount },
                                        { name: 'Returns', value: kpis.returnCount },
                                        { name: 'Adjustments', value: kpis.adjustmentCount }
                                    ].filter(d => d.value > 0)}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="hsl(var(--primary))" />
                                    <Cell fill="hsl(var(--destructive))" />
                                    <Cell fill="hsl(var(--secondary))" />
                                </Pie>
                                <Tooltip formatter={(value) => fmtNumber(Number(value))} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            <Card className="mt-4">
                <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Transaction log</h2>
                <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <Th className="text-[var(--st-text-secondary)]">Date</Th>
                                <Th className="text-[var(--st-text-secondary)]">Item</Th>
                                <Th className="text-[var(--st-text-secondary)]">Type</Th>
                                <Th className="text-[var(--st-text-secondary)]">Quantity</Th>
                                <Th className="text-[var(--st-text-secondary)]">Party</Th>
                                <Th className="text-[var(--st-text-secondary)]">Reference</Th>
                                <Th className="text-[var(--st-text-secondary)]">Warehouse</Th>
                                <Th className="w-[50px]"></Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {isLoading ? (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={8} className="h-48 text-center">
                                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
                                    </Td>
                                </Tr>
                            ) : reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <Tr
                                        key={`${row.reference}-${index}`}
                                        className="border-[var(--st-border)]"
                                    >
                                        <Td className="text-[11.5px] text-[var(--st-text)]">
                                            {fmtDate(row.date)}
                                        </Td>
                                        <Td className="font-medium text-[var(--st-text)]">
                                            {row.itemName}
                                        </Td>
                                        <Td>
                                            <Badge variant={getTypeTone(row.type)}>
                                                {row.type}
                                            </Badge>
                                        </Td>
                                        <Td
                                            className={`font-semibold ${
                                                row.quantity < 0 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'
                                            }`}
                                        >
                                            {row.quantity}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.partyName || 'N/A'}
                                        </Td>
                                        <Td className="font-mono text-[11.5px] text-[var(--st-text)]">
                                            {row.reference}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.warehouseName || 'Default'}
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
                                                            navigator.clipboard.writeText(row.reference);
                                                            toast({ title: 'Copied', description: 'Reference copied to clipboard.' });
                                                        }}
                                                    >
                                                        Copy reference
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>View details</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </Td>
                                    </Tr>
                                ))
                            ) : (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={8} className="h-48 text-center text-[var(--st-text-secondary)]">
                                        <div className="flex flex-col items-center gap-2">
                                            <TrendingDown className="h-6 w-6 text-[var(--st-text-secondary)]" />
                                            <Boxes className="hidden h-6 w-6" />
                                            <p>No transactions match the current filters.</p>
                                        </div>
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

export default function AllTransactionsDeepPage(): React.JSX.Element {
    return (
        <Suspense fallback={null}>
            <AllTransactionsDeepContent />
        </Suspense>
    );
}
