'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Users,
  ShieldCheck,
  Clock,
  Filter,
  Search,
  Download,
  Plus,
  RefreshCw,
  Bell,
  Zap,
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

const RANGE_ITEMS = [
  { value: 'today' as const, label: 'Today' },
  { value: '7d' as const, label: '7 Days' },
  { value: '30d' as const, label: '30 Days' },
  { value: 'quarter' as const, label: 'This Quarter' },
  { value: 'custom' as const, label: 'Custom' },
];

const KPIS = [
  { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: 'var(--st-accent)' },
  { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: 'var(--st-status-ok)' },
  { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: 'var(--st-accent)' },
  { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: 'var(--st-warn)' },
];

interface DisputeRow {
  id: string;
  name: string;
  status: 'Active' | 'Resolved' | 'Pending';
  priority: 'High' | 'Medium' | 'Low';
}

const DISPUTE_ROWS: DisputeRow[] = Array.from({ length: 15 }).map((_, i) => {
  const statuses: DisputeRow['status'][] = ['Active', 'Pending', 'Resolved'];
  const priorities: DisputeRow['priority'][] = ['High', 'Medium', 'Low'];
  return {
    id: `QUA-${1000 + i}`,
    name: `Quality Assurance Dispute Item ${i + 1}`,
    status: statuses[i % statuses.length],
    priority: priorities[i % priorities.length],
  };
});

const STATUS_TONE: Record<DisputeRow['status'], 'success' | 'warning' | 'neutral'> = {
  Active: 'success',
  Pending: 'warning',
  Resolved: 'neutral',
};

const PRIORITY_TONE: Record<DisputeRow['priority'], 'danger' | 'warning' | 'neutral'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
};

const INSIGHTS = [
  { title: 'Optimization Required', body: 'The system has detected an anomaly in the standard workflow pattern for quality assurance disputes.' },
  { title: 'Resolution Time Spike', body: 'Average resolution time rose 9 percent in the EU region over the last 24 hours.' },
  { title: 'Duplicate Disputes', body: 'Twelve disputes appear to reference the same underlying order. Consider merging.' },
  { title: 'SLA at Risk', body: 'Four high priority disputes are within two hours of breaching their SLA window.' },
  { title: 'Sentiment Shift', body: 'Customer sentiment on reopened disputes trended negative this week.' },
];

export default function QualityAssuranceDisputesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState<RangeValue>('7d');

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return DISPUTE_ROWS;
    return DISPUTE_ROWS.filter(
      (row) =>
        row.id.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        row.priority.toLowerCase().includes(q),
    );
  }, [searchTerm]);

  return (
    <div className="20ui flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Quality Assurance Disputes Dashboard</PageTitle>
          <PageDescription>
            Manage and optimize your quality assurance disputes workflows and metrics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton label="Search disputes" icon={Search} variant="secondary" />
          <IconButton label="Notifications" icon={Bell} variant="secondary" />
          <Button variant="primary" iconLeft={Plus}>
            Create New
          </Button>
        </PageActions>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)]">
        <SegmentedControl
          items={RANGE_ITEMS}
          value={range}
          onChange={(v) => setRange(v as RangeValue)}
          aria-label="Date range"
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" iconLeft={Filter}>
            Filter
          </Button>
          <Button variant="secondary" size="sm" iconLeft={Download}>
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
              delta={kpi.delta}
              accent={kpi.accent}
            />
          ))}
        </div>

        {/* Main Data View */}
        <Card padding="none" className="col-span-12 xl:col-span-8 flex flex-col h-[600px]">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Live Data Feed</CardTitle>
            <div className="flex items-center gap-2">
              <Field label="Search disputes" className="sr-only">
                <Input
                  inputSize="sm"
                  iconLeft={Search}
                  placeholder="Search disputes"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Field>
              <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
            </div>
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto">
            {filteredRows.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No disputes match your search"
                description="Try a different ID, name, status, or priority."
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
                      <Td className="font-mono text-[var(--st-text-secondary)]">#{row.id}</Td>
                      <Td className="font-medium">{row.name}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[row.status]} dot>
                          {row.status}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge tone={PRIORITY_TONE[row.priority]}>{row.priority}</Badge>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" /> AI Insights
            </CardTitle>
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto space-y-4">
            {INSIGHTS.map((insight) => (
              <Card key={insight.title} variant="outlined" padding="sm">
                <div className="flex justify-between items-start gap-3 mb-2">
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
