'use client';

import React, { useState } from 'react';
import {
    Activity, Users, Download, Filter, Search, Plus, RefreshCw, Bell,
    Zap, ShieldCheck, Clock,
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

const RANGE_ITEMS = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom' },
] as const;

type RangeValue = (typeof RANGE_ITEMS)[number]['value'];

const KPIS = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: 'var(--st-accent)' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: 'var(--st-status-ok)' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: 'var(--st-accent)' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: 'var(--st-warn)' },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
    id: `INT-${1000 + i}`,
    name: `Integrations Zapier Item ${i + 1}`,
    status: 'Active',
    priority: 'High',
}));

const INSIGHTS = [1, 2, 3, 4, 5];

export default function IntegrationsZapierPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState<RangeValue>('7d');

    return (
        <div className="20ui flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            {/* Header */}
            <PageHeader className="px-8 py-6">
                <PageHeaderHeading>
                    <PageTitle>Integrations Zapier Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your integrations zapier workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton
                        label="Search dashboard"
                        icon={Search}
                        variant="secondary"
                        onClick={() => setSearchTerm(searchTerm)}
                    />
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
                    <Button variant="primary" iconLeft={Plus}>
                        Create New
                    </Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <SegmentedControl
                    items={RANGE_ITEMS}
                    value={range}
                    onChange={setRange}
                    aria-label="Time range"
                    size="sm"
                />
                <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" iconLeft={Filter}>
                        Filter
                    </Button>
                    <Button variant="secondary" size="sm" iconLeft={Download}>
                        Export
                    </Button>
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
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-2">
                        <Table density="compact" hover stickyHeader>
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
                                        <Td className="font-mono text-[var(--st-text-secondary)]">#{row.id}</Td>
                                        <Td className="font-medium">{row.name}</Td>
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
                    <Card variant="outlined" padding="lg" className="flex-1 overflow-y-auto">
                        <CardHeader className="flex items-center gap-2 mb-6">
                            <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
                            <CardTitle>AI Insights</CardTitle>
                        </CardHeader>
                        <div className="flex flex-col gap-4">
                            {INSIGHTS.map((i) => (
                                <Card key={i} variant="ghost" padding="md" className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)]">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">
                                        The system has detected an anomaly in the standard workflow pattern for integrations zapier.
                                    </p>
                                </Card>
                            ))}
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
