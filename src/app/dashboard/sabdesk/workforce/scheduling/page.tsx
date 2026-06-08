'use client';

import React from 'react';
import {
  Activity, Users, Search, Download, Plus, RefreshCw, Bell,
  Zap, ShieldCheck, Clock, Filter,
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
  SegmentedControl,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
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
  { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#2563eb' },
  { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#10b981' },
  { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#a855f7' },
  { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#f43f5e' },
];

type FeedRow = {
  id: string;
  name: string;
  status: { label: string; tone: 'success' | 'warning' | 'neutral' };
  priority: { label: string; tone: 'danger' | 'warning' | 'info' };
};

const STATUS_CYCLE: FeedRow['status'][] = [
  { label: 'Active', tone: 'success' },
  { label: 'Pending', tone: 'warning' },
  { label: 'Idle', tone: 'neutral' },
];
const PRIORITY_CYCLE: FeedRow['priority'][] = [
  { label: 'High', tone: 'danger' },
  { label: 'Medium', tone: 'warning' },
  { label: 'Low', tone: 'info' },
];
const SHIFT_NAMES = [
  'Morning shift coverage', 'Late-night dispatch desk', 'Weekend on-call rotation',
  'Holiday surge staffing', 'Cross-team handoff window', 'Overtime approval queue',
  'Regional escalation pool', 'New-hire onboarding block', 'Floating relief roster',
  'Quarterly capacity review', 'Break-schedule rebalancing', 'Inbound queue triage',
  'Field-team route planning', 'Compliance audit window', 'Peak-hour staffing model',
];

const FEED_ROWS: FeedRow[] = SHIFT_NAMES.map((name, i) => ({
  id: `WOR-${1000 + i}`,
  name,
  status: STATUS_CYCLE[i % STATUS_CYCLE.length],
  priority: PRIORITY_CYCLE[i % PRIORITY_CYCLE.length],
}));

const INSIGHTS = [
  { title: 'Optimization required', tag: 'Action', body: 'Tuesday afternoons are over-staffed by three agents while inbound volume drops 22 percent.' },
  { title: 'Coverage gap', tag: 'Risk', body: 'The 02:00 to 04:00 window has no senior responder assigned for the next two nights.' },
  { title: 'Overtime trend', tag: 'Watch', body: 'Overtime hours rose 9 percent week over week, concentrated in the dispatch team.' },
  { title: 'Forecast ready', tag: 'Info', body: 'Next week demand is projected 6 percent higher. Suggested roster is ready to review.' },
  { title: 'Approval pending', tag: 'Action', body: 'Four shift-swap requests are waiting on a manager decision before the weekend lock.' },
];

export default function WorkforceSchedulingPage() {
  const { toast } = useToast();
  const [range, setRange] = React.useState<RangeValue>('7d');

  return (
    <div className="20ui dark flex flex-col w-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Workforce Scheduling Dashboard</PageTitle>
          <PageDescription>
            Manage and optimize your workforce scheduling workflows and metrics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton label="Search" icon={Search} variant="secondary" />
          <IconButton label="Notifications" icon={Bell} variant="secondary" />
          <Button variant="primary" iconLeft={Plus}>Create New</Button>
        </PageActions>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap px-8 py-4 border-b border-[var(--st-border)]">
        <SegmentedControl
          aria-label="Date range"
          items={RANGE_ITEMS}
          value={range}
          onChange={setRange}
          size="sm"
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" iconLeft={Filter}>Filter</Button>
          <Button variant="secondary" size="sm" iconLeft={Download}>Export</Button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
        {/* KPI cards */}
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

        {/* Live data feed */}
        <Card padding="none" className="col-span-12 lg:col-span-8 flex flex-col h-[600px]">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Live Data Feed</CardTitle>
            <IconButton label="Refresh feed" icon={RefreshCw} variant="ghost" />
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto p-2">
            <Table density="compact" hover>
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
                    <Td className="font-medium text-[var(--st-text)]">{row.name}</Td>
                    <Td>
                      <Badge tone={row.status.tone} dot>{row.status.label}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={row.priority.tone}>{row.priority.label}</Badge>
                    </Td>
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toast.success(`Opening ${row.name} (#${row.id})`)
                        }
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

        {/* AI insights */}
        <Card className="col-span-12 lg:col-span-4 flex flex-col h-[600px]">
          <CardHeader className="flex items-center gap-2">
            <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
            <CardTitle>AI Insights</CardTitle>
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto flex flex-col gap-4">
            {INSIGHTS.map((insight) => (
              <div
                key={insight.title}
                className="p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                  <Badge tone="warning">{insight.tag}</Badge>
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
