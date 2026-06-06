'use client';

import { Button, Card, DatePicker, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import { Download, LoaderCircle, TrendingUp, Users } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import {
    generateClientPerformanceReportData,
    generateTeamSalesReportData,
} from '@/app/actions/crm-reports.actions';
import Papa from 'papaparse';
import { format } from 'date-fns';
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
    clientId: string;
    clientName: string;
    totalRevenue: number;
    leadConversionRate: number;
    leadsGenerated: number;
    openLeads: number;
    closedLeads: number;
    lostLeads: number;
    notServiceable: number;
    avgDealValue: number;
    lastLeadActivityOn?: string | null;
}

interface UserOption {
    salespersonId: string;
    salespersonName: string;
}

export default function ClientPerformanceReportPage() {
    const [reportData, setReportData] = useState<ReportRow[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [pipelineId, setPipelineId] = useState<string>('__all__');
    const [assigneeId, setAssigneeId] = useState<string>('__all__');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [{ data, users: teamUsers }, clientData] = await Promise.all([
                generateTeamSalesReportData({}),
                generateClientPerformanceReportData({
                    createdFrom: startDate,
                    createdTo: endDate,
                    pipelineId: pipelineId === '__all__' ? undefined : pipelineId,
                    assigneeId: assigneeId === '__all__' ? undefined : assigneeId,
                }),
            ]);
            setUsers(teamUsers as UserOption[]);
            setReportData(
                Array.isArray(clientData) ? (clientData as ReportRow[]) : [],
            );
            void data;
        });
    }, [startDate, endDate, pipelineId, assigneeId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /* ─── KPIs ──────────────────────────────────────────────────── */

    const kpis = useMemo(() => {
        if (reportData.length === 0) {
            return { topRevenue: 0, activeClients: 0, avgOrderValue: 0, avgConvRate: 0 };
        }
        const topRevenue = Math.max(...reportData.map((d) => d.totalRevenue));
        const activeClients = reportData.filter((d) => d.leadsGenerated > 0).length;
        const avgOrderValue =
            reportData.reduce((s, d) => s + d.avgDealValue, 0) / reportData.length;
        const avgConvRate =
            reportData.reduce((s, d) => s + d.leadConversionRate, 0) / reportData.length;
        return { topRevenue, activeClients, avgOrderValue, avgConvRate };
    }, [reportData]);

    /* ─── Bar chart data (top 10 by revenue) ──────────────────── */

    const chartData = useMemo(
        () =>
            [...reportData]
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .slice(0, 10)
                .map((d) => ({ name: d.clientName, Revenue: Math.round(d.totalRevenue) })),
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
                totalRevenue: d.totalRevenue.toFixed(2),
                leadConversionRate: `${d.leadConversionRate.toFixed(1)}%`,
                avgDealValue: d.avgDealValue.toFixed(2),
                lastLeadActivityOn: d.lastLeadActivityOn
                    ? format(new Date(d.lastLeadActivityOn), 'PPP')
                    : 'N/A',
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'client_performance_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setPipelineId('__all__');
        setAssigneeId('__all__');
    };

    return (
        <EntityListShell
            title="Client Performance Report"
            subtitle="Analyze revenue and lead metrics for each client account."
            primaryAction={
                <Button variant="outline" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5" /> Download CSV
                </Button>
            }
        >
            {/* KPI strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Top client revenue"
                    value={`₹${kpis.topRevenue.toLocaleString()}`}
                    icon={<TrendingUp />}
                    period="single client max"
                />
                <StatCard
                    label="Active clients"
                    value={kpis.activeClients.toLocaleString()}
                    icon={<Users />}
                    period="with leads generated"
                />
                <StatCard
                    label="Avg order value"
                    value={`₹${kpis.avgOrderValue.toFixed(0)}`}
                    icon={<TrendingUp />}
                    period="across all clients"
                />
                <StatCard
                    label="Avg conversion rate"
                    value={`${kpis.avgConvRate.toFixed(1)}%`}
                    icon={<TrendingUp />}
                    period="lead → closed"
                />
            </div>

            {/* Filters */}
            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Filters</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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

            {/* Bar chart — top 10 clients by revenue */}
            {chartData.length > 0 ? (
                <Card>
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
                            Top clients by revenue
                        </h2>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            Showing top {chartData.length} clients.
                        </p>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={130} />
                            <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Revenue']} />
                            <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            ) : null}

            {/* Data table */}
            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Report data</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                        Showing {reportData.length} client(s).
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <Th className="text-[var(--st-text-secondary)]">Client</Th>
                                <Th className="text-[var(--st-text-secondary)]">Total Revenue</Th>
                                <Th className="text-[var(--st-text-secondary)]">Conv. Rate</Th>
                                <Th className="text-[var(--st-text-secondary)]">Leads</Th>
                                <Th className="text-[var(--st-text-secondary)]">Open</Th>
                                <Th className="text-[var(--st-text-secondary)]">Closed</Th>
                                <Th className="text-[var(--st-text-secondary)]">Lost</Th>
                                <Th className="text-[var(--st-text-secondary)]">Not Serviceable</Th>
                                <Th className="text-[var(--st-text-secondary)]">Avg Deal</Th>
                                <Th className="text-[var(--st-text-secondary)]">Last Activity</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {isLoading ? (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={10} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                    </Td>
                                </Tr>
                            ) : reportData.length > 0 ? (
                                reportData.map((row) => (
                                    <Tr key={row.clientId} className="border-[var(--st-border)]">
                                        <Td className="font-medium text-[var(--st-text)]">
                                            {row.clientName}
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
                                        <Td className="text-[var(--st-text)]">
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
                                            {row.lastLeadActivityOn
                                                ? format(new Date(row.lastLeadActivityOn), 'PPP')
                                                : 'N/A'}
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
