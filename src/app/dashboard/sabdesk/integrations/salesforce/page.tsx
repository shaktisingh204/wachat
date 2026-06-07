'use client';
import React, { useState } from 'react';
import {
  Activity, Users, Search, Download, Plus, RefreshCw, Bell,
  Zap, ShieldCheck, Clock, Filter, type LucideIcon,
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
  SegmentedControl,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';

type RangeValue = 'today' | '7d' | '30d' | 'quarter' | 'custom';

const RANGE_ITEMS: ReadonlyArray<{ value: RangeValue; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
];

interface Kpi {
  label: string;
  value: string;
  delta: { value: string; tone: 'up' | 'down' | 'neutral' };
  icon: LucideIcon;
  accent: string;
}

const KPIS: ReadonlyArray<Kpi> = [
  { label: 'Total Volume', value: '124,592', delta: { value: '+14%', tone: 'up' }, icon: Activity, accent: 'var(--st-accent)' },
  { label: 'Active Users', value: '8,432', delta: { value: '+5%', tone: 'up' }, icon: Users, accent: 'var(--st-status-ok)' },
  { label: 'System Health', value: '99.9%', delta: { value: 'Stable', tone: 'neutral' }, icon: ShieldCheck, accent: 'var(--st-accent)' },
  { label: 'Avg Resolution', value: '1.2 hrs', delta: { value: '-12%', tone: 'down' }, icon: Clock, accent: 'var(--st-danger)' },
];

const FEED_ROWS = Array.from({ length: 15 }).map((_, i) => ({
  id: `INT-${1000 + i}`,
  name: `Salesforce Sync ${i + 1}`,
}));

const INSIGHTS = [
  { title: 'Optimization Required', body: 'The system has detected an anomaly in the standard workflow pattern for the Salesforce integration.' },
  { title: 'Sync Lag Detected', body: 'Lead records from the EMEA region took longer than usual to reconcile on the last run.' },
  { title: 'Duplicate Contacts', body: '42 contacts appear in both the source CRM and Salesforce. Review the merge queue.' },
  { title: 'Field Mapping Gap', body: 'Two custom fields on the Opportunity object have no destination mapping configured.' },
  { title: 'Quota Healthy', body: 'API usage is at 38 percent of the daily Salesforce limit. No action needed.' },
];

export default function IntegrationsSalesforcePage() {
  const [range, setRange] = useState<RangeValue>('7d');
  const { toast } = useToast();

  return (
    <div className="ui20 dark flex flex-col w-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Header */}
      <PageHeader className="px-8">
        <PageHeaderHeading>
          <PageTitle>Salesforce Integration</PageTitle>
          <PageDescription>Manage and optimize your Salesforce sync workflows and metrics.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton label="Search" icon={Search} variant="secondary" />
          <IconButton label="Notifications" icon={Bell} variant="secondary" />
          <Button variant="primary" iconLeft={Plus} onClick={() => toast.success('New integration draft created')}>
            Create New
          </Button>
        </PageActions>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <SegmentedControl
          items={RANGE_ITEMS}
          value={range}
          onChange={setRange}
          size="sm"
          aria-label="Date range"
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" iconLeft={Filter}>
            Filter
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={Download}
            onClick={() => toast.success('Export started')}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
        {/* KPI Cards */}
        <div className="col-span-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
        <Card padding="none" className="col-span-12 flex flex-col h-[600px] lg:col-span-8">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Live Data Feed</CardTitle>
            <IconButton
              label="Refresh feed"
              icon={RefreshCw}
              onClick={() => toast.success('Feed refreshed')}
            />
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast({ title: `Opening ${row.id}`, tone: 'info' })}
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
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap size={18} className="text-[var(--st-accent)]" aria-hidden="true" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {INSIGHTS.map((insight) => (
                <Card key={insight.title} variant="outlined" padding="sm">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                    <Badge tone="warning">Action</Badge>
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)]">{insight.body}</p>
                </Card>
              ))}
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}
