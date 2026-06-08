'use client';
import React, { useState } from 'react';
import {
    Activity, Users, Filter, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck, Clock, Inbox,
} from 'lucide-react';
import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Button,
    IconButton,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    StatCard,
    SegmentedControl,
    Input,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Badge,
    EmptyState,
} from '@/components/sabcrm/20ui';

const KPIS = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: 'var(--st-accent)' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: 'var(--st-status-ok)' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: 'var(--st-accent)' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: 'var(--st-danger)' },
];

const RANGE_ITEMS = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom' },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
    id: `ANA-${1000 + i}`,
    name: `Analytics Overview Item ${i + 1}`,
    status: 'Active' as const,
    priority: 'High' as const,
}));

const INSIGHTS = Array.from({ length: 5 }).map((_, i) => ({
    id: i,
    title: 'Optimization Required',
    body: 'The system has detected an anomaly in the standard workflow pattern for analytics overview.',
}));

export default function AnalyticsOverviewPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState('7d');

    const query = searchTerm.trim().toLowerCase();
    const visibleRows = query
        ? FEED_ROWS.filter(
              (row) =>
                  row.id.toLowerCase().includes(query) ||
                  row.name.toLowerCase().includes(query),
          )
        : FEED_ROWS;

    return (
        <div className="20ui flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Analytics Overview Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your analytics overview workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} variant="secondary" />
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
                    <Button variant="primary" iconLeft={Plus}>
                        Create New
                    </Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <SegmentedControl
                    items={RANGE_ITEMS}
                    value={range}
                    onChange={setRange}
                    aria-label="Date range"
                />
                <div className="flex items-center gap-3">
                    <Button variant="secondary" iconLeft={Filter}>
                        Filter
                    </Button>
                    <Button variant="secondary" iconLeft={Download}>
                        Export
                    </Button>
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
                <Card padding="none" className="col-span-12 lg:col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex items-center justify-between gap-4">
                        <CardTitle>Live Data Feed</CardTitle>
                        <div className="flex items-center gap-3">
                            <Input
                                inputSize="sm"
                                iconLeft={Search}
                                placeholder="Search feed"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                aria-label="Search live data feed"
                            />
                            <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
                        </div>
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-2">
                        {visibleRows.length === 0 ? (
                            <EmptyState
                                icon={Inbox}
                                title="No matching records"
                                description="No feed items match your search. Try a different term."
                            />
                        ) : (
                            <Table hover>
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
                                    {visibleRows.map((row) => (
                                        <Tr key={row.id}>
                                            <Td className="font-mono text-[var(--st-text-secondary)]">
                                                #{row.id}
                                            </Td>
                                            <Td className="font-medium">{row.name}</Td>
                                            <Td>
                                                <Badge tone="success" dot>
                                                    {row.status}
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <Badge tone="danger">{row.priority}</Badge>
                                            </Td>
                                            <Td>
                                                <Button variant="ghost" size="sm">
                                                    View Details
                                                </Button>
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
                    <Card padding="lg" className="flex-1 overflow-y-auto">
                        <CardTitle className="mb-6 flex items-center gap-2">
                            <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
                            AI Insights
                        </CardTitle>
                        <div className="space-y-4">
                            {INSIGHTS.map((insight) => (
                                <div
                                    key={insight.id}
                                    className="p-4 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)]"
                                >
                                    <div className="flex justify-between items-start mb-2 gap-3">
                                        <h4 className="font-medium text-[var(--st-text)]">
                                            {insight.title}
                                        </h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">
                                        {insight.body}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
