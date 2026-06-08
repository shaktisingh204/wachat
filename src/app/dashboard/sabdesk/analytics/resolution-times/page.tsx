'use client';

import React, { useState } from 'react';
import {
  Activity,
  Users,
  Filter,
  Search,
  Download,
  Plus,
  RefreshCw,
  Bell,
  Zap,
  ShieldCheck,
  Clock,
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
  Field,
  Input,
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
  type StatCardProps,
} from '@/components/sabcrm/20ui';

const TIME_RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
] as const;

type TimeRange = (typeof TIME_RANGES)[number]['value'];

const KPIS: Array<{
  label: string;
  value: string;
  icon: StatCardProps['icon'];
  delta: StatCardProps['delta'];
}> = [
  { label: 'Total Volume', value: '124,592', icon: Activity, delta: { value: '+14%', tone: 'up' } },
  { label: 'Active Users', value: '8,432', icon: Users, delta: { value: '+5%', tone: 'up' } },
  { label: 'System Health', value: '99.9%', icon: ShieldCheck, delta: { value: 'Stable', tone: 'neutral' } },
  { label: 'Avg Resolution', value: '1.2 hrs', icon: Clock, delta: { value: '-12%', tone: 'down' } },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
  id: `ANA-${1000 + i}`,
  name: `Analytics Resolution Times Item ${i + 1}`,
}));

const INSIGHTS = [1, 2, 3, 4, 5];

export default function AnalyticsResolutionTimesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState<TimeRange>('7d');

  return (
    <div className="20ui dark flex min-h-screen w-full flex-col bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Header */}
      <PageHeader className="px-8">
        <PageHeaderHeading>
          <PageTitle>Resolution Times</PageTitle>
          <PageDescription>
            Track and optimize how quickly tickets reach resolution across your support workflows.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton label="Search" icon={Search} variant="secondary" />
          <IconButton label="Notifications" icon={Bell} variant="secondary" />
          <Button variant="primary" iconLeft={Plus}>
            Create New
          </Button>
        </PageActions>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-8 py-4">
        <SegmentedControl
          aria-label="Time range"
          items={TIME_RANGES}
          value={range}
          onChange={setRange}
          size="sm"
        />
        <div className="flex items-center gap-3">
          <div className="w-56">
            <Field label="Search records">
              <Input
                inputSize="sm"
                iconLeft={Search}
                placeholder="Search resolution records"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Field>
          </div>
          <Button variant="secondary" size="sm" iconLeft={Filter}>
            Filter
          </Button>
          <Button variant="secondary" size="sm" iconLeft={Download}>
            Export
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <main className="grid flex-1 grid-cols-12 gap-6 overflow-y-auto p-8">
        {/* KPI Cards */}
        <div className="col-span-12 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {KPIS.map((kpi) => (
            <StatCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              delta={kpi.delta}
            />
          ))}
        </div>

        {/* Main Data View */}
        <Card variant="outlined" padding="none" className="col-span-12 flex h-[600px] flex-col xl:col-span-8">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Live Data Feed</CardTitle>
            <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" size="sm" />
          </CardHeader>
          <div className="flex-1 overflow-y-auto">
            <Table density="compact" hover stickyHeader>
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
                {FEED_ROWS.map((row) => (
                  <Tr key={row.id}>
                    <Td className="font-mono text-[var(--st-text-secondary)]">#{row.id}</Td>
                    <Td className="font-medium">{row.name}</Td>
                    <Td>
                      <Badge tone="success">Active</Badge>
                    </Td>
                    <Td>
                      <Badge tone="danger">High</Badge>
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
          </div>
        </Card>

        {/* Side Panel */}
        <Card variant="outlined" className="col-span-12 flex h-[600px] flex-col xl:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardBody className="flex-1 space-y-4 overflow-y-auto">
            {INSIGHTS.map((i) => (
              <div
                key={i}
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                  <Badge tone="warning">Action</Badge>
                </div>
                <p className="text-sm text-[var(--st-text-secondary)]">
                  The system detected an anomaly in the standard workflow pattern for analytics resolution times.
                </p>
              </div>
            ))}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
