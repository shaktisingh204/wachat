'use client';

import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { ArrowDownCircle, ArrowUpCircle, ListChecks, Scale } from 'lucide-react';

import {
    Badge,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    Input,
} from '@/components/zoruui';
import { ReportShell, ReportKpiStrip, type ReportKpiCard } from '@/components/crm/report-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
    getDayBookRange,
    type DayBookTransaction,
} from '@/app/actions/crm-accounting-reports.actions';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { fmtMoney, fmtNumber } from '@/app/dashboard/crm/reports/_components/report-toolbar';

type FiscalChoice = 'current' | 'previous' | 'custom';

function currentFyRange(now: Date): DateRange {
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: new Date(y, 3, 1), to: new Date(y + 1, 2, 31) };
}

function previousFyRange(now: Date): DateRange {
    const cur = currentFyRange(now);
    return {
        from: new Date(cur.from!.getFullYear() - 1, 3, 1),
        to: new Date(cur.from!.getFullYear(), 2, 31),
    };
}

function vendorPathFor(type: DayBookTransaction['type'], id: string): string {
    switch (type) {
        case 'Invoice':
            return `/dashboard/crm/sales-crm/invoices/${id}`;
        case 'Receipt':
            return `/dashboard/crm/sales-crm/payment-receipts/${id}`;
        case 'Bill':
            return `/dashboard/crm/purchases/${id}`;
        case 'Payout':
            return `/dashboard/crm/purchases/payouts/${id}`;
        case 'Expense':
            return `/dashboard/crm/purchases/expenses/${id}`;
        default:
            return '#';
    }
}

const HEADERS = ['Date', 'Type', 'Number', 'Party', 'Flow', 'Amount', 'Status'];

export default function DayBookPage(): React.JSX.Element {
    const [isMounted, setIsMounted] = React.useState(false);
    const [fyChoice, setFyChoice] = React.useState<FiscalChoice>('current');
    const [range, setRange] = React.useState<DateRange | undefined>(undefined);
    const [voucherType, setVoucherType] = React.useState<string>('all');
    const [search, setSearch] = React.useState('');
    const [transactions, setTransactions] = React.useState<DayBookTransaction[]>([]);
    const [totals, setTotals] = React.useState({ in: 0, out: 0 });
    const [countsByType, setCountsByType] = React.useState<Record<string, number>>({});
    const [refreshing, setRefreshing] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [limit, setLimit] = React.useState(20);

    const load = React.useCallback(async () => {
        if (!range?.from || !range?.to) return;
        setRefreshing(true);
        try {
            const data = await getDayBookRange(range.from, range.to);
            setTransactions(data.transactions);
            setTotals({ in: data.totalIn, out: data.totalOut });
            setCountsByType(data.countsByType);
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshing(false);
        }
    }, [range]);

    React.useEffect(() => {
        setIsMounted(true);
        setRange(currentFyRange(new Date()));
    }, []);

    React.useEffect(() => {
        if (isMounted) {
            void load();
        }
    }, [load, isMounted]);

    const handleFyChange = (value: string) => {
        setFyChoice(value as FiscalChoice);
        const now = new Date();
        if (value === 'current') setRange(currentFyRange(now));
        else if (value === 'previous') setRange(previousFyRange(now));
    };

    const handleDateRangeChange = (next: DateRange | undefined) => {
        setRange(next);
        setFyChoice('custom');
    };

    const filtered = React.useMemo(() => {
        let result = voucherType === 'all' ? transactions : transactions.filter((t) => t.type === voucherType);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (t) =>
                    t.partyName.toLowerCase().includes(q) ||
                    t.number.toLowerCase().includes(q) ||
                    t.status.toLowerCase().includes(q)
            );
        }
        return result;
    }, [transactions, voucherType, search]);

    const start = (page - 1) * limit;
    const pageRows = filtered.slice(start, start + limit);
    const hasMore = start + limit < filtered.length;

    const chartData = React.useMemo(
        () =>
            Object.entries(countsByType).map(([type, count]) => ({
                type,
                count,
            })),
        [countsByType],
    );

    const net = totals.in - totals.out;
    const kpis: ReportKpiCard[] = [
        {
            label: 'Total entries',
            value: fmtNumber(transactions.length),
            hint: `${Object.keys(countsByType).length} voucher type(s)`,
            icon: ListChecks,
        },
        {
            label: 'Total debits (In)',
            value: fmtMoney(totals.in),
            tone: 'success',
            icon: ArrowDownCircle,
        },
        {
            label: 'Total credits (Out)',
            value: fmtMoney(totals.out),
            tone: 'danger',
            icon: ArrowUpCircle,
        },
        {
            label: 'Net movement',
            value: fmtMoney(net),
            tone: net >= 0 ? 'success' : 'danger',
            icon: Scale,
        },
    ];

    const exportRows = React.useMemo(
        () =>
            filtered.map((t) => ({
                Date: new Date(t.date).toISOString().slice(0, 10),
                Type: t.type,
                Number: t.number,
                Party: t.partyName,
                Flow: t.flow,
                Amount: t.amount,
                Status: t.status,
            })),
        [filtered],
    );

    const onCsv = () => downloadCsv(`day-book-${dateStamp()}.csv`, HEADERS, exportRows);
    const onXlsx = () => downloadXlsx(`day-book-${dateStamp()}.xlsx`, HEADERS, exportRows, 'Day Book');

    const filters = (
        <div className="flex flex-wrap items-center gap-2">
            <Select value={fyChoice} onValueChange={handleFyChange}>
                <ZoruSelectTrigger className="w-[180px]">
                    <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="current">Current FY (Apr–Mar)</ZoruSelectItem>
                    <ZoruSelectItem value="previous">Previous FY</ZoruSelectItem>
                    <ZoruSelectItem value="custom">Custom range</ZoruSelectItem>
                </ZoruSelectContent>
            </Select>
            <Select value={voucherType} onValueChange={setVoucherType}>
                <ZoruSelectTrigger className="w-[160px]">
                    <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All voucher types</ZoruSelectItem>
                    <ZoruSelectItem value="Invoice">Invoices</ZoruSelectItem>
                    <ZoruSelectItem value="Receipt">Receipts</ZoruSelectItem>
                    <ZoruSelectItem value="Bill">Bills</ZoruSelectItem>
                    <ZoruSelectItem value="Payout">Payouts</ZoruSelectItem>
                    <ZoruSelectItem value="Expense">Expenses</ZoruSelectItem>
                </ZoruSelectContent>
            </Select>
            <Input
                placeholder="Search party or number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[200px]"
            />
        </div>
    );

    const chart = (
        <div>
            <h2 className="text-[15px] font-semibold text-foreground">Entries by voucher type</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
                Distribution of {transactions.length} entries in the selected range.
            </p>
            <div className="mt-4 h-64 w-full">
                {chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
                        No entries in this range.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );

    const table = (
        <Table>
            <ZoruTableHeader>
                <ZoruTableRow className="border-border hover:bg-transparent">
                    <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                    <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                    <ZoruTableHead className="text-muted-foreground">Number</ZoruTableHead>
                    <ZoruTableHead className="text-muted-foreground">Party</ZoruTableHead>
                    <ZoruTableHead className="text-muted-foreground text-right">Amount</ZoruTableHead>
                    <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
                {pageRows.length === 0 ? (
                    <ZoruTableRow className="border-border">
                        <ZoruTableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            No transactions in this range.
                        </ZoruTableCell>
                    </ZoruTableRow>
                ) : (
                    pageRows.map((t) => (
                        <ZoruTableRow key={t.id} className="border-border">
                            <ZoruTableCell className="text-foreground">
                                {new Date(t.date).toLocaleDateString('en-IN')}
                            </ZoruTableCell>
                            <ZoruTableCell className="text-foreground">{t.type}</ZoruTableCell>
                            <ZoruTableCell>
                                <EntityRowLink href={vendorPathFor(t.type, t.id)} label={t.number} />
                            </ZoruTableCell>
                            <ZoruTableCell className="text-foreground">{t.partyName}</ZoruTableCell>
                            <ZoruTableCell
                                className={`text-right font-mono ${t.flow === 'In' ? 'text-emerald-500' : 'text-destructive'}`}
                            >
                                {t.flow === 'In' ? '+' : '-'}
                                {fmtMoney(t.amount)}
                            </ZoruTableCell>
                            <ZoruTableCell>
                                <Badge variant="ghost">{t.status}</Badge>
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ))
                )}
            </ZoruTableBody>
        </Table>
    );

    return (
        <ReportShell
            title="Day Book"
            subtitle="Chronological log of every accounting entry across vouchers, invoices, bills, receipts, payouts and expenses."
            back={{ href: '/dashboard/crm/accounting', label: 'Back to Accounting' }}
            dateRange={range}
            onDateRangeChange={handleDateRangeChange}
            onRefresh={() => void load()}
            refreshing={refreshing}
            onExportCsv={onCsv}
            onExportXlsx={onXlsx}
            filters={filters}
            kpis={<ReportKpiStrip cards={kpis} />}
            chart={chart}
            table={<div className="overflow-x-auto">{isMounted ? table : <div className="h-64 flex items-center justify-center text-muted-foreground">Loading...</div>}</div>}
            pagination={
                <PaginationBar
                    page={page}
                    limit={limit}
                    hasMore={hasMore}
                    total={filtered.length}
                    controlled={{
                        onChange: (next) => {
                            setPage(next.page);
                            setLimit(next.limit);
                        },
                    }}
                />
            }
        />
    );
}
