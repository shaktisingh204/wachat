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
    const { toast } = useZoruToast();

    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [pipelineId, setPipelineId] = useState<string>('');
    const [leadSource, setLeadSource] = useState<string>('');
    const [assigneeId, setAssigneeId] = useState<string>('');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const { data, users: rawUsers } = await generateTeamSalesReportData({
                createdFrom: startDate,
                createdTo: endDate,
                pipelineId,
                leadSource,
                assigneeId,
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
        setPipelineId('');
        setLeadSource('');
        setAssigneeId('');
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
                    <h2 className="text-[16px] font-semibold text-foreground">Filters</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
                                <ZoruSelectItem value="">All pipelines</ZoruSelectItem>
                                <ZoruSelectItem value="sales">Sales Pipeline</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-foreground">Rep</Label>
                        <Select value={assigneeId} onValueChange={setAssigneeId}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="All reps" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="">All reps</ZoruSelectItem>
                                {users.map((u) => {
                                    const uid = String(u._id ?? u.salespersonId ?? '');
                                    const uname = String(u.name ?? u.salespersonName ?? uid);
                                    return (
                                        <ZoruSelectItem key={uid} value={uid}>
                                            {uname}
                                        </ZoruSelectItem>
                                    );
                                })}
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

            {/* Bar chart — revenue by rep */}
            {chartData.length > 0 ? (
                <Card>
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-foreground">Revenue by rep</h2>
                        <p className="text-[12px] text-muted-foreground">
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
                    <h2 className="text-[16px] font-semibold text-foreground">Salesperson performance</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Salesperson</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Total Leads</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Open</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Closed</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Lost</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Conv. Rate</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Revenue</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Avg Deal</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={8} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map((row) => (
                                    <ZoruTableRow key={row.salespersonId} className="border-border">
                                        <ZoruTableCell>
                                            <div className="font-medium text-foreground">
                                                {row.salespersonName}
                                            </div>
                                            {row.salespersonEmail ? (
                                                <div className="text-[11.5px] text-muted-foreground">
                                                    {row.salespersonEmail}
                                                </div>
                                            ) : null}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.totalLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.openLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-semibold text-green-600">
                                            {row.closedLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-semibold text-red-600">
                                            {row.lostLeads}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {row.conversionRate.toFixed(1)}%
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            ₹{row.totalRevenue.toLocaleString()}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            ₹{row.avgDealValue.toLocaleString()}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell
                                        colSpan={8}
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
