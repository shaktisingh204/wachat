'use client';
import React, { useState } from 'react';
import {
    Activity, Users, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck,
    Clock, Filter,
} from 'lucide-react';
import {
    PageHeader, PageHeaderHeading, PageTitle, PageDescription, PageActions,
    Button, IconButton,
    Card, CardHeader, CardTitle, CardBody,
    StatCard,
    Table, THead, TBody, Tr, Th, Td,
    Badge,
    Input,
    SegmentedControl,
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

const INSIGHTS = [
    { title: 'Optimization Required', detail: 'Anomaly detected in the standard workflow pattern for sentiment scoring on inbound tickets.' },
    { title: 'Sentiment Drift', detail: 'Negative sentiment rose 8 percent week over week in the billing queue. Review macro replies.' },
    { title: 'Coverage Gap', detail: 'Spanish-language conversations lack a tuned model. Confidence scores trend low.' },
    { title: 'Escalation Spike', detail: 'High-priority threads cleared 12 percent faster after the latest model refresh.' },
    { title: 'Model Health', detail: 'Copilot precision holds at 96 percent. No retraining action needed this cycle.' },
];

const ROWS = Array.from({ length: 15 }).map((_, i) => ({
    id: 1000 + i,
    name: `Sentiment Analysis Item ${i + 1}`,
    status: 'Active',
    priority: 'High',
}));

export default function AiCopilotSentimentAnalysisPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState('7d');

    return (
        <div className="flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            {/* Header */}
            <PageHeader className="px-8 py-6">
                <PageHeaderHeading>
                    <PageTitle>Ai Copilot Sentiment Analysis</PageTitle>
                    <PageDescription>
                        Manage and optimize your AI copilot sentiment analysis workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} variant="secondary" />
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
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
                    <div className="w-56">
                        <Input
                            iconLeft={Search}
                            placeholder="Search items"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            aria-label="Search items"
                        />
                    </div>
                    <Button variant="secondary" iconLeft={Filter}>Filter</Button>
                    <Button variant="secondary" iconLeft={Download}>Export</Button>
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
                                {ROWS.map((row) => (
                                    <Tr key={row.id}>
                                        <Td className="font-mono text-[var(--st-text-secondary)]">#AI-{row.id}</Td>
                                        <Td className="font-medium">{row.name}</Td>
                                        <Td><Badge tone="success">{row.status}</Badge></Td>
                                        <Td><Badge tone="danger">{row.priority}</Badge></Td>
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
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card padding="none" className="flex-1 overflow-hidden flex flex-col">
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
                                    className="p-4 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)]"
                                >
                                    <div className="flex justify-between items-start mb-2 gap-3">
                                        <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">{insight.detail}</p>
                                </div>
                            ))}
                        </CardBody>
                    </Card>
                </div>
            </main>
        </div>
    );
}
