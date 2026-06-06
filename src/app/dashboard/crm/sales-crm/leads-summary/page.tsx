'use client';

import {
    Alert,
    ZoruAlertDescription,
    ZoruAlertTitle,
    Badge,
    Button,
    Card,
    DatePicker,
    Label,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Skeleton,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getLeadsSummaryData } from '@/app/actions/crm-reports.actions';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface PipelineSummaryRow {
    name: string;
    leadCount: number;
    totalValue: number;
    weightedValue: number;
    avgPredictiveScore?: number;
}

interface FiltersData {
    pipelines: Array<{ id: string; name: string; stages?: Array<{ id: string; name: string }> }>;
    leadSources: string[];
    assignees: Array<{ _id: string; name: string }>;
}

interface SummaryData {
    summary: {
        newLeads: number;
        scheduledLeads: number;
        overdueLeads: number;
        closedLeads: number;
        overallPredictiveScore?: number;
    };
    pipelineSummary: PipelineSummaryRow[];
    filtersData: FiltersData;
}

interface FilterState {
    pipelineId: string;
    leadSource: string;
    assigneeId: string;
    createdFrom: Date | undefined;
    createdTo: Date | undefined;
    updatedFrom: Date | undefined;
    updatedTo: Date | undefined;
    closedFrom: Date | undefined;
    closedTo: Date | undefined;
    currentStage: string;
}

const INITIAL_FILTERS: FilterState = {
    pipelineId: '',
    leadSource: '',
    assigneeId: '',
    createdFrom: undefined,
    createdTo: undefined,
    updatedFrom: undefined,
    updatedTo: undefined,
    closedFrom: undefined,
    closedTo: undefined,
    currentStage: '',
};

/* ─── Sub-components ────────────────────────────────────────────────── */

interface StatCardProps {
    title: string;
    value: number;
    accent?: string;
    suffix?: string;
}

function StatCard({ title, value, accent, suffix }: StatCardProps) {
    return (
        <Card>
            <p className="text-[13px] font-medium text-[var(--st-text-secondary)]">{title}</p>
            <p className="mt-1 flex items-baseline gap-1.5 text-[28px] font-semibold text-[var(--st-text)]">
                <span>{value.toLocaleString()}</span>
                {suffix ? <span className="text-[13px] text-[var(--st-text-secondary)]">{suffix}</span> : null}
            </p>
            {accent ? <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">{accent}</p> : null}
        </Card>
    );
}

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-28" />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Skeleton className="h-96 lg:col-span-1" />
                <Skeleton className="h-96 lg:col-span-2" />
            </div>
        </div>
    );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

const PIE_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(var(--accent-foreground))',
    'hsl(var(--muted-foreground))',
    'hsl(var(--destructive))',
    'hsl(var(--ring))',
];

export default function LeadsSummaryPage() {
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            try {
                const data = (await getLeadsSummaryData(filters)) as SummaryData | null;
                setSummaryData(data);
            } catch {
                toast({
                    title: 'Error',
                    description: 'Failed to load summary data.',
                    variant: 'destructive',
                });
            }
        });
    }, [filters, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFilterChange = useCallback(
        <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
        },
        [],
    );

    const resetFilters = useCallback(() => setFilters(INITIAL_FILTERS), []);

    /* ─── Derived ───────────────────────────────────────────────────── */

    const derived = useMemo(() => {
        if (!summaryData) {
            return {
                totalLeads: 0,
                conversionRate: 0,
                topSource: '—',
                sourcePie: [] as Array<{ name: string; value: number }>,
                stageLine: [] as Array<{ name: string; leadCount: number; weightedValue: number }>,
                funnel: [] as PipelineSummaryRow[],
            };
        }
        const funnel = [...summaryData.pipelineSummary].sort((a, b) => b.leadCount - a.leadCount);
        const totalLeads = funnel.reduce((sum, s) => sum + s.leadCount, 0);
        const wonLeads = funnel
            .filter((s) => /won|closed|deal\s*done/i.test(s.name))
            .reduce((sum, s) => sum + s.leadCount, 0);
        const closedLeads = summaryData.summary.closedLeads || wonLeads;
        const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 1000) / 10 : 0;

        // Source pie — distinct lead sources from filtersData, weighted equally
        // when we don't have per-source counts (server doesn't expose them).
        const sources = summaryData.filtersData.leadSources ?? [];
        const sourcePie = sources.length
            ? sources.slice(0, 6).map((s) => ({
                  name: s || 'Unknown',
                  value: Math.max(1, Math.round(totalLeads / Math.max(1, sources.length))),
              }))
            : [];
        const topSource = sources[0] ?? '—';

        const stageLine = summaryData.pipelineSummary.map((s) => ({
            name: s.name,
            leadCount: s.leadCount,
            weightedValue: s.weightedValue,
        }));

        return {
            totalLeads,
            conversionRate,
            topSource,
            sourcePie,
            stageLine,
            funnel,
            wonLeads,
            closedLeads,
        };
    }, [summaryData]);

    /* ─── Render ────────────────────────────────────────────────────── */

    if (isLoading && !summaryData) {
        return <PageSkeleton />;
    }

    if (!summaryData) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Error</ZoruAlertTitle>
                <ZoruAlertDescription>
                    Could not load summary data. Please ensure deals have been added to the CRM.
                </ZoruAlertDescription>
            </Alert>
        );
    }

    const { summary, pipelineSummary, filtersData } = summaryData;
    const stageOptions = filtersData.pipelines[0]?.stages ?? [];

    const activeFilters = Object.entries(filters).filter(([, value]) => {
        if (value instanceof Date) return true;
        if (typeof value === 'string') return value.length > 0;
        return Boolean(value);
    });

    return (
        <EntityListShell
            title="Leads Summary"
            subtitle="A high-level overview of your sales pipeline performance."
        >
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <StatCard
                    title="Total leads"
                    value={derived.totalLeads}
                    accent={`${summary.newLeads.toLocaleString()} new`}
                />
                <StatCard
                    title="Conversion rate"
                    value={Math.round(derived.conversionRate)}
                    suffix="%"
                    accent={`${(derived.wonLeads ?? 0).toLocaleString()} won`}
                />
                <StatCard
                    title="Closed leads"
                    value={summary.closedLeads}
                    accent={`${summary.overdueLeads.toLocaleString()} overdue`}
                />
                <StatCard
                    title="Top source"
                    value={derived.sourcePie.length}
                    accent={`Top: ${derived.topSource}`}
                />
                <StatCard
                    title="AI Score"
                    value={summary.overallPredictiveScore ?? 0}
                    accent="Avg deal health"
                />
            </div>

            {/* Filters */}
            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Filters</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Pipeline</Label>
                        <Select
                            value={filters.pipelineId}
                            onValueChange={(v) => handleFilterChange('pipelineId', v)}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Sales Pipeline" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {(filtersData.pipelines || []).map((p) => (
                                    <ZoruSelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Lead Source</Label>
                        <Select
                            value={filters.leadSource}
                            onValueChange={(v) => handleFilterChange('leadSource', v)}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Select…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {(filtersData.leadSources || []).map((s) => (
                                    <ZoruSelectItem key={s} value={s}>
                                        {s}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Assigned To</Label>
                        <Select
                            value={filters.assigneeId}
                            onValueChange={(v) => handleFilterChange('assigneeId', v)}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Select…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {(filtersData.assignees || []).map((a) => (
                                    <ZoruSelectItem key={a._id} value={a._id}>
                                        {a.name}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Current Stage</Label>
                        <Select
                            value={filters.currentStage}
                            onValueChange={(v) => handleFilterChange('currentStage', v)}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Select…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {stageOptions.map((s) => (
                                    <ZoruSelectItem key={s.id} value={s.name}>
                                        {s.name}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Created From</Label>
                        <DatePicker
                            value={filters.createdFrom}
                            onChange={(d) => handleFilterChange('createdFrom', (d ?? undefined) as Date | undefined)}
                            placeholder="Start Date"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Created To</Label>
                        <DatePicker
                            value={filters.createdTo}
                            onChange={(d) => handleFilterChange('createdTo', (d ?? undefined) as Date | undefined)}
                            placeholder="End Date"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Closed From</Label>
                        <DatePicker
                            value={filters.closedFrom}
                            onChange={(d) => handleFilterChange('closedFrom', (d ?? undefined) as Date | undefined)}
                            placeholder="Start Date"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[var(--st-text)]">Closed To</Label>
                        <DatePicker
                            value={filters.closedTo}
                            onChange={(d) => handleFilterChange('closedTo', (d ?? undefined) as Date | undefined)}
                            placeholder="End Date"
                        />
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                    <Button onClick={fetchData} disabled={isLoading}>
                        Apply filters
                    </Button>
                    {activeFilters.length > 0 ? (
                        <Button variant="ghost" size="sm" onClick={resetFilters}>
                            Reset
                        </Button>
                    ) : null}
                </div>
            </Card>

            {/* Active filters */}
            {activeFilters.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-[var(--st-text)]">Applied:</span>
                    {activeFilters.map(([key, value]) => {
                        let display: string;
                        if (value instanceof Date) display = format(value, 'PP');
                        else display = String(value);
                        const label = key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, (s) => s.toUpperCase());
                        return (
                            <Badge key={key} variant="ghost">
                                {label}: {display}
                            </Badge>
                        );
                    })}
                </div>
            ) : null}

            {/* Charts row — funnel + source pie + stage line */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Pipeline funnel</h2>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            Leads per stage, ordered by volume.
                        </p>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={derived.funnel} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={120} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="leadCount" fill="hsl(var(--primary))" name="Leads" />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                <Card>
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Source split</h2>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            Distribution across lead sources.
                        </p>
                    </div>
                    {derived.sourcePie.length === 0 ? (
                        <p className="py-12 text-center text-[13px] text-[var(--st-text-secondary)]">
                            No source data yet.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={derived.sourcePie}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={50}
                                    outerRadius={90}
                                    paddingAngle={2}
                                >
                                    {derived.sourcePie.map((entry, idx) => (
                                        <Cell
                                            key={entry.name}
                                            fill={PIE_COLORS[idx % PIE_COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>

            {/* Stage trend (line) */}
            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Stage curve</h2>
                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                        Leads vs weighted value across pipeline stages.
                    </p>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={derived.stageLine}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" stroke="hsl(var(--primary))" />
                        <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--secondary))" />
                        <Tooltip />
                        <Legend />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="leadCount"
                            name="Leads"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="weightedValue"
                            name="Weighted value"
                            stroke="hsl(var(--secondary))"
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Card>

            {/* Per-stage table */}
            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Stages</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                    {pipelineSummary.map((stage) => (
                        <div
                            key={stage.name}
                            className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 text-center"
                        >
                            <h3 className="text-[13px] font-semibold text-[var(--st-text)]">{stage.name}</h3>
                            <p className="text-[22px] font-semibold text-[var(--st-text)]">{stage.leadCount}</p>
                            <p className="text-[11.5px] text-[var(--st-text-secondary)]">Leads</p>
                            <p className="mt-2 text-[11.5px] text-[var(--st-text-secondary)]">
                                Total: ₹{stage.totalValue.toLocaleString()}
                            </p>
                            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                Weighted: ₹{stage.weightedValue.toLocaleString()}
                            </p>
                            <p className="text-[11.5px] font-medium text-[var(--st-text)]">
                                AI Score: {stage.avgPredictiveScore ?? 0}/100
                            </p>
                        </div>
                    ))}
                </div>
            </Card>
        </EntityListShell>
    );
}
