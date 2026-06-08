'use client';
import React, { useState } from 'react';
import {
    Activity, Users, Filter, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck,
    Clock
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
    Field,
    Input,
    SegmentedControl,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
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
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
    id: `INT-${1000 + i}`,
    name: `Integrations Jira Item ${i + 1}`,
}));

const INSIGHTS = [1, 2, 3, 4, 5];

export default function IntegrationsJiraPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState('7d');

    return (
        <div className="20ui flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader className="px-8 py-6">
                <PageHeaderHeading>
                    <PageTitle>Integrations Jira Dashboard</PageTitle>
                    <PageDescription>Manage and optimize your integrations Jira workflows and metrics.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <div className="w-56">
                        <Field label="Search">
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search integrations"
                                iconLeft={Search}
                            />
                        </Field>
                    </div>
                    <IconButton label="Notifications" icon={Bell} variant="outline" />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <SegmentedControl
                    items={RANGE_ITEMS}
                    value={range}
                    onChange={setRange}
                    aria-label="Time range"
                />
                <div className="flex items-center gap-3">
                    <Button variant="outline" iconLeft={Filter}>Filter</Button>
                    <Button variant="outline" iconLeft={Download}>Export</Button>
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
                            accent={kpi.accent}
                        />
                    ))}
                </div>

                <Card variant="outlined" padding="none" className="col-span-12 lg:col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-2">
                        <Table stickyHeader>
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
                                        <Td className="font-medium text-[var(--st-text)]">{row.name}</Td>
                                        <Td><Badge tone="success">Active</Badge></Td>
                                        <Td><Badge tone="danger">High</Badge></Td>
                                        <Td align="right">
                                            <Button variant="ghost" size="sm">View Details</Button>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>

                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card variant="outlined" className="flex-1 overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
                                AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            {INSIGHTS.map((i) => (
                                <div
                                    key={i}
                                    className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">
                                        The system has detected an anomaly in the standard workflow pattern for integrations Jira.
                                    </p>
                                </div>
                            ))}
                        </CardBody>
                    </Card>
                </div>
            </main>
        </div>
    );
}
