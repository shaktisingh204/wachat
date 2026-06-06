'use client';

import * as React from 'react';
import { Fragment, useTransition } from 'react';
import type { DateRange } from 'react-day-picker';
import Link from 'next/link';
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
import { AlertCircle, LoaderCircle, Percent, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import {
    Alert,
    ZoruAlertDescription,
    ZoruAlertTitle,
    Button,
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
} from '@/components/sabcrm/20ui/compat';
import { ReportShell, ReportKpiStrip, type ReportKpiCard } from '@/components/crm/report-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { generateIncomeStatementData } from '@/app/actions/crm-accounting.actions';
import {
    getMonthlyRevenueExpense,
    type MonthlyPnLEntry,
} from '@/app/actions/crm-accounting-reports.actions';
import { getSession } from '@/app/actions';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { fmtMoney } from '@/app/dashboard/sabbi/reports/_components/report-toolbar';

type AccountData = { accountName: string; balance: number };
type GroupData = {
    groupName: string;
    category: string;
    accounts: AccountData[];
    total: number;
};
type StatementData = {
    incomeData: GroupData[];
    expenseData: GroupData[];
    netSurplus: number;
};

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

type Row = {
    label: string;
    level: number;
    value?: number;
    kind: 'section' | 'group' | 'account' | 'subtotal' | 'total';
};

function flattenStatement(stmt: StatementData): Row[] {
    const rows: Row[] = [];
    const addSection = (title: string, sectionData: GroupData[]) => {
        rows.push({ label: title, level: 0, kind: 'section' });
        const groupsByCategory = new Map<string, GroupData[]>();
        for (const g of sectionData) {
            const key = g.category.replace(/_/g, ' ');
            const list = groupsByCategory.get(key) ?? [];
            list.push(g);
            groupsByCategory.set(key, list);
        }
        let sectionTotal = 0;
        for (const [category, groups] of groupsByCategory) {
            const subTotal = groups.reduce((s, g) => s + g.total, 0);
            sectionTotal += subTotal;
            rows.push({ label: category, level: 1, kind: 'group', value: -subTotal });
            for (const g of groups) {
                for (const acc of g.accounts) {
                    rows.push({
                        label: acc.accountName,
                        level: 2,
                        kind: 'account',
                        value: -acc.balance,
                    });
                }
            }
        }
        rows.push({ label: `Total ${title}`, level: 0, kind: 'subtotal', value: -sectionTotal });
    };

    addSection('Income', stmt.incomeData);
    addSection('Expense', stmt.expenseData);
    rows.push({ label: 'Net Surplus', level: 0, kind: 'total', value: stmt.netSurplus });
    return rows;
}

const HEADERS = ['Account', 'Level', 'Balance'];

export default function IncomeStatementPage(): React.JSX.Element {
    const now = React.useMemo(() => new Date(), []);
    const [fyChoice, setFyChoice] = React.useState<FiscalChoice>('current');
    const [range, setRange] = React.useState<DateRange | undefined>(() => currentFyRange(now));
    const [data, setData] = React.useState<StatementData | null>(null);
    const [series, setSeries] = React.useState<MonthlyPnLEntry[]>([]);
    const [user, setUser] = React.useState<any>(null);
    const [isLoading, startTransition] = useTransition();
    const [refreshing, setRefreshing] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [limit, setLimit] = React.useState(50);
    const [mounted, setMounted] = React.useState(false);

    const load = React.useCallback(() => {
        if (!range?.from || !range?.to) return;
        startTransition(async () => {
            setRefreshing(true);
            try {
                const [stmt, monthly, session] = await Promise.all([
                    generateIncomeStatementData(range.from, range.to),
                    getMonthlyRevenueExpense(
                        range.from!.getFullYear(),
                        range.from!.getMonth(),
                        range.to!.getFullYear(),
                        range.to!.getMonth(),
                    ),
                    getSession(),
                ]);
                setData(stmt);
                setSeries(monthly);
                setUser(session?.user);
            } finally {
                setRefreshing(false);
            }
        });
    }, [range]);

    React.useEffect(() => {
        setMounted(true);
        load();
    }, [load]);

    const handleFyChange = (value: string) => {
        setFyChoice(value as FiscalChoice);
        if (value === 'current') setRange(currentFyRange(now));
        else if (value === 'previous') setRange(previousFyRange(now));
    };

    const handleDateRangeChange = (next: DateRange | undefined) => {
        setRange(next);
        setFyChoice('custom');
    };

    if (!mounted || (isLoading && !data)) {
        return (
            <div className="flex h-full items-center justify-center py-16">
                <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
            </div>
        );
    }

    if (user && (!user.businessProfile?.name || !user.businessProfile.address)) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Business Profile Incomplete</ZoruAlertTitle>
                <ZoruAlertDescription>
                    Please complete your business profile in the user settings to view accounting reports.
                    <Button asChild variant="link" className="ml-2 h-auto p-0">
                        <Link href="/dashboard/user/settings/profile">Go to Settings</Link>
                    </Button>
                </ZoruAlertDescription>
            </Alert>
        );
    }

    const safe: StatementData = data ?? { incomeData: [], expenseData: [], netSurplus: 0 };
    const totalRevenue = -safe.incomeData.reduce((s, g) => s + g.total, 0);
    const totalExpense = -safe.expenseData.reduce((s, g) => s + g.total, 0);
    const netIncome = safe.netSurplus;
    const operatingMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    const rows = flattenStatement(safe);
    const start = (page - 1) * limit;
    const pageRows = rows.slice(start, start + limit);
    const hasMore = start + limit < rows.length;

    const kpis: ReportKpiCard[] = [
        {
            label: 'Total revenue',
            value: fmtMoney(totalRevenue),
            tone: 'success',
            icon: TrendingUp,
        },
        {
            label: 'Total expenses',
            value: fmtMoney(totalExpense),
            tone: 'danger',
            icon: TrendingDown,
        },
        {
            label: 'Net income',
            value: fmtMoney(netIncome),
            tone: netIncome >= 0 ? 'success' : 'danger',
            icon: Wallet,
        },
        {
            label: 'Operating margin',
            value: `${operatingMargin.toFixed(1)}%`,
            tone: operatingMargin >= 0 ? 'success' : 'danger',
            icon: Percent,
        },
    ];

    const exportRows = rows.map((r) => ({
        Account: r.label,
        Level: r.level,
        Balance: r.value ?? '',
    }));

    const onCsv = () => downloadCsv(`income-statement-${dateStamp()}.csv`, HEADERS, exportRows);
    const onXlsx = () =>
        downloadXlsx(`income-statement-${dateStamp()}.xlsx`, HEADERS, exportRows, 'Income Statement');

    const filters = (
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
    );

    const chart = (
        <div>
            <h2 className="text-[15px] font-semibold text-[var(--st-text)]">
                Monthly revenue vs expense
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Trend line across the selected fiscal range.
            </p>
            <div className="mt-4 h-64 w-full">
                {series.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[13px] text-[var(--st-text-secondary)]">
                        No data in this range.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtMoney(v).replace('₹', '')} />
                            <Tooltip formatter={(v: number) => fmtMoney(v)} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line
                                type="monotone"
                                dataKey="revenue"
                                name="Revenue"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="expense"
                                name="Expense"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="net"
                                name="Net"
                                stroke="#10b981"
                                strokeWidth={2}
                                strokeDasharray="4 3"
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );

    const renderRow = (r: Row, idx: number) => {
        const indent = `${1 + r.level * 1.5}rem`;
        const isSection = r.kind === 'section';
        const isTotal = r.kind === 'total';
        const isSubtotal = r.kind === 'subtotal';
        const cls = isTotal
            ? 'border-[var(--st-border)] bg-[var(--st-bg-muted)] font-semibold'
            : isSection
                ? 'border-[var(--st-border)] bg-[var(--st-bg-muted)] font-semibold'
                : isSubtotal
                    ? 'border-[var(--st-border)] font-semibold'
                    : 'border-[var(--st-border)]';
        return (
            <ZoruTableRow key={`${r.label}-${idx}`} className={cls}>
                <ZoruTableCell className="text-[var(--st-text)]" style={{ paddingLeft: indent }}>
                    {r.label}
                </ZoruTableCell>
                <ZoruTableCell className="text-right font-mono text-[var(--st-text)]">
                    {r.value !== undefined ? fmtMoney(r.value) : ''}
                </ZoruTableCell>
            </ZoruTableRow>
        );
    };

    const table = (
        <Table>
            <ZoruTableHeader>
                <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Account</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)] text-right">Balance</ZoruTableHead>
                </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
                {pageRows.length === 0 ? (
                    <ZoruTableRow className="border-[var(--st-border)]">
                        <ZoruTableCell colSpan={2} className="h-24 text-center text-[var(--st-text-secondary)]">
                            No accounts in this range.
                        </ZoruTableCell>
                    </ZoruTableRow>
                ) : (
                    pageRows.map((r, i) => <Fragment key={i}>{renderRow(r, i)}</Fragment>)
                )}
            </ZoruTableBody>
        </Table>
    );

    return (
        <ReportShell
            title="Income Statement"
            subtitle="Profitability snapshot grouped by income & expense accounts for the selected fiscal range."
            back={{ href: '/dashboard/crm/accounting', label: 'Back to Accounting' }}
            dateRange={range}
            onDateRangeChange={handleDateRangeChange}
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
                    total={rows.length}
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
