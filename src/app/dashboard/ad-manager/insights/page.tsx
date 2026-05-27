'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  Input,
  Label,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Eye,
  MousePointerClick,
  Users,
  Download,
  RefreshCcw,
  Search,
  ArrowUpDown,
} from 'lucide-react';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { cn } from '@/lib/utils';
import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from '@/context/ad-manager-shell-context';
import { getInsights } from '@/app/actions/ad-manager.actions';
import { formatMoney, formatNumber, formatPercent } from '@/components/zoruui-domain/ad-manager/constants';
import {
    AmBreadcrumb,
    AmHeader,
    AmNoProject,
} from '@/app/dashboard/ad-manager/_components/am-page-shell';

type BreakdownTab = 'time' | 'placement' | 'device' | 'demo' | 'country';

const TABS: { value: BreakdownTab; label: string }[] = [
    { value: 'time', label: 'By day' },
    { value: 'placement', label: 'Placement' },
    { value: 'device', label: 'Device' },
    { value: 'demo', label: 'Age & gender' },
    { value: 'country', label: 'Country' },
];

const dateRangeSchema = z.object({
    since: z.string().min(1, 'Since date is required'),
    until: z.string().min(1, 'Until date is required'),
}).refine(data => new Date(data.since) <= new Date(data.until), {
    message: 'Start date must be before or equal to end date',
    path: ['since'],
});

type DateRangeValues = z.infer<typeof dateRangeSchema>;

export default function InsightsPage() {
    const { activeAccount } = useAdManager();
    const { preset, date } = useAdManagerShell();
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);

    const [accountAgg, setAccountAgg] = React.useState<any>(null);
    const [byDay, setByDay] = React.useState<any[]>([]);
    const [byPlacement, setByPlacement] = React.useState<any[]>([]);
    const [byDevice, setByDevice] = React.useState<any[]>([]);
    const [byAgeGender, setByAgeGender] = React.useState<any[]>([]);
    const [byCountry, setByCountry] = React.useState<any[]>([]);
    const [activeTab, setActiveTab] = React.useState<BreakdownTab>('time');

    const form = useForm<DateRangeValues>({
        resolver: zodResolver(dateRangeSchema),
        defaultValues: {
            since: '',
            until: '',
        },
    });

    const fetchInsights = React.useCallback((customSince?: string, customUntil?: string) => {
        if (!activeAccount) return;
        setRefreshing(true);
        const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
        const common = {
            level: 'account' as const,
            date_preset: (!customSince && preset && preset !== 'custom') ? preset : 'last_7d',
            time_range:
                customSince && customUntil 
                    ? { since: customSince, until: customUntil }
                    : (preset === 'custom' && date?.from && date.to)
                        ? { since: date.from.toISOString().split('T')[0], until: date.to.toISOString().split('T')[0] }
                        : undefined,
        };

        Promise.all([
            getInsights(actId, common),
            getInsights(actId, { ...common, time_increment: 1 }),
            getInsights(actId, { ...common, breakdowns: ['publisher_platform'] }),
            getInsights(actId, { ...common, breakdowns: ['device_platform'] }),
            getInsights(actId, { ...common, breakdowns: ['age', 'gender'] }),
            getInsights(actId, { ...common, breakdowns: ['country'] }),
        ]).then(([agg, day, pla, dev, ag, cnt]) => {
            setAccountAgg(agg.data?.[0] || null);
            setByDay(day.data || []);
            setByPlacement(pla.data || []);
            setByDevice(dev.data || []);
            setByAgeGender(ag.data || []);
            setByCountry(cnt.data || []);
            setLoading(false);
            setRefreshing(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
            setRefreshing(false);
        });
    }, [activeAccount, preset, date]);

    React.useEffect(() => {
        setLoading(true);
        fetchInsights();
    }, [fetchInsights]);

    const onSubmit = (values: DateRangeValues) => {
        setLoading(true);
        fetchInsights(values.since, values.until);
    };

    if (!activeAccount) {
        return (
            <div className="space-y-4">
                <AmBreadcrumb page="Performance insights" />
                <AmNoProject />
            </div>
        );
    }

    const kpis = [
        { icon: DollarSign, label: 'Amount spent', value: formatMoney(accountAgg?.spend || 0) },
        { icon: Eye, label: 'Impressions', value: formatNumber(accountAgg?.impressions || 0) },
        { icon: Users, label: 'Reach', value: formatNumber(accountAgg?.reach || 0) },
        { icon: MousePointerClick, label: 'Link clicks', value: formatNumber(accountAgg?.inline_link_clicks || 0) },
        { icon: TrendingUp, label: 'CTR', value: formatPercent(accountAgg?.ctr || 0) },
        { icon: BarChart3, label: 'CPC', value: formatMoney(accountAgg?.cpc || 0) },
    ];

    const exportInsightsCsv = () => {
        const allRows = [...byDay, ...byPlacement, ...byDevice, ...byAgeGender, ...byCountry];
        if (allRows.length === 0) return;
        const headers = Object.keys(allRows[0]);
        const csv = [
            headers.join(','),
            ...allRows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `insights-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Performance insights" />
            <AmHeader
                title="Performance insights"
                description="Deep dive into your account performance with breakdown-level insights."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => fetchInsights()} disabled={loading || refreshing}>
                            <RefreshCcw className={cn("h-4 w-4 mr-1", refreshing && "animate-spin")} /> Refresh
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportInsightsCsv} disabled={loading}>
                            <Download className="h-4 w-4 mr-1" /> Export All
                        </Button>
                    </div>
                }
            />

            {/* Custom date range inputs with Zod schema */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Since</Label>
                    <Input
                        type="date"
                        {...form.register('since')}
                        className={cn("h-8 w-40 text-xs", form.formState.errors.since && "border-destructive")}
                    />
                    {form.formState.errors.since && (
                        <p className="text-[10px] text-zoru-ink">{form.formState.errors.since.message}</p>
                    )}
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Until</Label>
                    <Input
                        type="date"
                        {...form.register('until')}
                        className={cn("h-8 w-40 text-xs", form.formState.errors.until && "border-destructive")}
                    />
                    {form.formState.errors.until && (
                        <p className="text-[10px] text-zoru-ink">{form.formState.errors.until.message}</p>
                    )}
                </div>
                <div className="pt-5">
                    <Button
                        size="sm"
                        variant="outline"
                        type="submit"
                        disabled={loading || refreshing}
                    >
                        Apply
                    </Button>
                </div>
            </form>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
                    : kpis.map((k) => (
                          <Card key={k.label}>
                              <ZoruCardContent className="p-4">
                                  <k.icon className="h-4 w-4 text-zoru-ink-muted" />
                                  <div className="mt-2 text-xs text-zoru-ink-muted">{k.label}</div>
                                  <div className="text-2xl font-bold tabular-nums">{k.value}</div>
                              </ZoruCardContent>
                          </Card>
                      ))}
            </div>

            {/* Segmented buttons replace Tabs */}
            <div className="flex flex-wrap gap-1 rounded-lg border bg-zoru-surface-2/40 p-1 w-fit">
                {TABS.map((t) => (
                    <Button
                        key={t.value}
                        type="button"
                        size="sm"
                        variant={activeTab === t.value ? 'default' : 'ghost'}
                        className={cn('h-8', activeTab === t.value ? '' : 'text-zoru-ink-muted')}
                        onClick={() => setActiveTab(t.value)}
                    >
                        {t.label}
                    </Button>
                ))}
            </div>

            {activeTab === 'time' && (
                <BreakdownTable rows={byDay} dimension="date_start" columns={['date_start', 'impressions', 'reach', 'clicks', 'spend', 'ctr']} />
            )}
            {activeTab === 'placement' && (
                <BreakdownTable rows={byPlacement} dimension="publisher_platform" columns={['publisher_platform', 'impressions', 'reach', 'clicks', 'spend', 'ctr']} />
            )}
            {activeTab === 'device' && (
                <BreakdownTable rows={byDevice} dimension="device_platform" columns={['device_platform', 'impressions', 'reach', 'clicks', 'spend', 'ctr']} />
            )}
            {activeTab === 'demo' && (
                <BreakdownTable rows={byAgeGender} dimension="age" columns={['age', 'gender', 'impressions', 'reach', 'clicks', 'spend']} />
            )}
            {activeTab === 'country' && (
                <BreakdownTable rows={byCountry} dimension="country" columns={['country', 'impressions', 'reach', 'clicks', 'spend', 'ctr']} />
            )}
        </div>
    );
}

function BreakdownTable({
    rows,
    dimension,
    columns,
}: {
    rows: any[];
    dimension: string;
    columns: string[];
}) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const filteredRows = React.useMemo(() => {
        if (!searchTerm) return rows;
        const lower = searchTerm.toLowerCase();
        return rows.filter(r => 
            columns.some(c => String(r[c] ?? '').toLowerCase().includes(lower))
        );
    }, [rows, searchTerm, columns]);

    const sortedRows = React.useMemo(() => {
        let sortable = [...filteredRows];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];
                
                // Handle numeric sorting if strings are numbers or formatted values
                const aNum = Number(String(aVal).replace(/[^0-9.-]+/g,""));
                const bNum = Number(String(bVal).replace(/[^0-9.-]+/g,""));

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    if (aNum < bNum) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aNum > bNum) return sortConfig.direction === 'asc' ? 1 : -1;
                } else {
                    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortable;
    }, [filteredRows, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const exportTableCsv = () => {
        if (sortedRows.length === 0) return;
        const headers = columns;
        const csv = [
            headers.join(','),
            ...sortedRows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dimension}-breakdown.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Card className="mt-3">
            <div className="p-3 border-b flex items-center justify-between gap-4">
                <div className="relative w-64 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                    <Input
                        type="search"
                        placeholder="Search breakdown..."
                        className="pl-8 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="sm" onClick={exportTableCsv} disabled={sortedRows.length === 0}>
                    <Download className="h-4 w-4 mr-1" /> Export Table
                </Button>
            </div>
            <ZoruCardContent className="p-0">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            {columns.map((c) => (
                                <ZoruTableHead key={c} className="capitalize">
                                    <button 
                                        type="button"
                                        onClick={() => handleSort(c)}
                                        className="flex items-center gap-1 hover:text-zoru-ink font-medium"
                                    >
                                        {c.replace(/_/g, ' ')}
                                        <ArrowUpDown className="h-3 w-3" />
                                    </button>
                                </ZoruTableHead>
                            ))}
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {sortedRows.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell colSpan={columns.length} className="h-24 text-center text-zoru-ink-muted">
                                    No data for this breakdown.
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            sortedRows.map((r, i) => (
                                <ZoruTableRow key={i}>
                                    {columns.map((c) => {
                                        const v = r[c];
                                        let display: string = v != null ? String(v) : '—';
                                        if (c === 'spend' || c === 'cpc' || c === 'cpm') display = formatMoney(v);
                                        else if (c === 'ctr') display = formatPercent(v);
                                        else if (['impressions', 'reach', 'clicks'].includes(c)) display = formatNumber(v);
                                        return <ZoruTableCell key={c} className="tabular-nums">{display}</ZoruTableCell>;
                                    })}
                                </ZoruTableRow>
                            ))
                        )}
                    </ZoruTableBody>
                </Table>
            </ZoruCardContent>
        </Card>
    );
}
