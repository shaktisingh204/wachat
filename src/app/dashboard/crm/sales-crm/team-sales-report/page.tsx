'use client';

import { Button, Card, DatePicker, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import { Download, LoaderCircle, Trophy, TrendingUp, Users } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { generateTeamSalesReportData } from '@/app/actions/crm-reports.actions';
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
    salespersonId: string;
    salespersonName: string;
    salespersonEmail?: string;
    totalLeads: number;
    openLeads: number;
    closedLeads: number;
    lostLeads: number;
    conversionRate: number;
    totalRevenue: number;
    avgDealValue: number;
}

interface UserOption {
    _id?: string;
    salespersonId?: string;
    name?: string;
    salespersonName?: string;
}

export default function TeamSalesReportPage() {
    const [reportData, setReportData] = useState<ReportRow[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [pipelineId, setPipelineId] = useState<string>('__all__');
    const [leadSource, setLeadSource] = useState<string>('');
    const [assigneeId, setAssigneeId] = useState<string>('__all__');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const { data, users: rawUsers } = await generateTeamSalesReportData({
                createdFrom: startDate,
                createdTo: endDate,
                pipelineId: pipelineId === '__all__' ? undefined : pipelineId,
                leadSource,
                assigneeId: assigneeId === '__all__' ? undefined : assigneeId,
            });
            setReportData(Array.isArray(data) ? (data as ReportRow[]) : []);
            setUsers(Array.isArray(rawUsers) ? (rawUsers as UserOption[]) : []);
        });
    }, [startDate, endDate, pipelineId, leadSource, assigneeId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /* ─── KPIs ──────────────────────────────────────────────────── */

    const kpis = useMemo(() => {
        if (reportData.length === 0) {
            return {
                totalRevenue: 0,
                topPerformer: '—',
                avgPerRep: 0,
                avgConvRate: 0,
            };
        }
        const totalRevenue = reportData.reduce((s, d) => s + d.totalRevenue, 0);
        const sorted = [...reportData].sort((a, b) => b.totalRevenue - a.totalRevenue);
        const topPerformer = sorted[0]?.salespersonName ?? '—';
        const avgPerRep = totalRevenue / reportData.length;
        const avgConvRate =
            reportData.reduce((s, d) => s + d.conversionRate, 0) / reportData.length;
        return { totalRevenue, topPerformer, avgPerRep, avgConvRate };
    }, [reportData]);

    /* ─── Bar chart data (revenue per rep) ─────────────────────── */

    const chartData = useMemo(
        () =>
            [...reportData]
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, 10)
                .map((d) => ({
                    name: d.salespersonName,
                    Revenue: Math.round(d.totalRevenue),
                    Closed: d.closedLeads,
                })),
        [reportData],
    );

    /* ─── Export ────────────────────────────────────────────────── */

    const handleDownload = () => {
        if (reportData.length === 0) {
            toast({ title: 'No data', description: 'No report data to download.' });
            return;
        }
        const csv = Papa.unparse(
            reportData.map((d) => ({
                ...d,
                conversionRate: `${d.conversionRate.toFixed(1)}%`,
                totalRevenue: d.totalRevenue.toFixed(2),
                avgDealValue: d.avgDealValue.toFixed(2),
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'team_sales_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setPipelineId('__all__');
        setLeadSource('');
        setAssigneeId('__all__');
    };

    return (
        <EntityListShell
            title="Team Sales Report"
            subtitle="Performance metrics for each salesperson."
            primaryAction={
                <Button variant="outline" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5" /> Download CSV
                </Button>
            }
        >
            {/* KPI strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total team revenue"
                    value={`₹${kpis.totalRevenue.toLocaleString()}`}
                    icon={<TrendingUp />}
                    period="all reps combined"
                />
                <StatCard
                    label="Top performer"
                    value={kpis.topPerformer}
                    icon={<Trophy />}
                    period="by revenue"
                />
                <StatCard
                    label="Avg per rep"
                    value={`₹${kpis.avgPerRep.toFixed(0)}`}
                    icon={<Users />}
                    period="mean revenue"
                />
                <StatCard
                    label="Avg conversion"
                    value={`${kpis.avgConvRate.toFixed(1)}%`}
                    icon={<TrendingUp />}
                    period="across all reps"
                />
            </div>

            {/* Filters */}
            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Filters</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
                        <Label className="text-[var(--st-text)]">Rep</Label>
                        <Select value={assigneeId} onValueChange={setAssigneeId}>
                            <SelectTrigger>
                                <SelectValue placeholder="All reps" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All reps</SelectItem>
                                {users.map((u) => {
                                    const uid = String(u._id ?? u.salespersonId ?? '');
                                    const uname = String(u.name ?? u.salespersonName ?? uid);
                                    return (
                                        <SelectItem key={uid} value={uid}>
                                            {uname}
                                        </SelectItem>
                                    );
                                })}
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

            {/* Bar chart — revenue by rep */}
            {chartData.length > 0 ? (
                <Card>
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Revenue by rep</h2>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            Top {chartData.length} salesperson(s).
                        </p>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={130} />
                            <Tooltip
                                formatter={(v: number, name: string) => [
                                    name === 'Revenue' ? `₹${v.toLocaleString()}` : v,
                                    name,
                                ]}
                            />
                            <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="Closed" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            ) : null}

            {/* Data table */}
            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Salesperson performance</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <Th className="text-[var(--st-text-secondary)]">Salesperson</Th>
                                <Th className="text-[var(--st-text-secondary)]">Total Leads</Th>
                                <Th className="text-[var(--st-text-secondary)]">Open</Th>
                                <Th className="text-[var(--st-text-secondary)]">Closed</Th>
                                <Th className="text-[var(--st-text-secondary)]">Lost</Th>
                                <Th className="text-[var(--st-text-secondary)]">Conv. Rate</Th>
                                <Th className="text-[var(--st-text-secondary)]">Revenue</Th>
                                <Th className="text-[var(--st-text-secondary)]">Avg Deal</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {isLoading ? (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={8} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                    </Td>
                                </Tr>
                            ) : reportData.length > 0 ? (
                                reportData.map((row) => (
                                    <Tr key={row.salespersonId} className="border-[var(--st-border)]">
                                        <Td>
                                            <div className="font-medium text-[var(--st-text)]">
                                                {row.salespersonName}
                                            </div>
                                            {row.salespersonEmail ? (
                                                <div className="text-[11.5px] text-[var(--st-text-secondary)]">
                                                    {row.salespersonEmail}
                                                </div>
                                            ) : null}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.totalLeads}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.openLeads}
                                        </Td>
                                        <Td className="font-semibold text-[var(--st-text)]">
                                            {row.closedLeads}
                                        </Td>
                                        <Td className="font-semibold text-[var(--st-text)]">
                                            {row.lostLeads}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            {row.conversionRate.toFixed(1)}%
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            ₹{row.totalRevenue.toLocaleString()}
                                        </Td>
                                        <Td className="text-[var(--st-text)]">
                                            ₹{row.avgDealValue.toLocaleString()}
                                        </Td>
                                    </Tr>
                                ))
                            ) : (
                                <Tr className="border-[var(--st-border)]">
                                    <Td
                                        colSpan={8}
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
