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
  Inbox,
} from 'lucide-react';
import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  SegmentedControl,
  type SegmentedItem,
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
  EmptyState,
} from '@/components/sabcrm/20ui';

type TimeframeValue = 'today' | '7d' | '30d' | 'quarter' | 'custom';

const TIMEFRAMES: ReadonlyArray<SegmentedItem<TimeframeValue>> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
];

const KPIS = [
  { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' as const }, icon: Activity, accent: '#2b6ef2' },
  { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' as const }, icon: Users, accent: '#2e7d32' },
  { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' as const }, icon: ShieldCheck, accent: '#7c5cff' },
  { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' as const }, icon: Clock, accent: '#c13c2c' },
];

interface FeedRow {
  id: string;
  name: string;
  status: 'Active' | 'Paused';
  priority: 'High' | 'Medium' | 'Low';
}

const FEED_ROWS: FeedRow[] = Array.from({ length: 15 }).map((_, i) => ({
  id: `AI-${1000 + i}`,
  name: `Ai Copilot Ai Settings Item ${i + 1}`,
  status: i % 4 === 0 ? 'Paused' : 'Active',
  priority: i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low',
}));

const INSIGHTS = [
  { title: 'Optimization Required', detail: 'The system has detected an anomaly in the standard workflow pattern for ai copilot ai settings.' },
  { title: 'Model Drift Detected', detail: 'Response confidence has dropped 4 points over the last 7 days. Review the active prompt template.' },
  { title: 'Token Budget Nearing Cap', detail: 'This workspace has consumed 82 percent of its monthly copilot token allowance.' },
  { title: 'New Routing Suggestion', detail: 'High-priority threads can be auto-escalated to a faster model to cut average resolution time.' },
  { title: 'Knowledge Base Stale', detail: '3 source documents referenced by the copilot have not been re-indexed in 30 days.' },
];

const PRIORITY_TONE = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
} as const;

export default function AiCopilotAiSettingsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeframe, setTimeframe] = useState<TimeframeValue>('7d');

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return FEED_ROWS;
    return FEED_ROWS.filter(
      (row) => row.name.toLowerCase().includes(q) || row.id.toLowerCase().includes(q),
    );
  }, [searchTerm]);

  return (
    <div className="20ui dark flex flex-col w-full h-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>AI Copilot</PageEyebrow>
          <PageTitle>AI Settings Dashboard</PageTitle>
          <PageDescription>
            Manage and optimize your AI copilot settings, workflows, and metrics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton label="Search" icon={Search} variant="ghost" />
          <IconButton label="Notifications" icon={Bell} variant="ghost" />
          <Button variant="primary" iconLeft={Plus}>
            Create New
          </Button>
        </PageActions>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <SegmentedControl
          items={TIMEFRAMES}
          value={timeframe}
          onChange={setTimeframe}
          aria-label="Date range"
        />
        <div className="flex items-center gap-3">
          <Input
            type="search"
            iconLeft={Search}
            inputSize="sm"
            className="w-56"
            placeholder="Search records"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search records"
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
          <CardBody className="flex-1 overflow-y-auto p-2">
            {filteredRows.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No records match your search"
                description="Try a different name or ID, or clear the search to see every record."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setSearchTerm('')}>
                    Clear search
                  </Button>
                }
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
                      <Td className="font-medium text-[var(--st-text)]">{row.name}</Td>
                      <Td>
                        <Badge tone={row.status === 'Active' ? 'success' : 'neutral'} dot>
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
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-6 h-[600px]">
          <Card variant="outlined" padding="md" className="flex-1 overflow-y-auto">
            <CardHeader className="flex items-center gap-2">
              <Zap className="text-[var(--st-warn)]" size={18} aria-hidden="true" />
              <CardTitle>AI Insights</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {INSIGHTS.map((insight) => (
                <div
                  key={insight.title}
                  className="p-4 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)]"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                    <Badge tone="warning">Action</Badge>
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)]">{insight.detail}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}
