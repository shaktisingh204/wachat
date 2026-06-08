'use client';
import React, { useMemo, useState } from 'react';
import {
    Activity, Users, Search, Download, Plus, RefreshCw, Bell, Zap,
    ShieldCheck, Clock, Filter,
} from 'lucide-react';
import {
    PageHeader, PageHeaderHeading, PageTitle, PageDescription, PageActions,
    Button, IconButton,
    Card, CardHeader, CardTitle, CardBody, StatCard,
    Table, THead, TBody, Tr, Th, Td,
    Badge,
    Field, Input,
    EmptyState,
    SegmentedControl,
    type SegmentedItem,
} from '@/components/sabcrm/20ui';

type StatusTone = 'success' | 'warning' | 'neutral';
type PriorityTone = 'danger' | 'warning' | 'neutral';

interface FeedRow {
    id: string;
    name: string;
    status: string;
    statusTone: StatusTone;
    priority: string;
    priorityTone: PriorityTone;
}

const RANGE_ITEMS: ReadonlyArray<SegmentedItem> = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom' },
];

const KPIS = [
    { label: 'Total Volume', value: '124,592', icon: Activity, delta: { value: '+14%', tone: 'up' as const } },
    { label: 'Active Users', value: '8,432', icon: Users, delta: { value: '+5%', tone: 'up' as const } },
    { label: 'System Health', value: '99.9%', icon: ShieldCheck, delta: { value: 'Stable', tone: 'neutral' as const } },
    { label: 'Avg Resolution', value: '1.2 hrs', icon: Clock, delta: { value: '-12%', tone: 'down' as const } },
];

const STATUS_CYCLE: ReadonlyArray<{ status: string; tone: StatusTone }> = [
    { status: 'Active', tone: 'success' },
    { status: 'Syncing', tone: 'warning' },
    { status: 'Paused', tone: 'neutral' },
];

const PRIORITY_CYCLE: ReadonlyArray<{ priority: string; tone: PriorityTone }> = [
    { priority: 'High', tone: 'danger' },
    { priority: 'Medium', tone: 'warning' },
    { priority: 'Low', tone: 'neutral' },
];

const FEED_ROWS: FeedRow[] = Array.from({ length: 15 }).map((_, i) => {
    const s = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const p = PRIORITY_CYCLE[i % PRIORITY_CYCLE.length];
    return {
        id: `INT-${1000 + i}`,
        name: `Active App Connection ${i + 1}`,
        status: s.status,
        statusTone: s.tone,
        priority: p.priority,
        priorityTone: p.tone,
    };
});

const INSIGHTS = [
    'The system detected an anomaly in the standard sync pattern for active apps.',
    'Two connections show elevated retry rates over the last 24 hours.',
    'Token refresh for the billing integration is due within 3 days.',
    'Throughput on the analytics pipeline is up 18 percent this week.',
    'One inactive app can be archived to reduce background polling.',
];

export default function IntegrationsActiveAppsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState('30d');

    const filteredRows = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return FEED_ROWS;
        return FEED_ROWS.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                r.id.toLowerCase().includes(q) ||
                r.status.toLowerCase().includes(q),
        );
    }, [searchTerm]);

    return (
        <div className="20ui flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader className="px-8">
                <PageHeaderHeading>
                    <PageTitle>Integrations Active Apps Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your active apps workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton icon={Search} label="Search" variant="ghost" />
                    <IconButton icon={Bell} label="Notifications" variant="ghost" />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)]">
                <SegmentedControl
                    items={RANGE_ITEMS}
                    value={range}
                    onChange={setRange}
                    aria-label="Time range"
                />
                <div className="flex items-center gap-3">
                    <Field label="Search apps" className="w-64">
                        <Input
                            inputSize="sm"
                            iconLeft={Search}
                            placeholder="Search active apps"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </Field>
                    <Button variant="outline" size="sm" iconLeft={Filter}>Filter</Button>
                    <Button variant="outline" size="sm" iconLeft={Download}>Export</Button>
                </div>
            </div>

            <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
                <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {KPIS.map((kpi) => (
                        <StatCard
                            key={kpi.label}
                            label={kpi.label}
                            value={kpi.value}
                            icon={kpi.icon}
                            delta={kpi.delta}
                            accent="var(--st-accent)"
                        />
                    ))}
                </div>

                <Card padding="none" className="col-span-12 lg:col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton icon={RefreshCw} label="Refresh feed" variant="ghost" size="sm" />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-0">
                        {filteredRows.length === 0 ? (
                            <EmptyState
                                icon={Search}
                                title="No matching apps"
                                description="Try a different search term to see active app connections."
                            />
                        ) : (
                            <Table stickyHeader hover>
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
                                            <Td className="font-mono text-[var(--st-text-secondary)]">#{row.id}</Td>
                                            <Td className="font-medium text-[var(--st-text)]">{row.name}</Td>
                                            <Td>
                                                <Badge tone={row.statusTone} dot>{row.status}</Badge>
                                            </Td>
                                            <Td>
                                                <Badge tone={row.priorityTone}>{row.priority}</Badge>
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

                <Card className="col-span-12 lg:col-span-4 flex flex-col h-[600px] overflow-hidden">
                    <CardHeader className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-[var(--st-warn)]" aria-hidden="true" />
                        <CardTitle>AI Insights</CardTitle>
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto space-y-4">
                        {INSIGHTS.map((insight, i) => (
                            <Card key={i} variant="outlined" padding="sm">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                    <Badge tone="warning" kind="soft">Action</Badge>
                                </div>
                                <p className="text-sm text-[var(--st-text-secondary)]">{insight}</p>
                            </Card>
                        ))}
                    </CardBody>
                </Card>
            </main>
        </div>
    );
}
