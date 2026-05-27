'use client';

import * as React from 'react';
import type { DateRange } from 'react-day-picker';
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
import { ArrowDownCircle, ArrowUpCircle, Banknote, Wallet } from 'lucide-react';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/zoruui';
import { ReportShell, ReportKpiStrip, type ReportKpiCard } from '@/components/crm/report-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
    getCashFlowReport,
    type CashFlowCategoryEntry,
} from '@/app/actions/crm-accounting-reports.actions';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { fmtMoney } from '@/app/dashboard/sabbi/reports/_components/report-toolbar';

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

const HEADERS = ['Month', 'Operating', 'Investing', 'Financing', 'Inflow', 'Outflow', 'Net'];

export default function CashFlowPage(): React.JSX.Element {
    const [fyChoice, setFyChoice] = React.useState<FiscalChoice>('current');
    const [range, setRange] = React.useState<DateRange | undefined>();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        setRange(currentFyRange(new Date()));
    }, []);
    const [period, setPeriod] = React.useState<'monthly' | 'quarterly'>('monthly');
    const [monthly, setMonthly] = React.useState<CashFlowCategoryEntry[]>([]);
    const [opening, setOpening] = React.useState(0);
    const [closing, setClosing] = React.useState(0);
    const [totalIn, setTotalIn] = React.useState(0);
    const [totalOut, setTotalOut] = React.useState(0);
    const [refreshing, setRefreshing] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [limit, setLimit] = React.useState(20);

    const load = React.useCallback(async () => {
        if (!range?.from || !range?.to) return;
        setRefreshing(true);
        try {
            const data = await getCashFlowReport(
                range.from.getFullYear(),
                range.from.getMonth(),
                range.to.getFullYear(),
                range.to.getMonth(),
            );
            setMonthly(data.monthly);
            setOpening(data.openingCash);
            setClosing(data.closingCash);
            setTotalIn(data.totalIn);
            setTotalOut(data.totalOut);
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshing(false);
        }
    }, [range]);

    React.useEffect(() => {
        void load();
    }, [load]);

    if (!mounted) {
        return null;
    }

    const aggregated = React.useMemo(() => {
        if (period === 'monthly') return monthly;
        // Quarterly aggregation
        const out: CashFlowCategoryEntry[] = [];
        for (let i = 0; i < monthly.length; i += 3) {
            const slice = monthly.slice(i, i + 3);
            if (slice.length === 0) continue;
            const label = `${slice[0].month}–${slice[slice.length - 1].month}`;
            out.push(
                slice.reduce<CashFlowCategoryEntry>(
                    (acc, m) => ({
                        month: acc.month,
                        operating: acc.operating + m.operating,
                        investing: acc.investing + m.investing,
                        financing: acc.financing + m.financing,
                        inflow: acc.inflow + m.inflow,
                        outflow: acc.outflow + m.outflow,
                        net: acc.net + m.net,
                    }),
                    { month: label, operating: 0, investing: 0, financing: 0, inflow: 0, outflow: 0, net: 0 },
                ),
            );
        }
        return out;
    }, [monthly, period]);

    const handleFyChange = (value: string) => {
        setFyChoice(value as FiscalChoice);
        if (value === 'current') setRange(currentFyRange(new Date()));
        else if (value === 'previous') setRange(previousFyRange(new Date()));
    };

    const handleDateRangeChange = (next: DateRange | undefined) => {
        setRange(next);
        setFyChoice('custom');
    };

    const start = (page - 1) * limit;
    const pageRows = aggregated.slice(start, start + limit);
    const hasMore = start + limit < aggregated.length;

    const kpis: ReportKpiCard[] = [
        {
            label: 'Opening cash',
            value: fmtMoney(opening),
            hint: 'Carried from prior periods',
            icon: Wallet,
        },
        {
            label: 'Total inflow',
            value: fmtMoney(totalIn),
            tone: 'success',
            icon: ArrowDownCircle,
        },
        {
            label: 'Total outflow',
            value: fmtMoney(totalOut),
            tone: 'danger',
            icon: ArrowUpCircle,
        },
        {
            label: 'Closing cash',
            value: fmtMoney(closing),
            tone: closing >= 0 ? 'success' : 'danger',
            icon: Banknote,
        },
    ];

    const exportRows = React.useMemo(
        () =>
            aggregated.map((m) => ({
                Month: m.month,
                Operating: m.operating,
                Investing: m.investing,
                Financing: m.financing,
                Inflow: m.inflow,
                Outflow: m.outflow,
                Net: m.net,
            })),
        [aggregated],
    );

    const onCsv = () => downloadCsv(`cash-flow-${dateStamp()}.csv`, HEADERS, exportRows);
    const onXlsx = () =>
        downloadXlsx(`cash-flow-${dateStamp()}.xlsx`, HEADERS, exportRows, 'Cash Flow');

    const filters = (
        <div className="flex flex-wrap items-center gap-2">
            <Select value={fyChoice} onValueChange={handleFyChange}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="current">Current FY (Apr–Mar)</SelectItem>
                    <SelectItem value="previous">Previous FY</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger className="w-[150px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );

    const chart = (
        <div>
            <h2 className="text-[15px] font-semibold text-zoru-ink">
                Cash flow by category (stacked)
            </h2>
            <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Operating / investing / financing components per {period === 'monthly' ? 'month' : 'quarter'}.
            </p>
            <div className="mt-4 h-72 w-full">
                {aggregated.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[13px] text-zoru-ink-muted">
                        No cash movement in this range.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aggregated} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtMoney(v).replace('₹', '')} />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                formatter={(v: number) => fmtMoney(v)}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar stackId="cf" dataKey="operating" name="Operating" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                            <Bar stackId="cf" dataKey="investing" name="Investing" fill="#f97316" radius={[0, 0, 0, 0]} />
                            <Bar stackId="cf" dataKey="financing" name="Financing" fill="#a855f7" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );

    const table = (
        <Table>
            <TableHeader>
                <TableRow className="border-zoru-line hover:bg-transparent">
                    <TableHead className="text-zoru-ink-muted">Period</TableHead>
                    <TableHead className="text-zoru-ink-muted text-right">Operating</TableHead>
                    <TableHead className="text-zoru-ink-muted text-right">Investing</TableHead>
                    <TableHead className="text-zoru-ink-muted text-right">Financing</TableHead>
                    <TableHead className="text-zoru-ink-muted text-right">Inflow</TableHead>
                    <TableHead className="text-zoru-ink-muted text-right">Outflow</TableHead>
                    <TableHead className="text-zoru-ink-muted text-right">Net</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pageRows.length === 0 ? (
                    <TableRow className="border-zoru-line">
                        <TableCell colSpan={7} className="h-24 text-center text-zoru-ink-muted">
                            No data in this range.
                        </TableCell>
                    </TableRow>
                ) : (
                    pageRows.map((m) => (
                        <TableRow key={m.month} className="border-zoru-line">
                            <TableCell className="font-medium text-zoru-ink">{m.month}</TableCell>
                            <TableCell className="text-right font-mono text-zoru-ink">
                                {fmtMoney(m.operating)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-zoru-ink">
                                {fmtMoney(m.investing)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-zoru-ink">
                                {fmtMoney(m.financing)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-zoru-ink">
                                {fmtMoney(m.inflow)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-zoru-ink">
                                {fmtMoney(m.outflow)}
                            </TableCell>
                            <TableCell
                                className={`text-right font-mono font-semibold ${m.net >= 0 ? 'text-zoru-ink' : 'text-zoru-ink'}`}
                            >
                                {fmtMoney(m.net)}
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    return (
        <ReportShell
            title="Cash Flow Statement"
            subtitle="Operating, investing, and financing cash movements with opening and closing cash positions."
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
            table={<div className="overflow-x-auto">{table}</div>}
            pagination={
                <PaginationBar
                    page={page}
                    limit={limit}
                    hasMore={hasMore}
                    total={aggregated.length}
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
