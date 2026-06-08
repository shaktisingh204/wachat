'use client';

import React, { useState } from 'react';
import {
    Activity, Users, Filter, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck, Clock,
} from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Button,
    IconButton,
    SegmentedControl,
    StatCard,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Badge,
} from '@/components/sabcrm/20ui';

const TIME_RANGES = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom' },
] as const;

type TimeRange = (typeof TIME_RANGES)[number]['value'];

const KPIS = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#3b82f6' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#10b981' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#8b5cf6' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#f43f5e' },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
    id: `WOR-${1000 + i}`,
    name: `Workforce Forecast Item ${i + 1}`,
    status: 'Active',
    priority: 'High',
}));

const INSIGHTS = [
    { title: 'Optimization Required', body: 'The system detected an anomaly in the standard workflow pattern for workforce forecast.' },
    { title: 'Capacity Surge', body: 'Projected ticket volume exceeds staffed capacity for the upcoming Friday shift.' },
    { title: 'SLA Drift', body: 'Average resolution time trended up 8 percent over the last three days.' },
    { title: 'Schedule Gap', body: 'Two agents are unassigned during the peak afternoon window on Wednesday.' },
    { title: 'Forecast Updated', body: 'The next 30 day demand model has been refreshed with the latest interaction data.' },
];

export default function WorkforceForecastPage() {
    const [range, setRange] = useState<TimeRange>('7d');

    return (
        <div className="20ui dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            {/* Header */}
            <PageHeader className="px-8 py-6">
                <PageHeaderHeading>
                    <PageTitle>Workforce Forecast Dashboard</PageTitle>
                    <PageDescription>Manage and optimize your workforce forecast workflows and metrics.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} variant="secondary" />
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)]">
                <SegmentedControl
                    items={TIME_RANGES}
                    value={range}
                    onChange={setRange}
                    aria-label="Time range"
                />
                <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" iconLeft={Filter}>Filter</Button>
                    <Button variant="secondary" size="sm" iconLeft={Download}>Export</Button>
                </div>
            </div>

            {/* Main Content Grid */}
            <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
                {/* KPI Cards */}
                <div className="col-span-12 grid grid-cols-4 gap-6">
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
                <Card padding="none" className="col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex justify-between items-center">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh data feed" icon={RefreshCw} variant="ghost" />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-2">
                        <Table stickyHeader hover>
                            <THead>
                                <Tr>
                                    <Th>ID</Th>
                                    <Th>Name</Th>
                                    <Th>Status</Th>
                                    <Th>Priority</Th>
                                    <Th>Action</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {FEED_ROWS.map((row) => (
                                    <Tr key={row.id}>
                                        <Td className="font-mono text-[var(--st-text-secondary)]">#{row.id}</Td>
                                        <Td className="font-medium">{row.name}</Td>
                                        <Td><Badge tone="success">{row.status}</Badge></Td>
                                        <Td><Badge tone="danger">{row.priority}</Badge></Td>
                                        <Td>
                                            <Button variant="ghost" size="sm">View Details</Button>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>

                {/* Side Panel */}
                <div className="col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card className="flex-1 overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" /> AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            {INSIGHTS.map((insight) => (
                                <div
                                    key={insight.title}
                                    className="p-4 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)]"
                                >
                                    <div className="flex justify-between items-start gap-3 mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                                        <Badge tone="warning">Action</Badge>
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
