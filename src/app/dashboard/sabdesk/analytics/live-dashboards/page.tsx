'use client';
import React, { useState, useEffect } from 'react';
import { getLiveDashboardsData } from '@/app/actions/sabdesk-assist.actions';
import {
    Activity, Users, Search, Download,
    Plus, RefreshCw, Bell, Zap, ShieldCheck,
    Clock, Filter, Inbox,
} from 'lucide-react';
import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
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
    EmptyState,
    SegmentedControl,
    Spinner,
    useToast,
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
    { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#3b82f6' },
    { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#10b981' },
    { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#8b5cf6' },
    { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#f43f5e' },
];

const INSIGHTS = [1, 2, 3, 4, 5];

export default function AnalyticsLiveDashboardsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [range, setRange] = useState<RangeValue>('30d');
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    async function loadData() {
        setIsLoading(true);
        try {
            const res = await getLiveDashboardsData();
            if (res.success && res.data) {
                setData(res.data);
            }
        } catch (err) {
            console.error(err);
            toast.error('Could not load dashboard data.');
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="20ui flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Analytics Live Dashboards</PageTitle>
                    <PageDescription>
                        Manage and optimize your analytics live dashboards workflows and metrics.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <IconButton label="Search" icon={Search} variant="secondary" />
                    <IconButton label="Notifications" icon={Bell} variant="secondary" />
                    <Button variant="primary" iconLeft={Plus} onClick={() => toast.success('New dashboard created.')}>
                        Create New
                    </Button>
                </PageActions>
            </PageHeader>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <SegmentedControl
                    aria-label="Date range"
                    items={RANGE_ITEMS}
                    value={range}
                    onChange={(v) => setRange(v as RangeValue)}
                />
                <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" iconLeft={Filter} onClick={() => toast({ title: 'Filters', tone: 'info' })}>
                        Filter
                    </Button>
                    <Button variant="secondary" size="sm" iconLeft={Download} onClick={() => toast.success('Export started.')}>
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
                <Card variant="outlined" padding="none" className="col-span-12 lg:col-span-8 flex flex-col h-[600px]">
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Live Data Feed</CardTitle>
                        <IconButton label="Refresh data" icon={RefreshCw} variant="ghost" onClick={loadData} />
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Spinner size="lg" label="Loading dashboard items" />
                            </div>
                        ) : data.length > 0 ? (
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
                                    {data.map((item, i) => (
                                        <Tr key={item._id ?? i}>
                                            <Td className="font-mono text-[var(--st-text-secondary)]">
                                                {item._id ? `#ANA-${item._id.substring(0, 6)}` : `#ANA-${1000 + i}`}
                                            </Td>
                                            <Td className="font-medium text-[var(--st-text)]">
                                                {item.name || `Analytics Live Dashboards Item ${i + 1}`}
                                            </Td>
                                            <Td>
                                                <Badge tone="success" dot>Active</Badge>
                                            </Td>
                                            <Td>
                                                <Badge tone="danger">High</Badge>
                                            </Td>
                                            <Td align="right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toast({ title: 'Opening details', tone: 'info' })}
                                                >
                                                    View Details
                                                </Button>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        ) : (
                            <div className="flex items-center justify-center py-16">
                                <EmptyState
                                    icon={Inbox}
                                    title="No dashboard items found"
                                    description="Live records will appear here as soon as your workflows start reporting."
                                />
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Side Panel */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
                    <Card variant="outlined" padding="lg" className="flex-1 overflow-y-auto">
                        <CardTitle className="mb-6 flex items-center gap-2">
                            <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" /> AI Insights
                        </CardTitle>
                        <div className="space-y-4">
                            {INSIGHTS.map((i) => (
                                <Card key={i} variant="outlined" padding="md" className="bg-[var(--st-bg-secondary)]">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                                        <Badge tone="warning">Action</Badge>
                                    </div>
                                    <p className="text-sm text-[var(--st-text-secondary)]">
                                        The system has detected an anomaly in the standard workflow pattern for analytics live dashboards.
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
