'use client';
import React, { useState } from 'react';
import {
    Activity, Users, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck,
    Clock, Filter,
} from 'lucide-react';
import {
    Button,
    IconButton,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Badge,
    Field,
    Input,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

const KPIS = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: 'var(--st-accent)' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: 'var(--st-status-ok)' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: 'var(--st-accent)' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: 'var(--st-warn)' },
];

const TIME_RANGES = ['Today', '7 Days', '30 Days', 'This Quarter', 'Custom'];

export default function QualityAssuranceScorecardsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeRange, setActiveRange] = useState('7 Days');

    const rows = Array.from({ length: 15 }).map((_, i) => ({
        id: `#QUA-${1000 + i}`,
        name: `Quality Assurance Scorecards Item ${i + 1}`,
    }));

    const filteredRows = rows.filter((row) =>
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.id.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return (
        <div className="20ui flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            {/* Header */}
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Quality Assurance Scorecards Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your quality assurance scorecards workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} variant="secondary" />
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)]">
                <div className="flex flex-wrap items-center gap-2">
                    {TIME_RANGES.map((t) => (
                        <Button
                            key={t}
                            size="sm"
                            variant={activeRange === t ? 'primary' : 'ghost'}
                            onClick={() => setActiveRange(t)}
                        >
                            {t}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <Field className="w-64" label="">
                        <Input
                            inputSize="sm"
                            iconLeft={Search}
                            placeholder="Search scorecards"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            aria-label="Search scorecards"
                        />
                    </Field>
                    <Button size="sm" variant="secondary" iconLeft={Filter}>Filter</Button>
                    <Button size="sm" variant="secondary" iconLeft={Download}>Export</Button>
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
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh data feed" icon={RefreshCw} variant="ghost" size="sm" />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-2">
                        <Table hover stickyHeader>
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
                                        <Td className="font-mono text-[var(--st-text-secondary)]">{row.id}</Td>
                                        <Td className="font-medium">{row.name}</Td>
                                        <Td>
                                            <Badge tone="success">Active</Badge>
                                        </Td>
                                        <Td>
                                            <Badge tone="danger">High</Badge>
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
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card variant="outlined" padding="lg" className="flex-1 overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
                                AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody>
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Card key={i} variant="outlined" padding="md" className="bg-[var(--st-bg-secondary)]">
                                        <div className="flex justify-between items-start mb-2 gap-3">
                                            <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                            <Badge tone="warning">Action</Badge>
                                        </div>
                                        <p className="text-sm text-[var(--st-text-secondary)]">
                                            The system has detected an anomaly in the standard workflow pattern for quality assurance scorecards.
                                        </p>
                                    </Card>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </main>
        </div>
    );
}
