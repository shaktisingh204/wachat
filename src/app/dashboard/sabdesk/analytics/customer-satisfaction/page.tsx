'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Users,
  ShieldCheck,
  Clock,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Bell,
  Search,
  Zap,
  Inbox,
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
  SegmentedControl,
  type SegmentedItem,
  Field,
  Input,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  EmptyState,
} from '@/components/sabcrm/20ui';

type RangeValue = 'today' | '7d' | '30d' | 'quarter' | 'custom';

const RANGE_ITEMS: ReadonlyArray<SegmentedItem<RangeValue>> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
];

const KPIS = [
  { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#3b82f6' },
  { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#10b981' },
  { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#a855f7' },
  { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#f43f5e' },
];

interface FeedRow {
  id: string;
  name: string;
  status: string;
  priority: string;
}

const FEED_ROWS: FeedRow[] = Array.from({ length: 15 }).map((_, i) => ({
  id: `#ANA-${1000 + i}`,
  name: `Analytics Customer Satisfaction Item ${i + 1}`,
  status: 'Active',
  priority: 'High',
}));

const INSIGHTS = [
  { title: 'Optimization Required', body: 'The system has detected an anomaly in the standard workflow pattern for analytics customer satisfaction.' },
  { title: 'Response Time Drift', body: 'Average first-response time crept up 8 percent week over week across the support queue.' },
  { title: 'Sentiment Improving', body: 'Positive feedback on resolved tickets rose for the third consecutive reporting period.' },
  { title: 'Escalation Spike', body: 'High-priority escalations clustered on Tuesday afternoons. Consider shifting staffing.' },
  { title: 'Survey Coverage Low', body: 'Only 41 percent of closed conversations received a satisfaction survey this period.' },
];

export default function AnalyticsCustomerSatisfactionPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState<RangeValue>('7d');

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return FEED_ROWS;
    return FEED_ROWS.filter(
      (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
    );
  }, [searchTerm]);

  return (
    <div className="20ui flex flex-col w-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Analytics Customer Satisfaction Dashboard</PageTitle>
          <PageDescription>
            Manage and optimize your analytics customer satisfaction workflows and metrics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton label="Search" icon={Search} variant="outline" />
          <IconButton label="Notifications" icon={Bell} variant="outline" />
          <Button variant="primary" iconLeft={Plus}>
            Create New
          </Button>
        </PageActions>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)]">
        <SegmentedControl<RangeValue>
          items={RANGE_ITEMS}
          value={range}
          onChange={setRange}
          aria-label="Date range"
        />
        <div className="flex items-center gap-3">
          <Field className="w-64" label="">
            <Input
              type="search"
              placeholder="Search items"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              iconLeft={Search}
              aria-label="Search items"
            />
          </Field>
          <Button variant="secondary" iconLeft={Filter}>
            Filter
          </Button>
          <Button variant="secondary" iconLeft={Download}>
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
            <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto p-0">
            {filteredRows.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No matching items"
                description="No records match your search. Try a different term."
              />
            ) : (
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
                      <Td className="font-mono">{row.id}</Td>
                      <Td>{row.name}</Td>
                      <Td>
                        <Badge tone="success" dot>
                          {row.status}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge tone="danger">{row.priority}</Badge>
                      </Td>
                      <Td align="right">
                        <Button variant="ghost" size="sm">
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
        <Card className="col-span-12 xl:col-span-4 flex flex-col h-[600px]">
          <CardHeader className="flex items-center gap-2">
            <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
            <CardTitle>AI Insights</CardTitle>
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto space-y-4">
            {INSIGHTS.map((insight) => (
              <Card key={insight.title} variant="ghost" padding="sm" className="bg-[var(--st-bg-secondary)]">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                  <Badge tone="warning">Action</Badge>
                </div>
                <p className="text-sm text-[var(--st-text-secondary)]">{insight.body}</p>
              </Card>
            ))}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
