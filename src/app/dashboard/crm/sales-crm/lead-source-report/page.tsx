'use client';

import { Button, Card, DatePicker, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
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
    const { toast } = useToast();

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
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Filters</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Lead created from</Label>
                        <DatePicker
                            value={startDate}
                            onChange={(d) => setStartDate(d ?? undefined)}
                            placeholder="Start date"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Lead created to</Label>
                        <DatePicker
                            value={endDate}
                            onChange={(d) => setEndDate(d ?? undefined)}
                            placeholder="End date"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Pipeline</Label>
                        <Select value={pipelineId} onValueChange={setPipelineId}>
                            <SelectTrigger>
                                <SelectValue placeholder="All pipelines" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All pipelines</SelectItem>
                                <SelectItem value="sales">Sales Pipeline</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Assigned to</Label>
                        <Select value={assigneeId} onValueChange={setAssigneeId}>
                            <SelectTrigger>
                                <SelectValue placeholder="All assignees" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All assignees</SelectItem>
                                {users.map((u) => (
                                    <SelectItem key={u.salespersonId} value={u.salespersonId}>
                                        {u.salespersonName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Source</Label>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All sources" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All sources</SelectItem>
                                {availableSources.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {s}
                                    </SelectItem>
                                ))}
                            </SelectContent>
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
                        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Leads by source</h2>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
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
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Report data</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                        {filteredReportData.length} source(s).
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <Th className="text-[var(--st-text-secondary)]">Lead Source</Th>
                                <Th className="text-[var(--st-text-secondary)]">Revenue</Th>
                                <Th className="text-[var(--st-text-secondary)]">Conv. Rate</Th>
                                <Th className="text-[var(--st-text-secondary)]">Leads</Th>
                                <Th className="text-[var(--st-text-secondary)]">Open</Th>
                                <Th className="text-[var(--st-text-secondary)]">Closed</Th>
                                <Th className="text-[var(--st-text-secondary)]">Lost</Th>
                                <Th className="text-[var(--st-text-secondary)]">Not Serviceable</Th>
                                <Th className="text-[var(--st-text-secondary)]">Avg Deal</Th>
                                <Th className="text-[var(--st-text-secondary)]">Avg Closure (days)</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {isLoading ? (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={10} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                    </Td>
                                </Tr>
                            ) : filteredReportData.length > 0 ? (
                                filteredReportData.map((row) => (
                                    <Tr key={row.leadSource} className="border-[var(--st-border)]">
                                        <Td className="font-medium text-[var(--st-text)]">
                                            {row.leadSource || 'Unknown'}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            ₹{row.totalRevenue.toLocaleString()}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.leadConversionRate.toFixed(1)}%
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.leadsGenerated}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.openLeads}
                                        </Td>
                                        <Td className="text-[var(--st-text)] dark:text-[var(--st-text)]">
                                            {row.closedLeads}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.lostLeads}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.notServiceable}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            ₹{row.avgDealValue.toLocaleString()}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.avgLeadClosureTime}
                                        </Td>
                                    </Tr>
                                ))
                            ) : (
                                <Tr className="border-[var(--st-border)]">
                                    <Td
                                        colSpan={10}
                                        className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                                    >
                                        No data for selected filters.
                                    </Td>
                                </Tr>
                            )}
                        </TBody>
                    </Table>
                </div>
            </Card>
        </EntityListShell>
    );
}
