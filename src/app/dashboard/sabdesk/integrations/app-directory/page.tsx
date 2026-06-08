'use client';
import React, { useState } from 'react';
import {
    Activity, Users, Search, Download, Plus, RefreshCw, Bell, Zap,
    ShieldCheck, Clock, Filter,
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
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

const RANGES = ['Today', '7 Days', '30 Days', 'This Quarter', 'Custom'];

const KPIS = [
    { label: 'Total Volume', value: '124,592', icon: Activity, accent: 'var(--st-accent)', delta: { value: '+14%', tone: 'up' as const } },
    { label: 'Active Users', value: '8,432', icon: Users, accent: 'var(--st-status-ok)', delta: { value: '+5%', tone: 'up' as const } },
    { label: 'System Health', value: '99.9%', icon: ShieldCheck, accent: 'var(--st-accent)', delta: { value: 'Stable', tone: 'neutral' as const } },
    { label: 'Avg Resolution', value: '1.2 hrs', icon: Clock, accent: 'var(--st-warn)', delta: { value: '-12%', tone: 'down' as const } },
];

const INSIGHTS = [
    { title: 'Optimization Required', tag: 'Action', body: 'The system detected an anomaly in the standard workflow pattern for the app directory sync.' },
    { title: 'Rate Limit Nearing', tag: 'Warning', body: 'The Slack connector is at 82 percent of its hourly call budget. Consider batching requests.' },
    { title: 'New Recommendation', tag: 'Tip', body: 'Enable webhook retries to reduce dropped events during provider downtime.' },
    { title: 'Credential Expiry', tag: 'Action', body: 'Two OAuth tokens expire within 7 days. Reconnect to avoid an outage.' },
    { title: 'Usage Spike', tag: 'Info', body: 'Inbound events rose 31 percent over the last 24 hours, mostly from the HubSpot integration.' },
];

const ROWS = Array.from({ length: 15 }).map((_, i) => ({
    id: `INT-${1000 + i}`,
    name: `App Directory Item ${i + 1}`,
    status: 'Active',
    priority: 'High',
}));

export default function IntegrationsAppDirectoryPage() {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="20ui dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Integrations App Directory</PageTitle>
                    <PageDescription>
                        Manage and optimize your integrations app directory workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} />
                    <IconButton label="Notifications" icon={Bell} />
                    <Button variant="primary" iconLeft={Plus}>
                        Create New
                    </Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <div className="flex flex-wrap gap-2">
                    {RANGES.map((t) => (
                        <Button key={t} variant="ghost" size="sm">
                            {t}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <Field className="w-56">
                        <Input
                            inputSize="sm"
                            iconLeft={Search}
                            placeholder="Search directory"
                            aria-label="Search directory"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </Field>
                    <Button variant="outline" size="sm" iconLeft={Filter}>
                        Filter
                    </Button>
                    <Button variant="outline" size="sm" iconLeft={Download}>
                        Export
                    </Button>
                </div>
            </div>

            {/* Main Content Grid */}
            <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
                {/* KPI Cards */}
                <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    {KPIS.map((kpi) => (
                        <StatCard
                            key={kpi.label}
                            label={kpi.label}
                            value={kpi.value}
                            icon={kpi.icon}
                            accent={kpi.accent}
                            delta={kpi.delta}
                        />
                    ))}
                </div>

                {/* Main Data View */}
                <Card padding="none" className="col-span-12 xl:col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh feed" icon={RefreshCw} />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto">
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
                                {ROWS.map((row) => (
                                    <Tr key={row.id}>
                                        <Td>
                                            <span className="font-mono text-[var(--st-text-secondary)]">#{row.id}</span>
                                        </Td>
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
                    </CardBody>
                </Card>

                {/* Side Panel */}
                <Card className="col-span-12 xl:col-span-4 flex flex-col h-[600px]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
                            AI Insights
                        </CardTitle>
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto space-y-4">
                        {INSIGHTS.map((insight, i) => (
                            <div
                                key={i}
                                className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                            >
                                <div className="flex justify-between items-start gap-3 mb-2">
                                    <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                                    <Badge tone="warning">{insight.tag}</Badge>
                                </div>
                                <p className="text-sm text-[var(--st-text-secondary)]">{insight.body}</p>
                            </div>
                        ))}
                    </CardBody>
                </Card>
            </main>
        </div>
    );
}
