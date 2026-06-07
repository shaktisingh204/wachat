'use client';

import React, { useMemo, useState } from 'react';
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
  Input,
  SegmentedControl,
  type SegmentedItem,
  useToast,
} from '@/components/sabcrm/20ui';

type RangeValue = 'today' | '7d' | '30d' | 'quarter' | 'custom';

const RANGE_ITEMS: ReadonlyArray<SegmentedItem<RangeValue>> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
];

const KPIS: ReadonlyArray<{
  label: string;
  value: string;
  icon: typeof Activity;
  accent: string;
  delta: { value: string; tone: 'up' | 'down' | 'neutral' };
}> = [
  {
    label: 'Total Volume',
    value: '124,592',
    icon: Activity,
    accent: 'var(--st-accent)',
    delta: { value: '+14%', tone: 'up' },
  },
  {
    label: 'Active Users',
    value: '8,432',
    icon: Users,
    accent: 'var(--st-status-ok)',
    delta: { value: '+5%', tone: 'up' },
  },
  {
    label: 'System Health',
    value: '99.9%',
    icon: ShieldCheck,
    accent: 'var(--st-accent)',
    delta: { value: 'Stable', tone: 'neutral' },
  },
  {
    label: 'Avg Resolution',
    value: '1.2 hrs',
    icon: Clock,
    accent: 'var(--st-warn)',
    delta: { value: '-12%', tone: 'down' },
  },
];

interface LogRow {
  id: string;
  name: string;
  status: 'Active';
  priority: 'High';
}

const INSIGHTS: ReadonlyArray<{ id: number; title: string; body: string }> = [
  {
    id: 1,
    title: 'Optimization Required',
    body: 'The system has detected an anomaly in the standard workflow pattern for integrations API logs.',
  },
  {
    id: 2,
    title: 'Latency Spike',
    body: 'Outbound webhook latency rose 22 percent in the last hour. Review the retry backoff settings.',
  },
  {
    id: 3,
    title: 'Quota Threshold',
    body: 'Daily API quota is at 78 percent. Consider raising the plan limit before peak traffic.',
  },
  {
    id: 4,
    title: 'Deprecated Endpoint',
    body: 'Three integrations still call the v1 logs endpoint. Migrate them to v2 before the cutover.',
  },
  {
    id: 5,
    title: 'Signature Mismatch',
    body: 'A handful of inbound events failed signature verification. Rotate the shared secret to resolve.',
  },
];

export default function IntegrationsApiLogsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState<RangeValue>('7d');

  const rows = useMemo<LogRow[]>(
    () =>
      Array.from({ length: 15 }).map((_, i) => ({
        id: `INT-${1000 + i}`,
        name: `Integrations API Logs Item ${i + 1}`,
        status: 'Active',
        priority: 'High',
      })),
    [],
  );

  const visibleRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
    );
  }, [rows, searchTerm]);

  return (
    <div className="ui20 flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Integrations API Logs Dashboard</PageTitle>
          <PageDescription>
            Manage and optimize your integrations API logs workflows and metrics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton
            label="Search logs"
            icon={Search}
            variant="secondary"
            onClick={() => toast.info({ title: 'Search', description: 'Use the live data filter below.' })}
          />
          <IconButton
            label="Notifications"
            icon={Bell}
            variant="secondary"
            onClick={() => toast.info('You are all caught up.')}
          />
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => toast.success('New integration draft created.')}
          >
            Create New
          </Button>
        </PageActions>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <SegmentedControl<RangeValue>
          aria-label="Time range"
          items={RANGE_ITEMS}
          value={range}
          onChange={setRange}
        />
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            iconLeft={Filter}
            onClick={() => toast.info({ title: 'Filters', description: 'Filter panel coming soon.' })}
          >
            Filter
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={Download}
            onClick={() => toast.success('Export queued. We will email the file shortly.')}
          >
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
              accent={kpi.accent}
              delta={kpi.delta}
            />
          ))}
        </div>

        {/* Main Data View */}
        <Card variant="outlined" padding="none" className="col-span-12 lg:col-span-8 flex flex-col h-[600px]">
          <CardHeader className="flex items-center justify-between gap-4">
            <CardTitle>Live Data Feed</CardTitle>
            <div className="flex items-center gap-3">
              <Input
                inputSize="sm"
                iconLeft={Search}
                placeholder="Search logs"
                aria-label="Search live data feed"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56"
              />
              <IconButton
                label="Refresh feed"
                icon={RefreshCw}
                variant="ghost"
                onClick={() => toast.success('Feed refreshed.')}
              />
            </div>
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
                {visibleRows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <span className="font-mono text-[var(--st-text-secondary)]">#{row.id}</span>
                    </Td>
                    <Td>
                      <span className="font-medium text-[var(--st-text)]">{row.name}</span>
                    </Td>
                    <Td>
                      <Badge tone="success" dot>
                        {row.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone="danger">{row.priority}</Badge>
                    </Td>
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info(`Opening ${row.id}`)}
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
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-[600px]">
          <Card variant="outlined" padding="lg" className="flex-1 overflow-y-auto">
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
              AI Insights
            </CardTitle>
            <div className="mt-6 space-y-4">
              {INSIGHTS.map((insight) => (
                <div
                  key={insight.id}
                  className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                    <Badge tone="warning">Action</Badge>
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)]">{insight.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
