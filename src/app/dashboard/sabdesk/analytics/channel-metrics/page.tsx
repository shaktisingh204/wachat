'use client';

import React, { useState } from 'react';
import {
    Activity, Users, Search, Download, Plus, RefreshCw, Bell, Zap,
    ShieldCheck, Clock, Filter,
} from 'lucide-react';
import {
    PageHeader, PageHeaderHeading, PageTitle, PageDescription, PageActions,
    Button, IconButton,
    Card, CardHeader, CardTitle, CardBody,
    StatCard,
    Table, THead, TBody, Tr, Th, Td,
    Badge,
    Field, Input,
    type StatCardProps,
} from '@/components/sabcrm/20ui';

const DATE_RANGES = ['Today', '7 Days', '30 Days', 'This Quarter', 'Custom'];

const KPIS: Array<{ label: string; value: string; delta: StatCardProps['delta']; icon: StatCardProps['icon'] }> = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' }, icon: Activity },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' }, icon: Users },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' }, icon: ShieldCheck },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' }, icon: Clock },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
    id: `#ANA-${1000 + i}`,
    name: `Analytics Channel Metrics Item ${i + 1}`,
}));

const INSIGHTS = [1, 2, 3, 4, 5];

export default function AnalyticsChannelMetricsPage() {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="ui20 dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Analytics Channel Metrics Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your analytics channel metrics workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <div className="w-56">
                        <Field label="Search metrics" className="sr-only-label">
                            <Input
                                iconLeft={Search}
                                inputSize="sm"
                                placeholder="Search metrics"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </Field>
                    </div>
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <div className="flex flex-wrap gap-2">
                    {DATE_RANGES.map((t) => (
                        <Button key={t} variant="ghost" size="sm">{t}</Button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" iconLeft={Filter}>Filter</Button>
                    <Button variant="secondary" size="sm" iconLeft={Download}>Export</Button>
                </div>
            </div>

            {/* Main Content Grid */}
            <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
                {/* KPI Cards */}
                <div className="col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {KPIS.map((kpi) => (
                        <StatCard
                            key={kpi.label}
                            label={kpi.label}
                            value={kpi.value}
                            icon={kpi.icon}
                            delta={kpi.delta}
                        />
                    ))}
                </div>

                {/* Main Data View */}
                <Card padding="none" className="col-span-12 lg:col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-0">
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
                                        <Td className="font-mono text-[var(--st-text-secondary)]">{row.id}</Td>
                                        <Td className="font-medium">{row.name}</Td>
                                        <Td><Badge tone="success">Active</Badge></Td>
                                        <Td><Badge tone="danger">High</Badge></Td>
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
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card className="flex-1 overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
                                AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            {INSIGHTS.map((i) => (
                                <Card key={i} variant="outlined" padding="sm">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">
                                        The system has detected an anomaly in the standard workflow pattern for analytics channel metrics.
                                    </p>
                                </Card>
                            ))}
                        </CardBody>
                    </Card>
                </div>
            </main>
        </div>
    );
}
