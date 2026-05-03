'use client';

import * as React from 'react';
import { BarChart3, AlertCircle, TrendingUp, DollarSign, Eye, MousePointerClick, Users, Download } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from '@/components/wabasimplify/ad-manager/ad-manager-shell';
import { getInsights } from '@/app/actions/ad-manager.actions';
import { formatMoney, formatNumber, formatPercent } from '@/components/wabasimplify/ad-manager/constants';

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
            <div>
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view performance insights.</AlertDescription>
                </Alert>
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <BarChart3 className="h-6 w-6" /> Performance insights
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Deep dive into your account performance with breakdown-level insights.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={exportInsightsCsv} disabled={loading}>
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
            </div>

            {/* Custom date range inputs */}
            <div className="flex items-end gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Since</Label>
                    <Input
                        type="date"
                        value={customSince}
                        onChange={(e) => setCustomSince(e.target.value)}
                        className="h-8 w-40 text-xs"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Until</Label>
                    <Input
                        type="date"
                        value={customUntil}
                        onChange={(e) => setCustomUntil(e.target.value)}
                        className="h-8 w-40 text-xs"
                    />
                </div>
                <Button
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
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
                    : kpis.map((k) => (
                          <Card key={k.label}>
                              <CardContent className="p-4">
                                  <k.icon className="h-4 w-4 text-muted-foreground" />
                                  <div className="mt-2 text-xs text-muted-foreground">{k.label}</div>
                                  <div className="text-2xl font-bold tabular-nums">{k.value}</div>
                              </CardContent>
                          </Card>
                      ))}
            </div>

            <Tabs defaultValue="time">
                <TabsList>
                    <TabsTrigger value="time">By day</TabsTrigger>
                    <TabsTrigger value="placement">Placement</TabsTrigger>
                    <TabsTrigger value="device">Device</TabsTrigger>
                    <TabsTrigger value="demo">Age & gender</TabsTrigger>
                    <TabsTrigger value="country">Country</TabsTrigger>
                </TabsList>

                <TabsContent value="time">
                    <BreakdownTable rows={byDay} dimension="date_start" columns={['date_start', 'impressions', 'reach', 'clicks', 'spend', 'ctr']} />
                </TabsContent>
                <TabsContent value="placement">
                    <BreakdownTable rows={byPlacement} dimension="publisher_platform" columns={['publisher_platform', 'impressions', 'reach', 'clicks', 'spend', 'ctr']} />
                </TabsContent>
                <TabsContent value="device">
                    <BreakdownTable rows={byDevice} dimension="device_platform" columns={['device_platform', 'impressions', 'reach', 'clicks', 'spend', 'ctr']} />
                </TabsContent>
                <TabsContent value="demo">
                    <BreakdownTable rows={byAgeGender} dimension="age" columns={['age', 'gender', 'impressions', 'reach', 'clicks', 'spend']} />
                </TabsContent>
                <TabsContent value="country">
                    <BreakdownTable rows={byCountry} dimension="country" columns={['country', 'impressions', 'reach', 'clicks', 'spend', 'ctr']} />
                </TabsContent>
            </Tabs>
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
        <Card className="mt-3">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((c) => (
                                <TableHead key={c} className="capitalize">{c.replace(/_/g, ' ')}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    No data for this breakdown.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((r, i) => (
                                <TableRow key={i}>
                                    {columns.map((c) => {
                                        const v = r[c];
                                        let display: string = v != null ? String(v) : '—';
                                        if (c === 'spend' || c === 'cpc' || c === 'cpm') display = formatMoney(v);
                                        else if (c === 'ctr') display = formatPercent(v);
                                        else if (['impressions', 'reach', 'clicks'].includes(c)) display = formatNumber(v);
                                        return <TableCell key={c} className="tabular-nums">{display}</TableCell>;
                                    })}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
