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
    SegmentedControl,
} from '@/components/sabcrm/20ui';

const KPIS = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: 'var(--st-accent)' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: 'var(--st-status-ok)' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: 'var(--st-accent)' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: 'var(--st-warn)' },
];

const RANGE_ITEMS = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom' },
] as const;

type RangeValue = (typeof RANGE_ITEMS)[number]['value'];

const INSIGHTS = [
    'The system has detected an anomaly in the standard workflow pattern for analytics ticket volume.',
    'Incoming ticket spikes correlate with the Monday morning support window. Consider staffing adjustments.',
    'Resolution time improved 12 percent after the last routing rule change. Keep the new assignment policy.',
    'Three saved views have not been opened in 30 days. Archiving them will declutter the dashboard.',
    'A recurring tag, billing-question, accounts for 18 percent of volume. A macro could speed replies.',
];

export default function AnalyticsTicketVolumePage() {
    const [range, setRange] = useState<RangeValue>('7d');

    return (
        <div className="20ui flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            {/* Header */}
            <PageHeader className="px-8">
                <PageHeaderHeading>
                    <PageTitle>Analytics Ticket Volume Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your analytics ticket volume workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} />
                    <IconButton label="Notifications" icon={Bell} />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <SegmentedControl
                    items={RANGE_ITEMS}
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
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh feed" icon={RefreshCw} />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-2">
                        <Table density="compact" hover stickyHeader>
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
                                {Array.from({ length: 15 }).map((_, i) => (
                                    <Tr key={i}>
                                        <Td className="font-mono text-[var(--st-text-secondary)]">#ANA-{1000 + i}</Td>
                                        <Td className="font-medium">Analytics Ticket Volume Item {i + 1}</Td>
                                        <Td>
                                            <Badge tone="success" dot>Active</Badge>
                                        </Td>
                                        <Td>
                                            <Badge tone="danger">High</Badge>
                                        </Td>
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
                                <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" /> AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            {INSIGHTS.map((insight, i) => (
                                <div
                                    key={i}
                                    className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                                >
                                    <div className="flex justify-between items-start gap-3 mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">{insight}</p>
                                </div>
                            ))}
                        </CardBody>
                    </Card>
                </div>
            </main>
        </div>
    );
}
