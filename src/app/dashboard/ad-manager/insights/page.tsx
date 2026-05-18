'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTable,
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
  Download } from 'lucide-react';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from '@/context/ad-manager-shell-context';
import { getInsights } from '@/app/actions/ad-manager.actions';
import { formatMoney, formatNumber, formatPercent } from '@/components/wabasimplify/ad-manager/constants';
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

export default function InsightsPage() {
    const { activeAccount } = useAdManager();
    const { preset, date } = useAdManagerShell();
    const [loading, setLoading] = React.useState(true);
    const [customSince, setCustomSince] = React.useState('');
    const [customUntil, setCustomUntil] = React.useState('');
    const [accountAgg, setAccountAgg] = React.useState<any>(null);
    const [byDay, setByDay] = React.useState<any[]>([]);
    const [byPlacement, setByPlacement] = React.useState<any[]>([]);
    const [byDevice, setByDevice] = React.useState<any[]>([]);
    const [byAgeGender, setByAgeGender] = React.useState<any[]>([]);
    const [byCountry, setByCountry] = React.useState<any[]>([]);
    const [activeTab, setActiveTab] = React.useState<BreakdownTab>('time');

    React.useEffect(() => {
        if (!activeAccount) return;
        setLoading(true);
        const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
        const common = {
            level: 'account' as const,
            date_preset: preset && preset !== 'custom' ? preset : 'last_7d',
            time_range:
                preset === 'custom' && date?.from && date.to
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
        });
    }, [activeAccount, preset, date]);

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
                    <ZoruButton variant="outline" size="sm" onClick={exportInsightsCsv} disabled={loading}>
                        <Download className="h-4 w-4 mr-1" /> Export CSV
                    </ZoruButton>
                }
            />

            {/* Custom date range inputs */}
            <div className="flex items-end gap-3">
                <div className="space-y-1">
                    <ZoruLabel className="text-xs">Since</ZoruLabel>
                    <ZoruInput
                        type="date"
                        value={customSince}
                        onChange={(e) => setCustomSince(e.target.value)}
                        className="h-8 w-40 text-xs"
                    />
                </div>
                <div className="space-y-1">
                    <ZoruLabel className="text-xs">Until</ZoruLabel>
                    <ZoruInput
                        type="date"
                        value={customUntil}
                        onChange={(e) => setCustomUntil(e.target.value)}
                        className="h-8 w-40 text-xs"
                    />
                </div>
                <ZoruButton
                    size="sm"
                    variant="outline"
                    disabled={!customSince || !customUntil || loading}
                    onClick={() => {
                        if (!activeAccount || !customSince || !customUntil) return;
                        setLoading(true);
                        const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
                        const common = {
                            level: 'account' as const,
                            time_range: { since: customSince, until: customUntil },
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
                        });
                    }}
                >
                    Apply
                </ZoruButton>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <ZoruSkeleton key={i} className="h-24" />)
                    : kpis.map((k) => (
                          <ZoruCard key={k.label}>
                              <ZoruCardContent className="p-4">
                                  <k.icon className="h-4 w-4 text-muted-foreground" />
                                  <div className="mt-2 text-xs text-muted-foreground">{k.label}</div>
                                  <div className="text-2xl font-bold tabular-nums">{k.value}</div>
                              </ZoruCardContent>
                          </ZoruCard>
                      ))}
            </div>

            {/* Segmented buttons replace ZoruTabs (no tab primitive in Zoru). */}
            <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
                {TABS.map((t) => (
                    <ZoruButton
                        key={t.value}
                        type="button"
                        size="sm"
                        variant={activeTab === t.value ? 'default' : 'ghost'}
                        className={cn('h-8', activeTab === t.value ? '' : 'text-muted-foreground')}
                        onClick={() => setActiveTab(t.value)}
                    >
                        {t.label}
                    </ZoruButton>
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
    return (
        <ZoruCard className="mt-3">
            <ZoruCardContent className="p-0">
                <ZoruTable>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            {columns.map((c) => (
                                <ZoruTableHead key={c} className="capitalize">{c.replace(/_/g, ' ')}</ZoruTableHead>
                            ))}
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {rows.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    No data for this breakdown.
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            rows.map((r, i) => (
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
                </ZoruTable>
            </ZoruCardContent>
        </ZoruCard>
    );
}
