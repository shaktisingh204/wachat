'use client';
import React, { useState } from 'react';
import {
    Activity, Users, Filter, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck,
    Clock,
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

const DATE_RANGES = ['Today', '7 Days', '30 Days', 'This Quarter', 'Custom'] as const;

const KPIS = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#3b82f6' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#10b981' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#a855f7' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#f43f5e' },
];

export default function QualityAssuranceEvaluationsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeRange, setActiveRange] = useState<string>('7 Days');

    const rows = Array.from({ length: 15 }).map((_, i) => ({
        id: `#QUA-${1000 + i}`,
        name: `Quality Assurance Evaluations Item ${i + 1}`,
    }));

    const filteredRows = searchTerm.trim()
        ? rows.filter((r) =>
              r.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
              r.id.toLowerCase().includes(searchTerm.trim().toLowerCase()),
          )
        : rows;

    return (
        <div className="ui20 dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Quality Assurance Evaluations Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your quality assurance evaluations workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search evaluations" icon={Search} variant="secondary" />
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
                    <Button variant="primary" iconLeft={Plus}>Create New</Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <div className="flex flex-wrap gap-2">
                    {DATE_RANGES.map((t) => (
                        <Button
                            key={t}
                            size="sm"
                            variant={activeRange === t ? 'primary' : 'secondary'}
                            onClick={() => setActiveRange(t)}
                        >
                            {t}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <Field className="w-56" label="Search evaluations">
                        <Input
                            inputSize="sm"
                            iconLeft={Search}
                            placeholder="Search evaluations"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                            accent={kpi.accent}
                            delta={kpi.delta}
                        />
                    ))}
                </div>

                {/* Main Data View */}
                <Card padding="none" className="col-span-12 lg:col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh data feed" icon={RefreshCw} variant="ghost" />
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
                                {filteredRows.map((row) => (
                                    <Tr key={row.id}>
                                        <Td className="font-mono text-[var(--st-text-secondary)]">{row.id}</Td>
                                        <Td className="font-medium">{row.name}</Td>
                                        <Td>
                                            <Badge tone="success" dot>Active</Badge>
                                        </Td>
                                        <Td>
                                            <Badge tone="danger">High</Badge>
                                        </Td>
                                        <Td align="right">
                                            <Button size="sm" variant="ghost">View Details</Button>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>

                {/* Side Panel */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card padding="none" className="flex-1 overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" /> AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={i}
                                    className="p-4 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)]"
                                >
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">
                                        The system has detected an anomaly in the standard workflow pattern for quality assurance evaluations.
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
