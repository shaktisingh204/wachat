'use client';
import React, { useState } from 'react';
import {
    Activity, Users, Filter, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck, Clock,
    type LucideIcon,
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
    useToast,
} from '@/components/sabcrm/20ui';

type Kpi = {
    label: string;
    value: string;
    change: string;
    icon: LucideIcon;
    accent: string;
};

const KPIS: Kpi[] = [
    { label: 'Total Volume', value: '124,592', change: '+14%', icon: Activity, accent: 'var(--st-accent)' },
    { label: 'Active Users', value: '8,432', change: '+5%', icon: Users, accent: 'var(--st-status-ok)' },
    { label: 'System Health', value: '99.9%', change: 'Stable', icon: ShieldCheck, accent: 'var(--st-info)' },
    { label: 'Avg Resolution', value: '1.2 hrs', change: '-12%', icon: Clock, accent: 'var(--st-danger)' },
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
    'The system has detected an anomaly in the standard workflow pattern for integrations hubspot.',
    'Contact sync latency is trending above target. Review the field mapping configuration.',
    'Deal stage automation matched 312 records this week, up from last period.',
    'A duplicate contact rule fired 18 times. Consider tightening the match criteria.',
    'Pipeline value forecast updated. Three deals shifted into the closing stage.',
];

export default function IntegrationsHubspotPage() {
    const [range, setRange] = useState<RangeValue>('7d');
    const { toast } = useToast();

    return (
        <div className="ui20 flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            {/* Header */}
            <PageHeader className="px-8 py-6">
                <PageHeaderHeading>
                    <PageTitle>Integrations Hubspot Dashboard</PageTitle>
                    <PageDescription>
                        Manage and optimize your integrations hubspot workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton
                        label="Search"
                        icon={Search}
                        variant="secondary"
                        onClick={() => toast.info('Search is coming soon')}
                    />
                    <IconButton
                        label="Notifications"
                        icon={Bell}
                        variant="secondary"
                        onClick={() => toast.info('No new notifications')}
                    />
                    <Button
                        variant="primary"
                        iconLeft={Plus}
                        onClick={() => toast.success('New integration started')}
                    >
                        Create New
                    </Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <SegmentedControl
                    aria-label="Time range"
                    items={RANGE_ITEMS}
                    value={range}
                    onChange={setRange}
                    size="sm"
                />
                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={Filter}
                        onClick={() => toast.info('Filters are coming soon')}
                    >
                        Filter
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={Download}
                        onClick={() => toast.success('Export started')}
                    >
                        Export
                    </Button>
                </div>
            </div>

            {/* Main Content Grid */}
            <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
                {/* KPI Cards */}
                <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    {KPIS.map((kpi) => {
                        const Icon = kpi.icon;
                        return (
                            <Card key={kpi.label} variant="outlined" padding="lg" className="relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10" aria-hidden="true">
                                    <Icon className="w-24 h-24" />
                                </div>
                                <div
                                    className="w-12 h-12 rounded-[var(--st-radius)] flex items-center justify-center mb-4"
                                    style={{ background: `color-mix(in srgb, ${kpi.accent} 12%, transparent)`, color: kpi.accent }}
                                    aria-hidden="true"
                                >
                                    <Icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-[var(--st-text-secondary)] font-medium mb-1">{kpi.label}</h3>
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-bold text-[var(--st-text)]">{kpi.value}</span>
                                    <span className="text-sm font-medium mb-1 text-[var(--st-status-ok)]">{kpi.change}</span>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {/* Main Data View */}
                <Card variant="outlined" padding="none" className="col-span-12 xl:col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex justify-between items-center">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton
                            label="Refresh data feed"
                            icon={RefreshCw}
                            variant="ghost"
                            onClick={() => toast.success('Data feed refreshed')}
                        />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-2">
                        <Table hover>
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
                                        <Td className="font-mono text-[var(--st-text-secondary)]">#INT-{1000 + i}</Td>
                                        <Td className="font-medium text-[var(--st-text)]">Integrations Hubspot Item {i + 1}</Td>
                                        <Td>
                                            <Badge tone="success">Active</Badge>
                                        </Td>
                                        <Td>
                                            <Badge tone="danger">High</Badge>
                                        </Td>
                                        <Td align="right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toast.info(`Opening Integrations Hubspot Item ${i + 1}`)}
                                            >
                                                View Details
                                            </Button>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>

                {/* Side Panel */}
                <div className="col-span-12 xl:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card variant="outlined" padding="lg" className="flex-1 overflow-y-auto">
                        <CardTitle className="mb-6 flex items-center gap-2">
                            <Zap className="text-[var(--st-warn)]" size={18} aria-hidden="true" /> AI Insights
                        </CardTitle>
                        <div className="space-y-4">
                            {INSIGHTS.map((text, i) => (
                                <div
                                    key={i}
                                    className="p-4 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)]"
                                >
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">{text}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
