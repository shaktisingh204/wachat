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

const TIME_RANGES = ['Today', '7 Days', '30 Days', 'This Quarter', 'Custom'];

const KPIS = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#3b82f6' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#10b981' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#a855f7' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#f43f5e' },
];

export default function AiCopilotTicketSummarizationPage() {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="20ui flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            {/* Header */}
            <PageHeader className="px-8 py-6">
                <PageHeaderHeading>
                    <PageTitle>Ai Copilot Ticket Summarization Dashboard</PageTitle>
                    <PageDescription>Manage and optimize your ai copilot ticket summarization workflows and metrics.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} variant="secondary" />
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <div className="flex gap-2">
                    {TIME_RANGES.map((t) => (
                        <Button key={t} variant="ghost" size="sm">{t}</Button>
                    ))}
                </div>
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
                        <IconButton label="Refresh data" icon={RefreshCw} variant="ghost" />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-2">
                        <Table>
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
                                        <Td className="font-mono text-[var(--st-text-secondary)]">#AI-{1000 + i}</Td>
                                        <Td className="font-medium">Ai Copilot Ticket Summarization Item {i + 1}</Td>
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
                <div className="col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card className="flex-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="text-[var(--st-warn)]" size={18} aria-hidden="true" /> AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Card key={i} variant="ghost" padding="sm" className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">The system has detected an anomaly in the standard workflow pattern for ai copilot ticket summarization.</p>
                                </Card>
                            ))}
                        </CardBody>
                    </Card>
                </div>
            </main>
        </div>
    );
}
