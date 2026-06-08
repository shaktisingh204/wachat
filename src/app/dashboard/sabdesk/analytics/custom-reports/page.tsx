'use client';
import React, { useMemo, useState } from 'react';
import {
  Activity, Users, Filter, Search, Download,
  Plus, RefreshCw, Bell, Zap, ShieldCheck, Clock,
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
  Input,
  SegmentedControl,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  EmptyState,
} from '@/components/sabcrm/20ui';

const RANGES = ['Today', '7 Days', '30 Days', 'This Quarter', 'Custom'];

const KPIS: Array<{
  label: string;
  value: string;
  delta: { value: string; tone: 'up' | 'down' | 'neutral' };
  icon: typeof Activity;
  accent: string;
}> = [
  { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' }, icon: Activity, accent: 'var(--st-accent)' },
  { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' }, icon: Users, accent: 'var(--st-status-ok)' },
  { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' }, icon: ShieldCheck, accent: 'var(--st-accent)' },
  { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' }, icon: Clock, accent: 'var(--st-warn)' },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
  id: `#ANA-${1000 + i}`,
  name: `Analytics Custom Reports Item ${i + 1}`,
}));

const INSIGHTS = [1, 2, 3, 4, 5];

export default function AnalyticsCustomReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState('7 Days');

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return FEED_ROWS;
    return FEED_ROWS.filter(
      (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
    );
  }, [searchTerm]);

  return (
    <div className="20ui dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Header */}
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Analytics Custom Reports Dashboard</PageTitle>
          <PageDescription>
            Manage and optimize your analytics custom reports workflows and metrics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton label="Search reports" icon={Search} variant="secondary" />
          <IconButton label="Notifications" icon={Bell} variant="secondary" />
          <Button variant="primary" iconLeft={Plus}>
            Create New
          </Button>
        </PageActions>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <SegmentedControl
          items={RANGES.map((r) => ({ label: r, value: r }))}
          value={range}
          onChange={setRange}
          aria-label="Date range"
        />
        <div className="flex items-center gap-3">
          <Input
            className="w-56"
            inputSize="sm"
            iconLeft={Search}
            placeholder="Search reports"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search reports"
          />
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
            <IconButton label="Refresh data feed" icon={RefreshCw} variant="ghost" />
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto p-0">
            {filteredRows.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching reports"
                description="Try a different search term to find a report in this feed."
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
                  {filteredRows.map((row) => (
                    <Tr key={row.id}>
                      <Td className="font-mono text-[var(--st-text-secondary)]">{row.id}</Td>
                      <Td className="font-medium text-[var(--st-text)]">{row.name}</Td>
                      <Td>
                        <Badge tone="success" dot>
                          Active
                        </Badge>
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
            )}
          </CardBody>
        </Card>

        {/* Side Panel */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
          <Card variant="outlined" padding="lg" className="flex-1 overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="text-[var(--st-warn)]" size={18} aria-hidden="true" /> AI Insights
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {INSIGHTS.map((i) => (
                <Card key={i} variant="ghost" padding="md" className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                    <Badge tone="warning">Action</Badge>
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    The system has detected an anomaly in the standard workflow pattern for analytics custom reports.
                  </p>
                </Card>
              ))}
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}
