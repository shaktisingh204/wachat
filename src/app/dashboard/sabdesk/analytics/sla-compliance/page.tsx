'use client';
import React, { useMemo, useState } from 'react';
import {
    Activity, Users, Download, Filter, Search, Plus, RefreshCw,
    Bell, Zap, ShieldCheck, Clock,
} from 'lucide-react';
import {
    PageHeader, PageHeaderHeading, PageTitle, PageDescription, PageActions,
    Button, IconButton,
    Card, CardHeader, CardTitle, CardBody, StatCard,
    Table, THead, TBody, Tr, Th, Td,
    Badge, Callout,
    Field, Input,
    SegmentedControl,
    EmptyState,
    toast,
} from '@/components/sabcrm/20ui';

type Kpi = {
    label: string;
    value: string;
    delta: { value: string; tone: 'up' | 'down' | 'neutral' };
    icon: typeof Activity;
    accent: string;
};

const KPIS: Kpi[] = [
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' }, icon: Activity, accent: 'var(--st-accent)' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' }, icon: Users, accent: 'var(--st-status-ok)' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' }, icon: ShieldCheck, accent: 'var(--st-accent)' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' }, icon: Clock, accent: 'var(--st-danger)' },
];

const RANGE_ITEMS = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom' },
] as const;

type RangeValue = (typeof RANGE_ITEMS)[number]['value'];

type SlaRecord = {
    id: string;
    name: string;
    status: 'Active' | 'Breached';
    priority: 'High' | 'Medium' | 'Low';
};

const RECORDS: SlaRecord[] = Array.from({ length: 15 }).map((_, i) => {
    const breached = i % 6 === 0;
    const priority: SlaRecord['priority'] = i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low';
    return {
        id: `ANA-${1000 + i}`,
        name: `Analytics SLA Compliance Item ${i + 1}`,
        status: breached ? 'Breached' : 'Active',
        priority,
    };
});

const INSIGHTS = [
    { title: 'Optimization Required', body: 'The system detected an anomaly in the standard workflow pattern for SLA compliance.' },
    { title: 'Response Time Drift', body: 'First-response time crept up 8 percent week over week on high-priority tickets.' },
    { title: 'Backlog Forming', body: 'Twelve tickets are within two hours of breaching their resolution SLA.' },
    { title: 'Agent Load Imbalance', body: 'Three agents are carrying 60 percent of the open queue. Consider rebalancing.' },
    { title: 'Off-Hours Coverage', body: 'Weekend SLAs hold at 99.1 percent. No action needed right now.' },
];

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = {
    High: 'danger',
    Medium: 'warning',
    Low: 'neutral',
};

export default function AnalyticsSlaCompliancePage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState<RangeValue>('30d');

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return RECORDS;
        return RECORDS.filter(
            (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
        );
    }, [searchTerm]);

    return (
        <div className="20ui flex flex-col w-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Analytics SLA Compliance</PageTitle>
                    <PageDescription>
                        Manage and optimize your SLA compliance workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} variant="ghost" />
                    <IconButton label="Notifications" icon={Bell} variant="ghost" />
                    <Button
                        variant="primary"
                        iconLeft={Plus}
                        onClick={() => toast.success('New SLA report created')}
                    >
                        Create New
                    </Button>
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
                    <Field className="w-64" label="">
                        <Input
                            iconLeft={Search}
                            placeholder="Search records"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            aria-label="Search records"
                        />
                    </Field>
                    <Button iconLeft={Filter} onClick={() => toast({ title: 'Filters', tone: 'info' })}>
                        Filter
                    </Button>
                    <Button iconLeft={Download} onClick={() => toast.success('Export started')}>
                        Export
                    </Button>
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
                        <IconButton
                            label="Refresh data feed"
                            icon={RefreshCw}
                            variant="ghost"
                            onClick={() => toast.success('Data feed refreshed')}
                        />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <EmptyState
                                icon={Search}
                                title="No matching records"
                                description="Try a different search term to see SLA compliance items."
                            />
                        ) : (
                            <Table density="comfortable" hover stickyHeader>
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
                                    {filtered.map((row) => (
                                        <Tr key={row.id}>
                                            <Td className="font-mono text-[var(--st-text-secondary)]">#{row.id}</Td>
                                            <Td className="font-medium">{row.name}</Td>
                                            <Td>
                                                <Badge
                                                    tone={row.status === 'Active' ? 'success' : 'danger'}
                                                    dot
                                                >
                                                    {row.status}
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <Badge tone={PRIORITY_TONE[row.priority]}>
                                                    {row.priority}
                                                </Badge>
                                            </Td>
                                            <Td align="right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toast({ title: `Opening ${row.id}`, tone: 'info' })}
                                                >
                                                    View Details
                                                </Button>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>

                {/* Side Panel */}
                <Card padding="none" className="col-span-12 lg:col-span-4 flex flex-col h-[600px]">
                    <CardHeader className="flex items-center gap-2">
                        <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
                        <CardTitle>AI Insights</CardTitle>
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto space-y-3">
                        {INSIGHTS.map((insight) => (
                            <div
                                key={insight.title}
                                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4"
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                                    <Badge tone="warning" kind="soft">Action</Badge>
                                </div>
                                <p className="text-sm text-[var(--st-text-secondary)]">{insight.body}</p>
                            </div>
                        ))}
                        <Callout tone="info" title="Tip">
                            Insights refresh every 15 minutes from the SLA compliance engine.
                        </Callout>
                    </CardBody>
                </Card>
            </main>
        </div>
    );
}
