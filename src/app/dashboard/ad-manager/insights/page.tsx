'use client';

import {
    Button,
    Card,
    CardBody,
    EmptyState,
    Field,
    Input,
    SegmentedControl,
    Skeleton,
    StatCard,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    useToast,
} from '@/components/sabcrm/20ui';
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
    Inbox,
} from 'lucide-react';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { cn } from '@/lib/utils';
import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from '@/context/ad-manager-shell-context';
import { getInsights } from '@/app/actions/ad-manager.actions';
import { formatMoney, formatNumber, formatPercent } from '@/components/20ui-domain/ad-manager/constants';
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
    const { toast } = useToast();
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
            toast.error('Could not load insights. Please try again.');
            setLoading(false);
            setRefreshing(false);
        });
    }, [activeAccount, preset, date, toast]);

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
        if (allRows.length === 0) {
            toast.info('There is no data to export yet.');
            return;
        }
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
        toast.success('Insights exported to CSV.');
    };

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Performance insights" />
            <AmHeader
                title="Performance insights"
                description="Deep dive into your account performance with breakdown-level insights."
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            iconLeft={RefreshCcw}
                            onClick={() => fetchInsights()}
                            disabled={loading || refreshing}
                            className={cn(refreshing && '[&_svg]:animate-spin')}
                        >
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Download}
                            onClick={exportInsightsCsv}
                            disabled={loading}
                        >
                            Export all
                        </Button>
                    </div>
                }
            />

            {/* Custom date range with Zod-validated Fields */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
                <Field
                    label="Since"
                    error={form.formState.errors.since?.message}
                    className="w-44"
                >
                    <Input type="date" inputSize="sm" {...form.register('since')} />
                </Field>
                <Field
                    label="Until"
                    error={form.formState.errors.until?.message}
                    className="w-44"
                >
                    <Input type="date" inputSize="sm" {...form.register('until')} />
                </Field>
                <Button
                    size="sm"
                    variant="outline"
                    type="submit"
                    disabled={loading || refreshing}
                >
                    Apply
                </Button>
            </form>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={96} radius={12} />)
                    : kpis.map((k) => (
                          <StatCard
                              key={k.label}
                              icon={k.icon}
                              label={k.label}
                              value={<span className="tabular-nums">{k.value}</span>}
                          />
                      ))}
            </div>

            <SegmentedControl
                aria-label="Breakdown dimension"
                items={TABS.map((t) => ({ value: t.value, label: t.label }))}
                value={activeTab}
                onChange={(v) => setActiveTab(v)}
            />

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
    const { toast } = useToast();
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

                // Numeric sorting when strings parse as numbers or formatted values.
                const aNum = Number(String(aVal).replace(/[^0-9.-]+/g, ''));
                const bNum = Number(String(bVal).replace(/[^0-9.-]+/g, ''));

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
        if (sortedRows.length === 0) {
            toast.info('There is no data to export yet.');
            return;
        }
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
        toast.success('Table exported to CSV.');
    };

    return (
        <Card padding="none" className="mt-3">
            <div className="p-3 border-b border-[var(--st-border)] flex items-center justify-between gap-4">
                <div className="w-64 max-w-sm">
                    <Input
                        type="search"
                        inputSize="sm"
                        iconLeft={Search}
                        placeholder="Search breakdown..."
                        aria-label="Search breakdown rows"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    iconLeft={Download}
                    onClick={exportTableCsv}
                    disabled={sortedRows.length === 0}
                >
                    Export table
                </Button>
            </div>
            <CardBody className="p-0">
                <Table>
                    <THead>
                        <Tr>
                            {columns.map((c) => (
                                <Th
                                    key={c}
                                    sortable
                                    sortDirection={sortConfig?.key === c ? sortConfig.direction : null}
                                    onSort={() => handleSort(c)}
                                    className="capitalize"
                                >
                                    {c.replace(/_/g, ' ')}
                                </Th>
                            ))}
                        </Tr>
                    </THead>
                    <TBody>
                        {sortedRows.length === 0 ? (
                            <Tr>
                                <Td colSpan={columns.length}>
                                    <EmptyState
                                        icon={Inbox}
                                        size="sm"
                                        title="No data for this breakdown"
                                        description="Try a different date range or breakdown dimension."
                                    />
                                </Td>
                            </Tr>
                        ) : (
                            sortedRows.map((r, i) => (
                                <Tr key={i}>
                                    {columns.map((c) => {
                                        const v = r[c];
                                        let display: string = v != null ? String(v) : '-';
                                        if (c === 'spend' || c === 'cpc' || c === 'cpm') display = formatMoney(v);
                                        else if (c === 'ctr') display = formatPercent(v);
                                        else if (['impressions', 'reach', 'clicks'].includes(c)) display = formatNumber(v);
                                        return <Td key={c} className="tabular-nums">{display}</Td>;
                                    })}
                                </Tr>
                            ))
                        )}
                    </TBody>
                </Table>
            </CardBody>
        </Card>
    );
}
