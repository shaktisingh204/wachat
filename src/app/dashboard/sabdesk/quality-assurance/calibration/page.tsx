'use client';

import React, { useState } from 'react';
import {
  Activity,
  Users,
  Search,
  Download,
  Plus,
  RefreshCw,
  Bell,
  Zap,
  ShieldCheck,
  Clock,
  Filter,
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

type DeltaTone = 'up' | 'down' | 'neutral';

const KPIS: ReadonlyArray<{
  label: string;
  value: string;
  delta: { value: string; tone: DeltaTone };
  icon: typeof Activity;
  accent: string;
}> = [
  { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' }, icon: Activity, accent: 'var(--st-accent)' },
  { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' }, icon: Users, accent: 'var(--st-status-ok)' },
  { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' }, icon: ShieldCheck, accent: 'var(--st-accent)' },
  { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' }, icon: Clock, accent: 'var(--st-danger)' },
];

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
] as const;

type DateRange = (typeof DATE_RANGES)[number]['value'];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
  id: `QUA-${1000 + i}`,
  name: `Quality Assurance Calibration Item ${i + 1}`,
}));

export default function QualityAssuranceCalibrationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState<DateRange>('7d');

  const filteredRows = FEED_ROWS.filter((row) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return row.name.toLowerCase().includes(q) || row.id.toLowerCase().includes(q);
  });

  return (
    <div className="ui20 flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Quality Assurance Calibration Dashboard</PageTitle>
          <PageDescription>
            Manage and optimize your quality assurance calibration workflows and metrics.
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)]">
        <SegmentedControl
          aria-label="Date range"
          items={DATE_RANGES.map((r) => ({ value: r.value, label: r.label }))}
          value={range}
          onChange={(v) => setRange(v as DateRange)}
        />
        <div className="flex items-center gap-3">
          <Field className="w-64">
            <Input
              inputSize="sm"
              iconLeft={Search}
              type="search"
              placeholder="Search calibration items"
              aria-label="Search calibration items"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Field>
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
        <Card variant="outlined" padding="none" className="col-span-12 xl:col-span-8 flex flex-col h-[600px]">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Live Data Feed</CardTitle>
            <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" size="sm" />
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto p-0">
            <Table density="compact" hover stickyHeader>
              <THead>
                <Tr>
                  <Th width={120}>ID</Th>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Priority</Th>
                  <Th align="right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {filteredRows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <span className="font-mono text-[var(--st-text-secondary)]">#{row.id}</span>
                    </Td>
                    <Td>{row.name}</Td>
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
          </CardBody>
        </Card>

        {/* Side Panel */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-6 h-[600px]">
          <Card variant="outlined" className="flex-1 overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" /> AI Insights
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="p-4 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)]"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                    <Badge tone="warning">Action</Badge>
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    The system has detected an anomaly in the standard workflow pattern for quality
                    assurance calibration.
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
