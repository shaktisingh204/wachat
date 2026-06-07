'use client';
import React, { useState } from 'react';
import {
    Activity, Users, Filter, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck, Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Button,
    IconButton,
    Field,
    Input,
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
    EmptyState,
    SegmentedControl,
} from '@/components/sabcrm/20ui';

const RANGES = ['Today', '7 Days', '30 Days', 'This Quarter', 'Custom'] as const;

const KPIS: Array<{
    label: string;
    value: string;
    delta: { value: string; tone: 'up' | 'down' | 'neutral' };
    icon: LucideIcon;
    accent: string;
}> = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' }, icon: Activity, accent: '#2b6ef2' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' }, icon: Users, accent: '#2e7d32' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' }, icon: ShieldCheck, accent: '#7c5cff' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' }, icon: Clock, accent: '#c13c2c' },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
    id: `#INT-${1000 + i}`,
    name: `Integrations Slack Item ${i + 1}`,
    status: 'Active' as const,
    priority: 'High' as const,
}));

const INSIGHTS = Array.from({ length: 5 }).map((_, i) => ({
    id: i + 1,
    title: 'Optimization Required',
    body: 'The system has detected an anomaly in the standard workflow pattern for integrations slack.',
}));

export default function IntegrationsSlackPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState<string>('7 Days');

    const filteredRows = FEED_ROWS.filter((row) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return row.name.toLowerCase().includes(q) || row.id.toLowerCase().includes(q);
    });

    return (
        <div className="ui20 dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Integrations Slack Dashboard</PageTitle>
                    <PageDescription>Manage and optimize your integrations slack workflows and metrics.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <div className="w-56">
                        <Field label="Search records" className="!gap-1">
                            <Input
                                inputSize="sm"
                                iconLeft={Search}
                                placeholder="Search by name or ID"
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
                <SegmentedControl
                    items={RANGES.map((r) => ({ value: r, label: r }))}
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
                    <CardHeader className="flex justify-between items-center">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" size="sm" />
                    </CardHeader>
                    <div className="flex-1 overflow-y-auto">
                        {filteredRows.length === 0 ? (
                            <div className="p-8">
                                <EmptyState
                                    icon={Search}
                                    title="No matching records"
                                    description="No live data items match your search. Try a different term."
                                />
                            </div>
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
                                            <Td className="font-mono">{row.id}</Td>
                                            <Td>{row.name}</Td>
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
                        )}
                    </div>
                </Card>

                {/* Side Panel */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card variant="outlined" padding="none" className="flex-1 flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="text-[var(--st-warn)]" size={18} aria-hidden="true" /> AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="flex-1 overflow-y-auto space-y-4">
                            {INSIGHTS.map((insight) => (
                                <div
                                    key={insight.id}
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
