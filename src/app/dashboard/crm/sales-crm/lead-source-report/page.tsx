'use client';

import {
    Button,
    Card,
    DatePicker,
    Label,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    StatCard,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';
import { Download, LoaderCircle, TrendingUp } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import {
    generateLeadSourceReportData,
    generateTeamSalesReportData,
} from '@/app/actions/crm-reports.actions';
import Papa from 'papaparse';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { EntityListShell } from '@/components/crm/entity-list-shell';

interface ReportRow {
    leadSource: string;
    totalRevenue: number;
    leadConversionRate: number;
    leadsGenerated: number;
    openLeads: number;
    closedLeads: number;
    lostLeads: number;
    notServiceable: number;
    avgDealValue: number;
    avgLeadClosureTime: number;
}

interface UserOption {
    salespersonId: string;
    salespersonName: string;
}

export default function LeadSourceReportPage() {
    const [reportData, setReportData] = useState<ReportRow[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [pipelineId, setPipelineId] = useState<string>('__all__');
    const [assigneeId, setAssigneeId] = useState<string>('__all__');
    const [sourceFilter, setSourceFilter] = useState<string>('all');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [leadSourceData, teamData] = await Promise.all([
                generateLeadSourceReportData({
                    createdFrom: startDate,
                    createdTo: endDate,
                    pipelineId: pipelineId === '__all__' ? undefined : pipelineId,
                    assigneeId: assigneeId === '__all__' ? undefined : assigneeId,
                }),
                generateTeamSalesReportData({}),
            ]);
            setReportData(Array.isArray(leadSourceData) ? (leadSourceData as ReportRow[]) : []);
            setUsers((teamData.users ?? []) as UserOption[]);
        });
    }, [startDate, endDate, pipelineId, assigneeId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const availableSources = useMemo(() => {
        return Array.from(new Set(reportData.map((d) => d.leadSource || 'Unknown'))).sort();
    }, [reportData]);

    const filteredReportData = useMemo(() => {
        if (!sourceFilter || sourceFilter === 'all') return reportData;
        return reportData.filter((d) => (d.leadSource || 'Unknown') === sourceFilter);
    }, [reportData, sourceFilter]);

    /* ─── KPIs ──────────────────────────────────────────────────── */

    const kpis = useMemo(() => {
        const totalSources = filteredReportData.length;
        if (totalSources === 0) {
            return { totalSources: 0, topSource: '—', topSourceLeads: 0, totalLeads: 0 };
        }
        const sorted = [...filteredReportData].sort((a, b) => b.leadsGenerated - a.leadsGenerated);
        const top = sorted[0];
        const totalLeads = filteredReportData.reduce((s, d) => s + d.leadsGenerated, 0);
        return {
            totalSources,
            topSource: top?.leadSource ?? '—',
            topSourceLeads: top?.leadsGenerated ?? 0,
            totalLeads,
        };
    }, [filteredReportData]);

    /* ─── Bar chart data ────────────────────────────────────────── */

    const chartData = useMemo(
        () =>
            [...filteredReportData]
                .sort((a, b) => b.leadsGenerated - a.leadsGenerated)
                .slice(0, 12)
                .map((d) => ({ name: d.leadSource || 'Unknown', Leads: d.leadsGenerated })),
        [filteredReportData],
    );

    /* ─── Export ────────────────────────────────────────────────── */

    const handleDownload = () => {
        if (filteredReportData.length === 0) {
            toast({ title: 'No data', description: 'No report data to download.' });
            return;
        }
        const csv = Papa.unparse(
            filteredReportData.map((d) => ({
                ...d,
                totalRevenue: d.totalRevenue.toFixed(2),
                leadConversionRate: `${d.leadConversionRate.toFixed(1)}%`,
                avgDealValue: d.avgDealValue.toFixed(2),
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'lead_source_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setPipelineId('__all__');
        setAssigneeId('__all__');
        setSourceFilter('all');
    };

    return (
        <EntityListShell
            title="Lead Source Report"
            subtitle="Analyze the effectiveness of your lead sources."
            primaryAction={
                <Button variant="outline" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5" /> Download CSV
                </Button>
            }
        >
            {/* KPI strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total sources"
                    value={kpis.totalSources.toLocaleString()}
                    icon={<TrendingUp />}
                    period="distinct channels"
                />
                <StatCard
                    label="Top source"
                    value={kpis.topSource}
                    icon={<TrendingUp />}
                    period={`${kpis.topSourceLeads} leads`}
                />
                <StatCard
                    label="Total leads"
                    value={kpis.totalLeads.toLocaleString()}
                    icon={<TrendingUp />}
                    period="across all sources"
                />
                <StatCard
                    label="Avg leads/source"
                    value={
                        kpis.totalSources > 0
                            ? (kpis.totalLeads / kpis.totalSources).toFixed(1)
                            : '0'
                    }
                    icon={<TrendingUp />}
                    period="per channel"
                />
            </div>

            {/* Filters */}
            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Filters</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                    <div className="space-y-1">
                        <Label className="text-foreground">Lead created from</Label>
                        <DatePicker
                            value={startDate}
                            onChange={(d) => setStartDate(d ?? undefined)}
                            placeholder="Start date"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-foreground">Lead created to</Label>
                        <DatePicker
                            value={endDate}
                            onChange={(d) => setEndDate(d ?? undefined)}
                            placeholder="End date"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-foreground">Pipeline</Label>
                        <Select value={pipelineId} onValueChange={setPipelineId}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="All pipelines" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="__all__">All pipelines</ZoruSelectItem>
                                <ZoruSelectItem value="sales">Sales Pipeline</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-foreground">Assigned to</Label>
                        <Select value={assigneeId} onValueChange={setAssigneeId}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="All assignees" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="__all__">All assignees</ZoruSelectItem>
                                {users.map((u) => (
                                    <ZoruSelectItem key={u.salespersonId} value={u.salespersonId}>
                                        {u.salespersonName}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-foreground">Source</Label>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="All sources" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All sources</ZoruSelectItem>
                                {availableSources.map((s) => (
                                    <ZoruSelectItem key={s} value={s}>
                                        {s}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                </div>
                <div className="mt-4 flex gap-2">
                    <Button onClick={fetchData} disabled={isLoading}>
                        Apply Filters
                    </Button>
                    <Button variant="ghost" onClick={clearFilters}>
                        Clear Filters
                    </Button>
                </div>
            </Card>

            {/* Bar chart — leads by source */}
            {chartData.length > 0 ? (
                <Card>
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-foreground">Leads by source</h2>
                        <p className="text-[12px] text-muted-foreground">
                            Top {chartData.length} channels by volume.
                        </p>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={120} />
                            <Tooltip />
                            <Bar dataKey="Leads" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            ) : null}

            {/* Data table */}
            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Report data</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        {filteredReportData.length} source(s).
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Lead Source</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Revenue</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Conv. Rate</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Leads</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Open</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Closed</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Lost</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Not Serviceable</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Avg Deal</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Avg Closure (days)</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={10} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : filteredReportData.length > 0 ? (
                                filteredReportData.map((row) => (
                                    <ZoruTableRow key={row.leadSource} className="border-border">
                                        <ZoruTableCell className="font-medium text-foreground">
                                            {row.leadSource || 'Unknown'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            ₹{row.totalRevenue.toLocaleString()}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.leadConversionRate.toFixed(1)}%
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.leadsGenerated}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.openLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-emerald-600 dark:text-emerald-500">
                                            {row.closedLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-destructive">
                                            {row.lostLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.notServiceable}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            ₹{row.avgDealValue.toLocaleString()}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.avgLeadClosureTime}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell
                                        colSpan={10}
                                        className="h-24 text-center text-[13px] text-muted-foreground"
                                    >
                                        No data for selected filters.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
            </Card>
        </EntityListShell>
    );
}
