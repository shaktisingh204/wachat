'use client';

import * as React from 'react';
import { useTransition } from 'react';
import {
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { Banknote, LoaderCircle, PieChart as PieChartIcon, Scale, ShieldCheck } from 'lucide-react';

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
} from '@/components/sabcrm/20ui/compat';
import { ReportShell, ReportKpiStrip, type ReportKpiCard } from '@/components/crm/report-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { generateBalanceSheetData } from '@/app/actions/crm-accounting.actions';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { fmtMoney } from '@/app/dashboard/sabbi/reports/_components/report-toolbar';

type Summary = {
    totalAssets: number;
    totalLiabilities: number;
    totalCapital: number;
    debtToEquity: number;
};
type Entry = { account: string; amount: number; isMain?: boolean; isSub?: boolean };
type BalanceData = { summary: Summary; entries: Entry[] };

const HEADERS = ['Account', 'Amount', 'Share (%)'];

const PIE_COLORS = ['hsl(var(--primary))', '#f97316', '#10b981'];

export default function BalanceSheetPage(): React.JSX.Element {
    const [data, setData] = React.useState<BalanceData | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [refreshing, setRefreshing] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [limit, setLimit] = React.useState(20);
    const [asOf, setAsOf] = React.useState<'current' | 'previous'>('current');
    const [isMounted, setIsMounted] = React.useState(false);

    const load = React.useCallback(() => {
        startTransition(async () => {
            setRefreshing(true);
            try {
                const result = await generateBalanceSheetData();
                setData(result as BalanceData | null);
            } finally {
                setRefreshing(false);
            }
        });
    }, []);

    React.useEffect(() => {
        setIsMounted(true);
        load();
    }, [load]);

    if (!isMounted) {
        return (
            <div className="flex h-full items-center justify-center py-16">
                <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
            </div>
        );
    }

    if (isLoading && !data) {
        return (
            <div className="flex h-full items-center justify-center py-16">
                <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
            </div>
        );
    }

    const safeSummary: Summary = data?.summary ?? {
        totalAssets: 0,
        totalLiabilities: 0,
        totalCapital: 0,
        debtToEquity: 0,
    };
    const entries: Entry[] = data?.entries ?? [];

    const currentAssets = safeSummary.totalAssets;
    const currentRatio = safeSummary.totalLiabilities !== 0
        ? currentAssets / safeSummary.totalLiabilities
        : 0;

    const totalAll =
        Math.abs(safeSummary.totalAssets) +
        Math.abs(safeSummary.totalLiabilities) +
        Math.abs(safeSummary.totalCapital);

    const kpis: ReportKpiCard[] = [
        {
            label: 'Total assets',
            value: fmtMoney(safeSummary.totalAssets),
            tone: 'success',
            icon: Banknote,
        },
        {
            label: 'Total liabilities',
            value: fmtMoney(safeSummary.totalLiabilities),
            tone: 'warning',
            icon: Scale,
        },
        {
            label: 'Equity (capital)',
            value: fmtMoney(safeSummary.totalCapital),
            icon: ShieldCheck,
        },
        {
            label: 'Current ratio',
            value: currentRatio.toFixed(2),
            hint: currentRatio >= 1 ? 'Healthy liquidity' : 'Watch liquidity',
            tone: currentRatio >= 1 ? 'success' : 'warning',
            icon: PieChartIcon,
        },
    ];

    const pieData = [
        { name: 'Assets', value: Math.abs(safeSummary.totalAssets) },
        { name: 'Liabilities', value: Math.abs(safeSummary.totalLiabilities) },
        { name: 'Equity', value: Math.abs(safeSummary.totalCapital) },
    ].filter((d) => d.value > 0);

    const start = (page - 1) * limit;
    const pageRows = entries.slice(start, start + limit);
    const hasMore = start + limit < entries.length;

    const exportRows = entries.map((entry) => ({
        Account: entry.isSub ? `  ${entry.account}` : entry.account,
        Amount: entry.amount,
        'Share (%)': totalAll > 0 ? ((Math.abs(entry.amount) / totalAll) * 100).toFixed(2) : '0.00',
    }));

    const onCsv = () => downloadCsv(`balance-sheet-${dateStamp()}.csv`, HEADERS, exportRows);
    const onXlsx = () =>
        downloadXlsx(`balance-sheet-${dateStamp()}.xlsx`, HEADERS, exportRows, 'Balance Sheet');

    const chart = (
        <div>
            <h2 className="text-[15px] font-semibold text-zoru-ink">Composition</h2>
            <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Assets vs liabilities vs equity (absolute values).
            </p>
            <div className="mt-4 h-64 w-full">
                {pieData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[13px] text-zoru-ink-muted">
                        Nothing to plot yet.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={50}
                                outerRadius={90}
                                paddingAngle={2}
                            >
                                {pieData.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => fmtMoney(v)} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );

    const table = (
        <Table>
            <TableHeader>
                <TableRow className="border-zoru-line hover:bg-transparent">
                    <TableHead className="text-zoru-ink-muted">Account</TableHead>
                    <TableHead className="text-zoru-ink-muted text-right">Amount</TableHead>
                    <TableHead className="text-zoru-ink-muted text-right">Share (%)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pageRows.length === 0 ? (
                    <TableRow className="border-zoru-line">
                        <TableCell colSpan={3} className="h-24 text-center text-zoru-ink-muted">
                            No accounts to display.
                        </TableCell>
                    </TableRow>
                ) : (
                    pageRows.map((entry, idx) => {
                        const share = totalAll > 0 ? ((Math.abs(entry.amount) / totalAll) * 100).toFixed(2) : '0.00';
                        return (
                            <TableRow
                                key={`${entry.account}-${idx}`}
                                className={`border-zoru-line ${entry.isMain ? 'bg-zoru-surface-2 font-semibold' : ''}`}
                            >
                                <TableCell className={`text-zoru-ink ${entry.isSub ? 'pl-8' : ''}`}>
                                    {entry.account}
                                </TableCell>
                                <TableCell className="text-right font-mono text-zoru-ink">
                                    {fmtMoney(entry.amount)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-zoru-ink">
                                    {share}%
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </Table>
    );

    // Note: balance-sheet is a point-in-time report — no date range, but we
    // still offer Current vs Previous FY snapshot via filters slot.
    const filters = (
        <Select value={asOf} onValueChange={(val) => setAsOf(val as 'current' | 'previous')}>
            <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Snapshot date" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="current">As of today</SelectItem>
                <SelectItem value="previous">As of FY end (prior)</SelectItem>
            </SelectContent>
        </Select>
    );

    return (
        <ReportShell
            title="Balance Sheet"
            subtitle="Point-in-time snapshot of assets, liabilities, and equity."
            back={{ href: '/dashboard/crm/accounting', label: 'Back to Accounting' }}
            onRefresh={load}
            refreshing={refreshing || isLoading}
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
                    total={entries.length}
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
