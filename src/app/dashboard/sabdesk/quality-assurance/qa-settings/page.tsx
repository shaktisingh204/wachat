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
    { label: 'Total Volume', value: '124,592', icon: Activity, delta: { value: '+14%', tone: 'up' as const } },
    { label: 'Active Users', value: '8,432', icon: Users, delta: { value: '+5%', tone: 'up' as const } },
    { label: 'System Health', value: '99.9%', icon: ShieldCheck, delta: { value: 'Stable', tone: 'neutral' as const } },
    { label: 'Avg Resolution', value: '1.2 hrs', icon: Clock, delta: { value: '-12%', tone: 'down' as const } },
];

export default function QualityAssuranceQaSettingsPage() {
    const [range, setRange] = useState<RangeValue>('30d');

    return (
        <div className="ui20 dark flex flex-col w-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Quality Assurance Qa Settings Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your quality assurance qa settings workflows and metrics.
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
                <SegmentedControl
                    items={RANGE_ITEMS}
                    value={range}
                    onChange={setRange}
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
                            accent="var(--st-accent)"
                        />
                    ))}
                </div>

                {/* Main Data View */}
                <Card className="col-span-12 lg:col-span-8 flex flex-col h-[600px]" padding="none">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
                    </CardHeader>
                    <div className="flex-1 overflow-y-auto">
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
                                {Array.from({ length: 15 }).map((_, i) => (
                                    <Tr key={i}>
                                        <Td className="font-mono text-[var(--st-text-secondary)]">#QUA-{1000 + i}</Td>
                                        <Td className="font-medium text-[var(--st-text)]">
                                            Quality Assurance Qa Settings Item {i + 1}
                                        </Td>
                                        <Td>
                                            <Badge tone="success" dot>Active</Badge>
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
                    </div>
                </Card>

                {/* Side Panel */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card className="flex-1 overflow-y-auto" padding="lg">
                        <CardTitle className="mb-6 flex items-center gap-2">
                            <Zap size={18} className="text-[var(--st-accent)]" aria-hidden="true" />
                            AI Insights
                        </CardTitle>
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Card key={i} variant="outlined" padding="md" className="bg-[var(--st-bg-secondary)]">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">
                                        The system has detected an anomaly in the standard workflow pattern for quality assurance qa settings.
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
