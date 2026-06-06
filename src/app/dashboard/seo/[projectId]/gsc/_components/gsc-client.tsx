'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Skeleton, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, ZoruDateRangePicker, ZoruDateRangePickerProps, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/sabcrm/20ui/compat';
import { use, useEffect, useState, useCallback } from 'react';
import { LineChart, Loader2, CheckCircle, Search, Filter } from 'lucide-react';
import { startGscAuth, getGscIntegration } from '@/app/actions/seo-gsc.actions';
import { getAdvancedGscData } from '../actions';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { GoogleLogo } from '../GoogleLogo';
import { format, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import { fmtDate } from '@/lib/utils';

export function GscClient({ projectId, initialIntegration }: { projectId: string, initialIntegration: any }) {
    const [integration, setIntegration] = useState<any>(initialIntegration);
    
    const [chartData, setChartData] = useState<any[]>([]);
    const [tableData, setTableData] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [tableLoading, setTableLoading] = useState(false);
    const [connecting, setConnecting] = useState(false);

    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 28),
        to: new Date()
    });
    
    const [activeDimension, setActiveDimension] = useState<string>('query');
    
    const [queryFilter, setQueryFilter] = useState('');
    const [pageFilter, setPageFilter] = useState('');
    const [deviceFilter, setDeviceFilter] = useState('ALL');
    const [countryFilter, setCountryFilter] = useState('');

    const getFilters = useCallback(() => {
        const filters: any[] = [];
        if (queryFilter) filters.push({ dimension: 'query', operator: 'contains', expression: queryFilter });
        if (pageFilter) filters.push({ dimension: 'page', operator: 'contains', expression: pageFilter });
        if (deviceFilter !== 'ALL') filters.push({ dimension: 'device', operator: 'equals', expression: deviceFilter });
        if (countryFilter) filters.push({ dimension: 'country', operator: 'contains', expression: countryFilter.toLowerCase() });
        return filters;
    }, [queryFilter, pageFilter, deviceFilter, countryFilter]);

    const load = async () => {
        if (integration && integration.credentials && dateRange?.from && dateRange?.to) {
            await fetchAllData();
        }
    };

    const fetchAllData = async () => {
        if (!dateRange?.from || !dateRange?.to) return;
        setLoading(true);
        setTableLoading(true);

        const startDate = format(dateRange.from, 'yyyy-MM-dd');
        const endDate = format(dateRange.to, 'yyyy-MM-dd');
        const filters = getFilters();

        try {
            const chartRes = await getAdvancedGscData(projectId, startDate, endDate, ['date'], filters);
            if (chartRes.success) setChartData(chartRes.rows || []);

            const tableRes = await getAdvancedGscData(projectId, startDate, endDate, [activeDimension], filters);
            if (tableRes.success) setTableData(tableRes.rows || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setTableLoading(false);
        }
    };

    const fetchTableOnly = async () => {
        if (!dateRange?.from || !dateRange?.to) return;
        setTableLoading(true);
        const startDate = format(dateRange.from, 'yyyy-MM-dd');
        const endDate = format(dateRange.to, 'yyyy-MM-dd');
        const filters = getFilters();

        try {
            const tableRes = await getAdvancedGscData(projectId, startDate, endDate, [activeDimension], filters);
            if (tableRes.success) setTableData(tableRes.rows || []);
        } catch (e) {
            console.error(e);
        } finally {
            setTableLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (integration && integration.credentials && !loading) {
            fetchTableOnly();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeDimension]);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            await startGscAuth(projectId);
        } catch (e) {
            console.error(e);
            setConnecting(false);
        }
    };

    if (loading && !integration) return <Skeleton className="h-[400px] w-full" />;

    if (!integration) {
        return (
            <div className="flex flex-col items-center justify-center rounded-[var(--zoru-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-12">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--st-text-secondary)]/10">
                    <LineChart className="h-8 w-8 text-[var(--st-text-secondary)]" />
                </div>
                <h2 className="text-xl text-[var(--st-text)] mb-2">Connect Google Search Console</h2>
                <p className="text-[var(--st-text-secondary)] max-w-md text-center mb-6">
                    Import real performance data (clicks, impressions, position) directly from Google.
                </p>
                <Button onClick={handleConnect} disabled={connecting} size="lg">
                    {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Connect Google Account
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-[var(--st-text)] flex items-center gap-3">
                        <GoogleLogo className="h-8 w-8" />
                        Search Console
                    </h1>
                    <p className="text-[var(--st-text-secondary)] mt-1 flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-[var(--st-status-ok)]" />
                        Connected to {integration.selectedSite || integration.sites?.[0] || 'Unknown Site'}
                    </p>
                </div>
                <Button variant="outline" onClick={handleConnect}>
                    Reconnect
                </Button>
            </div>

            <Card>
                <ZoruCardContent className="pt-6">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm font-medium mb-1.5 block">Date Range</label>
                            <ZoruDateRangePicker 
                                value={dateRange} 
                                onChange={setDateRange} 
                                className="w-full"
                            />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-sm font-medium mb-1.5 block">Query</label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                                <Input 
                                    placeholder="Contains..." 
                                    className="pl-9" 
                                    value={queryFilter} 
                                    onChange={(e) => setQueryFilter(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-sm font-medium mb-1.5 block">Page</label>
                            <Input 
                                placeholder="URL contains..." 
                                value={pageFilter} 
                                onChange={(e) => setPageFilter(e.target.value)} 
                            />
                        </div>
                        <div className="w-[120px]">
                            <label className="text-sm font-medium mb-1.5 block">Device</label>
                            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All</SelectItem>
                                    <SelectItem value="DESKTOP">Desktop</SelectItem>
                                    <SelectItem value="MOBILE">Mobile</SelectItem>
                                    <SelectItem value="TABLET">Tablet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-[120px]">
                            <label className="text-sm font-medium mb-1.5 block">Country</label>
                            <Input 
                                placeholder="e.g. usa" 
                                value={countryFilter} 
                                onChange={(e) => setCountryFilter(e.target.value)} 
                            />
                        </div>
                        <Button onClick={fetchAllData} disabled={loading} className="w-[120px]">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                            Apply
                        </Button>
                    </div>
                </ZoruCardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Total Clicks" value={sum(chartData, 'clicks')} />
                <MetricCard title="Total Impressions" value={sum(chartData, 'impressions')} />
                <MetricCard title="Avg. CTR" value={(avg(chartData, 'ctr') * 100).toFixed(2) + '%'} />
                <MetricCard title="Avg. Position" value={avg(chartData, 'position').toFixed(1)} />
            </div>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Performance</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="h-[300px]">
                    {loading && chartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" /></div>
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--zoru-line)" />
                                <XAxis
                                    dataKey="keys[0]"
                                    tickFormatter={(val) =>
                                        fmtDate(val)
                                    }
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis yAxisId="left" orientation="left" stroke="#2563eb" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                                <YAxis yAxisId="right" orientation="right" stroke="#16a34a" fontSize={12} tickLine={false} axisLine={false} dx={10} />
                                <Tooltip 
                                    labelFormatter={(label) => fmtDate(label)}
                                    contentStyle={{ borderRadius: 'var(--zoru-radius)', border: '1px solid var(--zoru-line)', backgroundColor: 'var(--zoru-surface)' }}
                                />
                                <Bar yAxisId="left" dataKey="clicks" fill="#2563eb" name="Clicks" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar
                                    yAxisId="right"
                                    dataKey="impressions"
                                    fill="#16a34a"
                                    name="Impressions"
                                    radius={[4, 4, 0, 0]}
                                    opacity={0.3}
                                    maxBarSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[var(--st-text-secondary)]">No data for selected range</div>
                    )}
                </ZoruCardContent>
            </Card>

            <Card>
                <div className="flex items-center justify-between p-6 pb-0">
                    <ZoruCardTitle>Detailed Breakdown</ZoruCardTitle>
                    <div className="w-[180px]">
                        <Select value={activeDimension} onValueChange={(val) => { setActiveDimension(val); }}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="query">By Query</SelectItem>
                                <SelectItem value="page">By Page</SelectItem>
                                <SelectItem value="country">By Country</SelectItem>
                                <SelectItem value="device">By Device</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <ZoruCardContent className="pt-6">
                    {tableLoading && tableData.length === 0 ? (
                        <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" /></div>
                    ) : (
                        <div className="rounded-md border border-[var(--st-border)] overflow-hidden">
                            <Table>
                                <TableHeader className="bg-[var(--st-bg-muted)]/50">
                                    <TableRow>
                                        <TableHead className="font-semibold">{activeDimension.charAt(0).toUpperCase() + activeDimension.slice(1)}</TableHead>
                                        <TableHead className="text-right font-semibold">Clicks</TableHead>
                                        <TableHead className="text-right font-semibold">Impressions</TableHead>
                                        <TableHead className="text-right font-semibold">CTR</TableHead>
                                        <TableHead className="text-right font-semibold">Position</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tableData.length > 0 ? (
                                        tableData.map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium max-w-[300px] truncate" title={row.keys?.[0]}>
                                                    {row.keys?.[0] || 'Unknown'}
                                                </TableCell>
                                                <TableCell className="text-right">{row.clicks?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{row.impressions?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{(row.ctr * 100).toFixed(2)}%</TableCell>
                                                <TableCell className="text-right">{row.position?.toFixed(1)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-[var(--st-text-secondary)]">
                                                No results found
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
    return (
        <Card>
            <ZoruCardHeader className="pb-2">
                <ZoruCardTitle className="text-sm text-[var(--st-text-secondary)]">{title}</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
                <div className="text-2xl font-semibold text-[var(--st-text)]">{value}</div>
            </ZoruCardContent>
        </Card>
    );
}

function sum(data: any[], key: string) {
    return data.reduce((acc, curr) => acc + (curr[key] || 0), 0).toLocaleString();
}

function avg(data: any[], key: string) {
    if (data.length === 0) return 0;
    return data.reduce((acc, curr) => acc + (curr[key] || 0), 0) / data.length;
}
