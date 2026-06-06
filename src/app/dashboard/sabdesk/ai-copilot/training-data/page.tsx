'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Users,
  ShieldCheck,
  Clock,
  Search,
  Bell,
  Plus,
  Filter,
  Download,
  RefreshCw,
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
  SegmentedControl,
  useToast,
} from '@/components/sabcrm/20ui';

const RANGES = ['Today', '7 Days', '30 Days', 'This Quarter', 'Custom'];

const KPIS = [
  { label: 'Total Volume', value: '124,592', delta: '+14%', tone: 'up' as const, icon: Activity, accent: 'var(--st-accent)' },
  { label: 'Active Users', value: '8,432', delta: '+5%', tone: 'up' as const, icon: Users, accent: 'var(--st-status-ok)' },
  { label: 'System Health', value: '99.9%', delta: 'Stable', tone: 'neutral' as const, icon: ShieldCheck, accent: 'var(--st-accent)' },
  { label: 'Avg Resolution', value: '1.2 hrs', delta: '-12%', tone: 'down' as const, icon: Clock, accent: 'var(--st-danger)' },
];

const INSIGHTS = [
  'The system has detected an anomaly in the standard workflow pattern for AI copilot training data.',
  'Recent samples show drift in intent classification. Re-label the flagged batch to recover accuracy.',
  'Duplicate utterances were found across three datasets. Merge them to reduce training noise.',
  'A high-volume topic lacks negative examples. Add counter-cases to sharpen the model boundary.',
  'Response latency rose on the long-form set. Trim oversized context windows before the next run.',
];

interface FeedRow {
  id: string;
  name: string;
  status: 'Active' | 'Queued' | 'Review';
  priority: 'High' | 'Medium' | 'Low';
}

function buildRows(): FeedRow[] {
  const statuses: FeedRow['status'][] = ['Active', 'Queued', 'Review'];
  const priorities: FeedRow['priority'][] = ['High', 'Medium', 'Low'];
  return Array.from({ length: 15 }).map((_, i) => ({
    id: `AI-${1000 + i}`,
    name: `Training Data Item ${i + 1}`,
    status: statuses[i % statuses.length],
    priority: priorities[i % priorities.length],
  }));
}

const STATUS_TONE = { Active: 'success', Queued: 'info', Review: 'warning' } as const;
const PRIORITY_TONE = { High: 'danger', Medium: 'warning', Low: 'neutral' } as const;

export default function AiCopilotTrainingDataPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState(RANGES[1]);

  const allRows = useMemo(() => buildRows(), []);
  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
    );
  }, [allRows, searchTerm]);

  return (
    <div className="ui20 flex h-full min-h-screen w-full flex-col bg-[var(--st-bg)] text-[var(--st-text)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>AI Copilot Training Data</PageTitle>
          <PageDescription>
            Manage and optimize your AI copilot training data workflows and metrics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton
            label="Search training data"
            icon={Search}
            variant="ghost"
            onClick={() => toast.success('Search ready')}
          />
          <IconButton
            label="View notifications"
            icon={Bell}
            variant="ghost"
            onClick={() => toast.success('You are all caught up')}
          />
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => toast.success('New training dataset created')}
          >
            Create New
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] px-8 py-4">
        <SegmentedControl
          items={RANGES.map((r) => ({ value: r, label: r }))}
          value={range}
          onChange={setRange}
          aria-label="Time range"
        />
        <div className="flex items-center gap-3">
          <div className="w-56">
            <Field>
              <Input
                inputSize="sm"
                iconLeft={Search}
                placeholder="Search items"
                aria-label="Filter training data items"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Field>
          </div>
          <Button variant="secondary" size="sm" iconLeft={Filter} onClick={() => toast.success('Filters applied')}>
            Filter
          </Button>
          <Button variant="secondary" size="sm" iconLeft={Download} onClick={() => toast.success('Export started')}>
            Export
          </Button>
        </div>
      </div>

      <main className="grid flex-1 grid-cols-12 gap-6 overflow-y-auto p-8">
        <div className="col-span-12 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {KPIS.map((kpi) => (
            <StatCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              accent={kpi.accent}
              delta={{ value: kpi.delta, tone: kpi.tone }}
            />
          ))}
        </div>

        <Card variant="outlined" padding="none" className="col-span-12 flex h-[600px] flex-col xl:col-span-8">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Live Data Feed</CardTitle>
            <IconButton
              label="Refresh data feed"
              icon={RefreshCw}
              variant="ghost"
              onClick={() => toast.success('Data feed refreshed')}
            />
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto p-0">
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
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td className="font-mono text-[var(--st-text-secondary)]">#{row.id}</Td>
                    <Td className="font-medium text-[var(--st-text)]">{row.name}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[row.status]} dot>
                        {row.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={PRIORITY_TONE[row.priority]}>{row.priority}</Badge>
                    </Td>
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.success(`Opening ${row.id}`)}
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

        <Card variant="outlined" className="col-span-12 flex h-[600px] flex-col xl:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardBody className="flex-1 space-y-4 overflow-y-auto">
            {INSIGHTS.map((text, i) => (
              <div
                key={i}
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="font-medium text-[var(--st-text)]">Optimization Required</h4>
                  <Badge tone="warning" kind="soft">
                    Action
                  </Badge>
                </div>
                <p className="text-sm text-[var(--st-text-secondary)]">{text}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
