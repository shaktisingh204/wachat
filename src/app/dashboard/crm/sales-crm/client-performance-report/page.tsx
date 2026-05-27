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
    const { toast } = useZoruToast();

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
                    <h2 className="text-[16px] font-semibold text-zoru-ink">Filters</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    <div className="space-y-1">
                        <Label className="text-zoru-ink">Lead created from</Label>
                        <DatePicker
                            value={startDate}
                            onChange={(d) => setStartDate(d ?? undefined)}
                            placeholder="Start date"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-zoru-ink">Lead created to</Label>
                        <DatePicker
                            value={endDate}
                            onChange={(d) => setEndDate(d ?? undefined)}
                            placeholder="End date"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-zoru-ink">Pipeline</Label>
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
                        <Label className="text-zoru-ink">Assigned to</Label>
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
                        <h2 className="text-[16px] font-semibold text-zoru-ink">
                            Top clients by revenue
                        </h2>
                        <p className="text-[12px] text-zoru-ink-muted">
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
                    <h2 className="text-[16px] font-semibold text-zoru-ink">Report data</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                        Showing {reportData.length} client(s).
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Total Revenue</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Conv. Rate</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Leads</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Open</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Closed</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Lost</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Not Serviceable</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Avg Deal</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Last Activity</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={10} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map((row) => (
                                    <ZoruTableRow key={row.clientId} className="border-zoru-line">
                                        <ZoruTableCell className="font-medium text-zoru-ink">
                                            {row.clientName}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            ₹{row.totalRevenue.toLocaleString()}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            {row.leadConversionRate.toFixed(1)}%
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            {row.leadsGenerated}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            {row.openLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            {row.closedLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            {row.lostLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            {row.notServiceable}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            ₹{row.avgDealValue.toLocaleString()}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">
                                            {row.lastLeadActivityOn
                                                ? format(new Date(row.lastLeadActivityOn), 'PPP')
                                                : 'N/A'}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={10}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
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
