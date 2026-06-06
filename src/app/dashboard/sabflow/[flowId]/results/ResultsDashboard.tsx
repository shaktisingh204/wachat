'use client';

import * as React from 'react';
import {
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Recharts,
  DataTable,
  Badge,
  type ChartConfig,
  type DataTableColumn,
} from '@/components/sabcrm/20ui';
import { Users, CheckCircle, Activity, MessageSquare, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { DailyCount, FlowResultsStats, FlowSession } from '@/app/actions/sabflow-results.types';

type Props = {
  stats: FlowResultsStats;
  dailyCounts: DailyCount[];
  sessions: FlowSession[];
};

const CHART_CONFIG: ChartConfig = {
  success: { label: 'Completed', color: 'var(--st-status-ok)' },
  failure: { label: 'Failed/Abandoned', color: 'var(--st-danger)' },
};

export function ResultsDashboard({ stats, dailyCounts, sessions }: Props) {
  // Stats: StatCard takes a LucideIcon component reference, not a rendered element.
  const statCards = [
    {
      label: 'Total Sessions',
      value: stats.totalSessions,
      icon: Users,
    },
    {
      label: 'Completed',
      value: stats.completedSessions,
      icon: CheckCircle,
    },
    {
      label: 'Completion Rate',
      value: `${stats.completionRate}%`,
      icon: Activity,
    },
    {
      label: 'Avg Messages',
      value: stats.avgMessageCount,
      icon: MessageSquare,
    },
  ];

  // Prepare chart data (success vs failure)
  const chartData = dailyCounts.map((d) => ({
    date: format(new Date(d.date), 'MMM dd'),
    success: d.completed,
    failure: d.total - d.completed,
  }));

  // Prepare data for recent errors (failed / abandoned sessions)
  const recentErrors = React.useMemo(() => {
    return sessions.filter((s) => !s.isCompleted);
  }, [sessions]);

  const columns = React.useMemo<DataTableColumn<FlowSession>[]>(
    () => [
      {
        key: 'sessionId',
        header: 'Session ID',
        render: (row) => (
          <span className="font-mono text-xs">{row.sessionId.slice(0, 12)}...</span>
        ),
      },
      {
        key: 'createdAt',
        header: 'Started At',
        sortable: true,
        render: (row) => (
          <span className="whitespace-nowrap text-[var(--st-text)]">
            {format(new Date(row.createdAt), 'MMM dd, HH:mm')}
          </span>
        ),
      },
      {
        key: 'messageCount',
        header: 'Messages',
        sortable: true,
        align: 'right',
      },
      {
        key: 'lastMessage',
        header: 'Last Message',
        render: (row) => (
          <span
            className="block max-w-[200px] truncate text-xs"
            title={row.lastMessage}
          >
            {row.lastMessage || '-'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: () => (
          <Badge tone="danger" kind="soft">
            <XCircle className="mr-1 h-3 w-3" aria-hidden="true" />
            Failed/Abandoned
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Success vs Failure chart */}
      <Card variant="outlined" padding="lg">
        <CardHeader>
          <CardTitle>Success vs Failure Rate</CardTitle>
          <CardDescription>
            Aggregate statistics per flow over the last 30 days.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ChartContainer config={CHART_CONFIG} className="h-[300px]">
            <Recharts.BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
              <Recharts.XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'var(--st-text-secondary)' }}
                dy={10}
              />
              <Recharts.YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'var(--st-text-secondary)' }}
              />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--st-bg-muted)' }} />
              <Recharts.Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
              <Recharts.Bar dataKey="success" name="Completed" stackId="a" fill="var(--color-success)" radius={[0, 0, 4, 4]} />
              <Recharts.Bar dataKey="failure" name="Failed/Abandoned" stackId="a" fill="var(--color-failure)" radius={[4, 4, 0, 0]} />
            </Recharts.BarChart>
          </ChartContainer>
        </CardBody>
      </Card>

      {/* Recent errors table */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--st-text)]">Recent Errors</h3>
          <p className="text-sm text-[var(--st-text-secondary)]">
            List of recent failed or abandoned sessions.
          </p>
        </div>
        <DataTable
          columns={columns}
          rows={recentErrors}
          getRowId={(row) => row.sessionId}
          empty="No recent errors found."
        />
      </div>
    </div>
  );
}
