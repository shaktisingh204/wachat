'use client';
import React, { useState } from 'react';
import {
    Activity, Users, Filter, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck, Clock,
} from 'lucide-react';
import {
    Button,
    IconButton,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    StatCard,
    Badge,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Field,
    Input,
    SegmentedControl,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

const DATE_RANGES = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom' },
] as const;

type DateRange = (typeof DATE_RANGES)[number]['value'];

const KPIS = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#3b82f6' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#10b981' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#a855f7' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#f43f5e' },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
    id: `ANA-${1000 + i}`,
    name: `Analytics Ai Deflection Item ${i + 1}`,
    status: 'Active',
    priority: 'High',
}));

const INSIGHTS = [
    { title: 'Optimization Required', body: 'The system has detected an anomaly in the standard workflow pattern for analytics ai deflection.' },
    { title: 'Deflection Rate Up', body: 'Self-serve resolution climbed 8 points this week as the knowledge base expanded.' },
    { title: 'Routing Suggestion', body: 'Three intent clusters are best handled by the billing queue rather than the general inbox.' },
    { title: 'Coverage Gap', body: 'A recurring question about plan limits has no matching deflection article yet.' },
    { title: 'Response Quality', body: 'Suggested replies for refund requests are rated helpful 92 percent of the time.' },
];

export default function AnalyticsAiDeflectionPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState<DateRange>('7d');

    return (
        <div className="ui20 dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            {/* Header */}
            <PageHeader className="px-8 py-6">
                <PageHeaderHeading>
                    <PageTitle>Analytics Ai Deflection Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your analytics ai deflection workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} variant="secondary" />
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <SegmentedControl
                    aria-label="Date range"
                    items={DATE_RANGES.map((r) => ({ value: r.value, label: r.label }))}
                    value={range}
                    onChange={(v) => setRange(v as DateRange)}
                />
                <div className="flex items-center gap-3">
                    <div className="w-56">
                        <Field>
                            <Input
                                iconLeft={Search}
                                placeholder="Search items"
                                aria-label="Search items"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </Field>
                    </div>
                    <Button variant="secondary" iconLeft={Filter}>Filter</Button>
                    <Button variant="secondary" iconLeft={Download}>Export</Button>
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
                <Card variant="outlined" padding="none" className="col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex justify-between items-center">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-2">
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
                                {FEED_ROWS.map((row) => (
                                    <Tr key={row.id}>
                                        <Td className="font-mono text-[var(--st-text-secondary)]">
                                            #{row.id}
                                        </Td>
                                        <Td className="text-[var(--st-text)] font-medium">{row.name}</Td>
                                        <Td>
                                            <Badge tone="success" dot>{row.status}</Badge>
                                        </Td>
                                        <Td>
                                            <Badge tone="danger">{row.priority}</Badge>
                                        </Td>
                                        <Td align="right">
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
                    <Card variant="outlined" className="flex-1 overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
                                AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            {INSIGHTS.map((insight) => (
                                <Card key={insight.title} variant="ghost" padding="sm" className="bg-[var(--st-bg-secondary)]">
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">{insight.body}</p>
                                </Card>
                            ))}
                        </CardBody>
                    </Card>
                </div>
            </main>
        </div>
    );
}
