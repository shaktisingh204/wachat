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
  SegmentedControl,
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
  useToast,
} from '@/components/sabcrm/20ui';

type RangeValue = 'today' | '7d' | '30d' | 'quarter' | 'custom';

const RANGE_ITEMS: ReadonlyArray<{ value: RangeValue; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'custom', label: 'Custom' },
];

const KPIS: ReadonlyArray<{
  label: string;
  value: string;
  delta: { value: string; tone: 'up' | 'down' | 'neutral' };
  icon: typeof Activity;
  accent: string;
}> = [
  { label: 'Total volume', value: '124,592', delta: { value: '+14%', tone: 'up' }, icon: Activity, accent: '#3b82f6' },
  { label: 'Active users', value: '8,432', delta: { value: '+5%', tone: 'up' }, icon: Users, accent: '#10b981' },
  { label: 'System health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' }, icon: ShieldCheck, accent: '#8b5cf6' },
  { label: 'Avg resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' }, icon: Clock, accent: '#f43f5e' },
];

interface FeedRow {
  id: string;
  name: string;
  status: 'Active' | 'Paused';
  priority: 'High' | 'Medium' | 'Low';
}

const FEED_ROWS: FeedRow[] = Array.from({ length: 15 }).map((_, i) => ({
  id: `INT-${1000 + i}`,
  name: `Webhook endpoint ${i + 1}`,
  status: i % 5 === 0 ? 'Paused' : 'Active',
  priority: i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low',
}));

const PRIORITY_TONE: Record<FeedRow['priority'], 'danger' | 'warning' | 'neutral'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
};

const INSIGHTS: ReadonlyArray<{ title: string; body: string }> = [
  { title: 'Optimization required', body: 'Delivery latency on the orders endpoint rose above the 2s target over the last hour.' },
  { title: 'Retry spike detected', body: 'The billing webhook retried 24 events in 10 minutes. Check the receiver health.' },
  { title: 'Signature drift', body: 'Two inbound calls failed signature verification. Rotate the shared secret.' },
  { title: 'Throughput steady', body: 'The notifications endpoint held a stable 320 events per minute with no errors.' },
  { title: 'New consumer added', body: 'A subscriber was registered for the shipment.updated event this morning.' },
];

export default function IntegrationsWebhooksPage() {
  const { toast } = useToast();
  const [range, setRange] = useState<RangeValue>('7d');

  const rangeLabel = useMemo(
    () => RANGE_ITEMS.find((r) => r.value === range)?.label ?? '7 days',
    [range],
  );

  return (
    <div className="20ui flex flex-col w-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Integrations webhooks dashboard</PageTitle>
          <PageDescription>Manage and optimize your webhook workflows and delivery metrics.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton label="Search" icon={Search} variant="secondary" onClick={() => toast.info('Search coming soon')} />
          <IconButton label="Notifications" icon={Bell} variant="secondary" onClick={() => toast.info('No new notifications')} />
          <Button variant="primary" iconLeft={Plus} onClick={() => toast.success('New webhook draft created')}>
            Create new
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
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" iconLeft={Filter} onClick={() => toast.info('Filters panel coming soon')}>
            Filter
          </Button>
          <Button variant="secondary" size="sm" iconLeft={Download} onClick={() => toast.success(`Exporting ${rangeLabel} report`)}>
            Export
          </Button>
        </div>
      </div>

      {/* Main content grid */}
      <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
        {/* KPI cards */}
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

        {/* Live data feed */}
        <Card className="col-span-12 lg:col-span-8 flex flex-col" padding="none">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Live data feed</CardTitle>
            <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" onClick={() => toast.success('Feed refreshed')} />
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto max-h-[520px] p-0">
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
                    <Td className="text-[var(--st-text)] font-medium">{row.name}</Td>
                    <Td>
                      <Badge tone={row.status === 'Active' ? 'success' : 'neutral'} dot>
                        {row.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={PRIORITY_TONE[row.priority]}>{row.priority}</Badge>
                    </Td>
                    <Td align="right">
                      <Button variant="ghost" size="sm" onClick={() => toast.info(`Opening ${row.id}`)}>
                        View details
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>

        {/* Side panel */}
        <Card className="col-span-12 lg:col-span-4 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-[var(--st-accent)]" aria-hidden="true" />
              AI insights
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {INSIGHTS.map((insight) => (
              <div
                key={insight.title}
                className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                  <Badge tone="accent">Action</Badge>
                </div>
                <p className="text-sm text-[var(--st-text-secondary)]">{insight.body}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
