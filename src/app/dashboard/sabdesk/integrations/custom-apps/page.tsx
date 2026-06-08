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
  Badge,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  SegmentedControl,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';

const TIME_RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
] as const;

type TimeRange = (typeof TIME_RANGES)[number]['value'];

const KPIS = [
  { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#3b82f6' },
  { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#10b981' },
  { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#a855f7' },
  { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#f43f5e' },
];

const INSIGHTS = [
  { title: 'Optimization Required', body: 'The system has detected an anomaly in the standard workflow pattern for integrations custom apps.' },
  { title: 'Throughput Spike', body: 'Inbound request volume rose 22 percent over the last hour. Consider scaling the sync worker pool.' },
  { title: 'Token Refresh Due', body: 'Three connected apps have credentials expiring within 48 hours. Renew them to avoid downtime.' },
  { title: 'Mapping Conflict', body: 'A field mapping in the Billing connector overlaps with a custom rule. Review before the next run.' },
  { title: 'Idle Connection', body: 'The Analytics integration has had no events in 7 days. Confirm it is still in active use.' },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
  id: `INT-${1000 + i}`,
  name: `Integrations Custom Apps Item ${i + 1}`,
}));

export default function IntegrationsCustomAppsPage() {
  const [range, setRange] = useState<TimeRange>('7d');

  return (
    <div className="20ui dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Header */}
      <PageHeader className="px-8 py-6">
        <PageHeaderHeading>
          <PageTitle>Integrations Custom Apps Dashboard</PageTitle>
          <PageDescription>
            Manage and optimize your integrations custom apps workflows and metrics.
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <SegmentedControl
          aria-label="Time range"
          items={TIME_RANGES.map((t) => ({ value: t.value, label: t.label }))}
          value={range}
          onChange={(v) => setRange(v as TimeRange)}
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
            <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto p-2">
            <Table stickyHeader>
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
                    <Td>
                      <span className="font-mono text-[var(--st-text-secondary)]">#{row.id}</span>
                    </Td>
                    <Td>
                      <span className="font-medium text-[var(--st-text)]">{row.name}</span>
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
          </CardBody>
        </Card>

        {/* Side Panel */}
        <Card className="col-span-12 xl:col-span-4 flex flex-col h-[600px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto space-y-4">
            {INSIGHTS.map((insight, i) => (
              <Card key={i} variant="ghost" padding="md" className="bg-[var(--st-bg-secondary)]">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                  <Badge tone="warning" kind="soft">Action</Badge>
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
