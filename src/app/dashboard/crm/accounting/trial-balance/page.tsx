'use client';

import * as React from 'react';
import { useTransition } from 'react';
import type { DateRange } from 'react-day-picker';
import Link from 'next/link';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AlertCircle,
    CheckCircle2,
    LoaderCircle,
    Scale,
    XCircle,
    FileText,
} from 'lucide-react';

import {
    Alert,
    ZoruAlertDescription,
    ZoruAlertTitle,
    Button,
    Label,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Switch,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    Sheet,
    ZoruSheetContent,
    ZoruSheetHeader,
    ZoruSheetTitle,
    ZoruSheetDescription,
    Badge,
    Card,
} from '@/components/zoruui';
import { ReportShell, ReportKpiStrip, type ReportKpiCard } from '@/components/crm/report-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { generateTrialBalanceData, getVoucherEntriesForAccount } from '@/app/actions/crm-accounting.actions';
import { getSession } from '@/app/actions';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { fmtMoney, fmtNumber } from '@/app/dashboard/crm/reports/_components/report-toolbar';

type TrialBalanceEntry = {
    accountId: string;
    accountName: string;
    openingBalance: number;
    openingBalanceType: 'Cr' | 'Dr';
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    closingBalanceType: 'Cr' | 'Dr';
};

type Totals = {
    totalOpening: number;
    totalDebit: number;
    totalCredit: number;
    totalClosing: number;
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

const HEADERS = ['Account', 'Opening', 'Debit', 'Credit', 'Closing'];

export default function TrialBalancePage(): React.JSX.Element {
    const now = React.useMemo(() => new Date(), []);
    const [fyChoice, setFyChoice] = React.useState<FiscalChoice>('current');
    const [range, setRange] = React.useState<DateRange | undefined>(() => currentFyRange(now));
    const [entries, setEntries] = React.useState<TrialBalanceEntry[]>([]);
    const [totals, setTotals] = React.useState<Totals>({
        totalOpening: 0,
        totalDebit: 0,
        totalCredit: 0,
        totalClosing: 0,
    });
    const [user, setUser] = React.useState<any>(null);
    const [hideZero, setHideZero] = React.useState(false);
    const [isLoading, startTransition] = useTransition();
    const [refreshing, setRefreshing] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const [limit, setLimit] = React.useState(20);

    // General Ledger Drawer State
    const [selectedAccount, setSelectedAccount] = React.useState<TrialBalanceEntry | null>(null);
    const [voucherEntries, setVoucherEntries] = React.useState<any[]>([]);
    const [isLoadingEntries, setIsLoadingEntries] = React.useState(false);

    const loadEntries = React.useCallback(async (accountId: string) => {
        setIsLoadingEntries(true);
        try {
            const entries = await getVoucherEntriesForAccount(accountId);
            setVoucherEntries(entries);
        } catch (err) {
            console.error('[TrialBalance] failed to load voucher entries:', err);
        } finally {
            setIsLoadingEntries(false);
        }
    }, []);

    React.useEffect(() => {
        if (selectedAccount) {
            loadEntries(selectedAccount.accountId);
        } else {
            setVoucherEntries([]);
        }
    }, [selectedAccount, loadEntries]);

    const load = React.useCallback(() => {
        if (!range?.from || !range?.to) return;
        startTransition(async () => {
            setRefreshing(true);
            try {
                const [result, session] = await Promise.all([
                    generateTrialBalanceData(range.from, range.to),
                    getSession(),
                ]);
                if (result) {
                    setEntries(result.data as TrialBalanceEntry[]);
                    setTotals(result.totals as Totals);
                }
                setUser(session?.user);
            } finally {
                setRefreshing(false);
            }
        });
    }, [range]);

    React.useEffect(() => {
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

    if (isLoading && entries.length === 0) {
        return (
            <div className="flex h-full items-center justify-center py-16">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
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

    const filteredEntries = hideZero
        ? entries.filter((e) => e.totalDebit > 0 || e.totalCredit > 0)
        : entries;

    const inBalance = Math.abs(totals.totalDebit - totals.totalCredit) < 0.01;
    const outOfBalanceCount = filteredEntries.filter(
        (e) => Math.abs(e.totalDebit - e.totalCredit) > 0.01 && (e.totalDebit > 0 || e.totalCredit > 0),
    ).length;

    const kpis: ReportKpiCard[] = [
        {
            label: 'Total debits',
            value: fmtMoney(totals.totalDebit),
            tone: 'default',
            icon: Scale,
        },
        {
            label: 'Total credits',
            value: fmtMoney(totals.totalCredit),
            tone: 'default',
            icon: Scale,
        },
        {
            label: 'In balance?',
            value: inBalance ? 'Yes' : 'No',
            hint: inBalance ? 'Debits = credits' : `Diff ${fmtMoney(totals.totalDebit - totals.totalCredit)}`,
            tone: inBalance ? 'success' : 'danger',
            icon: inBalance ? CheckCircle2 : XCircle,
        },
        {
            label: 'Out-of-balance accounts',
            value: fmtNumber(outOfBalanceCount),
            tone: outOfBalanceCount === 0 ? 'success' : 'warning',
            icon: AlertCircle,
        },
    ];

    const start = (page - 1) * limit;
    const pageRows = filteredEntries.slice(start, start + limit);
    const hasMore = start + limit < filteredEntries.length;

    const exportRows = filteredEntries.map((e) => ({
        Account: e.accountName,
        Opening: `${Math.abs(e.openingBalance).toFixed(2)} ${e.openingBalanceType}`,
        Debit: e.totalDebit,
        Credit: e.totalCredit,
        Closing: `${Math.abs(e.closingBalance).toFixed(2)} ${e.closingBalanceType}`,
    }));

    const onCsv = () => downloadCsv(`trial-balance-${dateStamp()}.csv`, HEADERS, exportRows);
    const onXlsx = () =>
        downloadXlsx(`trial-balance-${dateStamp()}.xlsx`, HEADERS, exportRows, 'Trial Balance');

    const chartDataRaw = filteredEntries
        .slice()
        .sort((a, b) => Math.abs(b.closingBalance) - Math.abs(a.closingBalance));

    const chartData = chartDataRaw
        .slice(0, 12)
        .map((e) => ({
            name: e.accountName.length > 18 ? `${e.accountName.slice(0, 16)}…` : e.accountName,
            value: e.closingBalance * (e.closingBalanceType === 'Dr' ? 1 : -1),
        }));

    if (chartDataRaw.length > 12) {
        const remaining = chartDataRaw.slice(12);
        const othersDr = remaining.filter((e) => e.closingBalanceType === 'Dr').reduce((sum, e) => sum + e.closingBalance, 0);
        const othersCr = remaining.filter((e) => e.closingBalanceType === 'Cr').reduce((sum, e) => sum + e.closingBalance, 0);
        
        if (othersDr > 0) {
            chartData.push({ name: 'Others (Dr)', value: othersDr });
        }
        if (othersCr > 0) {
            chartData.push({ name: 'Others (Cr)', value: -othersCr });
        }
    }

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
            <div className="flex items-center gap-2">
                <Switch id="hide-zero-tb" checked={hideZero} onCheckedChange={setHideZero} />
                <Label htmlFor="hide-zero-tb" className="text-[12.5px] text-foreground">
                    Hide zero-entry accounts
                </Label>
            </div>
        </div>
    );

    const chart = (
        <div>
            <h2 className="text-[15px] font-semibold text-foreground">Top accounts by closing balance</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
                Horizontal bars — positive values are Dr balances, negative are Cr.
            </p>
            <div className="mt-4 h-72 w-full">
                {chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
                        No balances to plot.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ top: 8, right: 24, left: 24, bottom: 8 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis
                                type="number"
                                tick={{ fontSize: 11 }}
                                tickFormatter={(v: number) => fmtMoney(v).replace('₹', '')}
                            />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                            <Tooltip formatter={(v: number) => fmtMoney(v)} />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
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
                    <ZoruTableHead className="text-muted-foreground">Account</ZoruTableHead>
                    <ZoruTableHead className="text-muted-foreground text-right">Opening</ZoruTableHead>
                    <ZoruTableHead className="text-muted-foreground text-right">Debit</ZoruTableHead>
                    <ZoruTableHead className="text-muted-foreground text-right">Credit</ZoruTableHead>
                    <ZoruTableHead className="text-muted-foreground text-right">Closing</ZoruTableHead>
                </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
                {pageRows.length === 0 ? (
                    <ZoruTableRow className="border-border">
                        <ZoruTableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            No accounts to display.
                        </ZoruTableCell>
                    </ZoruTableRow>
                ) : (
                    pageRows.map((e) => (
                        <ZoruTableRow key={e.accountId} className="border-border">
                            <ZoruTableCell>
                                <div className="flex items-center gap-2">
                                    <EntityRowLink
                                        href={`/dashboard/crm/accounting/charts/${e.accountId}`}
                                        label={e.accountName}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                                        onClick={() => setSelectedAccount(e)}
                                        title="View General Ledger"
                                    >
                                        <FileText className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </ZoruTableCell>
                            <ZoruTableCell className="text-right font-mono text-foreground">
                                {Math.abs(e.openingBalance).toFixed(2)} {e.openingBalanceType}
                            </ZoruTableCell>
                            <ZoruTableCell className="text-right font-mono text-foreground">
                                {fmtMoney(e.totalDebit)}
                            </ZoruTableCell>
                            <ZoruTableCell className="text-right font-mono text-foreground">
                                {fmtMoney(e.totalCredit)}
                            </ZoruTableCell>
                            <ZoruTableCell className="text-right font-mono font-semibold text-foreground">
                                {Math.abs(e.closingBalance).toFixed(2)} {e.closingBalanceType}
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ))
                )}
                <ZoruTableRow className="border-border bg-secondary font-semibold">
                    <ZoruTableCell className="text-foreground">Total</ZoruTableCell>
                    <ZoruTableCell className="text-right font-mono text-foreground">
                        {Math.abs(totals.totalOpening).toFixed(2)} {totals.totalOpening >= 0 ? 'Dr' : 'Cr'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right font-mono text-foreground">
                        {fmtMoney(totals.totalDebit)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right font-mono text-foreground">
                        {fmtMoney(totals.totalCredit)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right font-mono text-foreground">
                        {Math.abs(totals.totalClosing).toFixed(2)} {totals.totalClosing >= 0 ? 'Dr' : 'Cr'}
                    </ZoruTableCell>
                </ZoruTableRow>
            </ZoruTableBody>
        </Table>
    );

    return (
        <>
            <ReportShell
                title="Trial Balance"
                subtitle="Debit/credit summary across every account for the selected fiscal range."
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
                        total={filteredEntries.length}
                        pageSizes={[10, 20, 50, 100, 250]}
                        controlled={{
                            onChange: (next) => {
                                setPage(next.page);
                                setLimit(next.limit);
                            },
                        }}
                    />
                }
            />

            {/* General Ledger Sliding Drawer */}
            <Sheet open={!!selectedAccount} onOpenChange={(open) => { if (!open) setSelectedAccount(null); }}>
                <ZoruSheetContent side="right" className="sm:max-w-md md:max-w-lg w-full flex flex-col h-full bg-background border-l border-border p-0">
                    <div className="p-6 border-b border-border">
                        <ZoruSheetHeader className="pr-8">
                            <ZoruSheetTitle className="text-[16px] font-bold text-foreground flex flex-wrap items-center gap-2">
                                <span>{selectedAccount?.accountName}</span>
                            </ZoruSheetTitle>
                            <ZoruSheetDescription className="text-[12.5px] text-muted-foreground mt-1">
                                General Ledger Vouchers &amp; Transaction Entries
                            </ZoruSheetDescription>
                        </ZoruSheetHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {selectedAccount && (
                            <div className="bg-secondary p-4 rounded-lg border border-border flex justify-between items-center">
                                <div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current Balance</div>
                                    <div className="text-[18px] font-mono font-bold text-foreground mt-0.5">
                                        {fmtMoney(selectedAccount.closingBalance)} {selectedAccount.closingBalanceType ?? 'Dr'}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                <span>Voucher Entries Feed</span>
                                {!isLoadingEntries && (
                                    <Badge variant="ghost">
                                        {voucherEntries.length} {voucherEntries.length === 1 ? 'entry' : 'entries'}
                                    </Badge>
                                )}
                            </h4>
                            
                            {isLoadingEntries ? (
                                <div className="flex justify-center p-8">
                                    <span className="text-[12px] text-muted-foreground font-medium">Fetching general ledger...</span>
                                </div>
                            ) : voucherEntries.length === 0 ? (
                                <Card className="p-8 text-center text-[12.5px] text-muted-foreground">
                                    No voucher entries found for this account.
                                </Card>
                            ) : (
                                <div className="space-y-3">
                                    {voucherEntries.map((entry) => (
                                        <Card key={entry._id} className="p-3 bg-card hover:bg-secondary transition-colors border border-border">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="font-mono text-[11px] font-medium text-muted-foreground">
                                                    {new Date(entry.date).toLocaleDateString()}
                                                </div>
                                                <div className="font-mono text-[10px] bg-secondary border border-border px-1.5 py-0.5 rounded text-foreground">
                                                    {entry.voucherNumber}
                                                </div>
                                            </div>
                                            <div className="text-[13px] text-foreground font-medium leading-tight mb-2">
                                                {entry.note || 'No description provided'}
                                            </div>
                                            <div className="flex items-center justify-between border-t border-border pt-2 mt-2">
                                                <div className="text-[11px] text-muted-foreground">
                                                    Amount
                                                </div>
                                                <div className="flex gap-4">
                                                    {entry.debit > 0 && (
                                                        <div className="text-right">
                                                            <span className="text-[10px] text-muted-foreground mr-1.5 uppercase font-bold">Dr</span>
                                                            <span className="font-mono text-[13px] text-foreground font-bold">{fmtMoney(entry.debit)}</span>
                                                        </div>
                                                    )}
                                                    {entry.credit > 0 && (
                                                        <div className="text-right">
                                                            <span className="text-[10px] text-muted-foreground mr-1.5 uppercase font-bold">Cr</span>
                                                            <span className="font-mono text-[13px] text-foreground font-bold">{fmtMoney(entry.credit)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ZoruSheetContent>
            </Sheet>
        </>
    );
}
