'use client';
import React, { useMemo, useState } from 'react';
import {
    Activity, Users, Bell, Zap, ShieldCheck, Clock, Plus,
    Filter, Download, RefreshCw, Search, Inbox,
} from 'lucide-react';
import {
    PageHeader, PageHeaderHeading, PageTitle, PageDescription, PageActions,
    Button, IconButton,
    Card, CardHeader, CardTitle, CardBody,
    StatCard,
    SegmentedControl,
    Field, Input,
    Table, THead, TBody, Tr, Th, Td,
    Badge,
    EmptyState,
} from '@/components/sabcrm/20ui';

type StatusTone = 'success' | 'warning' | 'neutral';
type PriorityTone = 'danger' | 'warning' | 'info';

interface FeedRow {
    id: string;
    name: string;
    status: { label: string; tone: StatusTone };
    priority: { label: string; tone: PriorityTone };
}

const KPIS = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#2b6ef2' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#2e7d32' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#7c5cff' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#c13c2c' },
];

const RANGE_ITEMS = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom' },
] as const;
type RangeValue = (typeof RANGE_ITEMS)[number]['value'];

const FEED_ROWS: FeedRow[] = Array.from({ length: 15 }).map((_, i) => ({
    id: `ANA-${1000 + i}`,
    name: `Analytics Agent Performance Item ${i + 1}`,
    status: { label: 'Active', tone: 'success' },
    priority: { label: 'High', tone: 'danger' },
}));

const INSIGHTS = [
    { title: 'Optimization Required', body: 'The system detected an anomaly in the standard workflow pattern for analytics agent performance.' },
    { title: 'Routing Imbalance', body: 'Two agents are carrying 60 percent of inbound volume this period. Consider rebalancing.' },
    { title: 'SLA at Risk', body: 'Three conversations are projected to breach the 4 hour resolution target within the hour.' },
    { title: 'CSAT Trending Up', body: 'Satisfaction climbed 8 points week over week after the macro template refresh.' },
    { title: 'Backlog Cleared', body: 'The overnight queue was fully resolved. No pending tickets remain from yesterday.' },
];

export default function AnalyticsAgentPerformancePage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState<RangeValue>('7d');

    const filteredRows = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return FEED_ROWS;
        return FEED_ROWS.filter(
            (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
        );
    }, [searchTerm]);

    return (
        <div className="20ui dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Analytics Agent Performance Dashboard</PageTitle>
                    <PageDescription>Manage and optimize your analytics agent performance workflows and metrics.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <div className="w-56">
                        <Field label="Search feed">
                            <Input
                                inputSize="sm"
                                iconLeft={Search}
                                placeholder="Search items"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </Field>
                    </div>
                    <IconButton label="Notifications" icon={Bell} variant="ghost" />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <SegmentedControl
                    items={RANGE_ITEMS}
                    value={range}
                    onChange={setRange}
                    size="sm"
                    aria-label="Date range"
                />
                <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" iconLeft={Filter}>Filter</Button>
                    <Button variant="secondary" size="sm" iconLeft={Download}>Export</Button>
                </div>
            </div>

            {/* Main Content Grid */}
            <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
                {/* KPI Cards */}
                <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {KPIS.map((kpi) => (
                        <StatCard
                            key={kpi.label}
                            label={kpi.label}
                            value={kpi.value}
                            icon={kpi.icon}
                            delta={kpi.delta}
                            accent={kpi.accent}
                        />
                    ))}
                </div>

                {/* Main Data View */}
                <Card variant="outlined" padding="none" className="col-span-12 lg:col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" size="sm" />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-0">
                        {filteredRows.length === 0 ? (
                            <EmptyState
                                icon={Inbox}
                                title="No matching items"
                                description="Try a different search term to find feed entries."
                            />
                        ) : (
                            <Table density="comfortable" hover stickyHeader>
                                <THead>
                                    <Tr>
                                        <Th>ID</Th>
                                        <Th>Name</Th>
                                        <Th>Status</Th>
                                        <Th>Priority</Th>
                                        <Th align="right">Action</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {filteredRows.map((row) => (
                                        <Tr key={row.id}>
                                            <Td>
                                                <span className="font-mono text-[var(--st-text-secondary)]">#{row.id}</span>
                                            </Td>
                                            <Td>
                                                <span className="font-medium text-[var(--st-text)]">{row.name}</span>
                                            </Td>
                                            <Td>
                                                <Badge tone={row.status.tone} dot>{row.status.label}</Badge>
                                            </Td>
                                            <Td>
                                                <Badge tone={row.priority.tone}>{row.priority.label}</Badge>
                                            </Td>
                                            <Td align="right">
                                                <Button variant="ghost" size="sm">View Details</Button>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>

                {/* Side Panel */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card variant="outlined" className="flex-1 overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
                                AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            {INSIGHTS.map((insight) => (
                                <div
                                    key={insight.title}
                                    className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                                >
                                    <div className="flex justify-between items-start gap-3 mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                                        <Badge tone="warning" kind="soft">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">{insight.body}</p>
                                </div>
                            ))}
                        </CardBody>
                    </Card>
                </div>
            </main>
        </div>
    );
}
