'use client';

import * as React from 'react';
import { StatCard, ChartContainer, ChartTooltip, ZoruChart, DataTable, Badge } from '@/components/sabcrm/20ui/compat';
import { Users, CheckCircle, Activity, MessageSquare, XCircle } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import type { DailyCount, FlowResultsStats, FlowSession } from '@/app/actions/sabflow-results.types';

type Props = {
  stats: FlowResultsStats;
  dailyCounts: DailyCount[];
  sessions: FlowSession[];
};

export function ResultsDashboard({ stats, dailyCounts, sessions }: Props) {
  // Stats
  const statCards = [
    {
      label: 'Total Sessions',
      value: stats.totalSessions,
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: 'Completed',
      value: stats.completedSessions,
      icon: <CheckCircle className="w-4 h-4 text-[var(--st-status-ok)]" />,
    },
    {
      label: 'Completion Rate',
      value: `${stats.completionRate}%`,
      icon: <Activity className="w-4 h-4" />,
    },
    {
      label: 'Avg Messages',
      value: stats.avgMessageCount,
      icon: <MessageSquare className="w-4 h-4" />,
    },
  ];

  // Prepare chart data (success vs failure)
  const chartData = dailyCounts.map((d) => ({
    date: format(new Date(d.date), 'MMM dd'),
    success: d.completed,
    failure: d.total - d.completed,
  }));

  // Prepare data table for recent errors
  const recentErrors = React.useMemo(() => {
    return sessions.filter((s) => !s.isCompleted);
  }, [sessions]);

  const columns = React.useMemo<ColumnDef<FlowSession, any>[]>(() => [
    {
      accessorKey: 'sessionId',
      header: 'Session ID',
      cell: (info) => (
        <span className="font-mono text-xs">{info.getValue<string>().slice(0, 12)}…</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Started At',
      cell: (info) => (
        <span className="text-[var(--st-text)] whitespace-nowrap">
          {format(new Date(info.getValue<string>()), 'MMM dd, HH:mm')}
        </span>
      ),
    },
    {
      accessorKey: 'messageCount',
      header: 'Messages',
    },
    {
      accessorKey: 'lastMessage',
      header: 'Last Message',
      cell: (info) => (
        <span className="block max-w-[200px] truncate text-xs" title={info.getValue<string>()}>
          {info.getValue<string>() || '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: () => (
        <Badge variant="destructive" className="bg-[var(--st-text)]/10 text-[var(--st-text)] hover:bg-[var(--st-text)]/20 border-0">
          <XCircle className="mr-1 h-3 w-3" />
          Failed/Abandoned
        </Badge>
      ),
    },
  ], []);

  return (
    <div className="flex flex-col gap-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <StatCard
            key={i}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)] p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-[var(--st-text)]">Success vs Failure Rate</h3>
            <p className="text-sm text-[var(--st-text-secondary)]">Aggregate statistics per flow over the last 30 days.</p>
          </div>
          <ChartContainer height={300}>
            <ZoruChart.BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
              <ZoruChart.XAxis 
                dataKey="date" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 12, fill: 'var(--st-text-secondary)' }} 
                dy={10}
              />
              <ZoruChart.YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 12, fill: 'var(--st-text-secondary)' }} 
              />
              <ZoruChart.Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--st-bg-muted)' }} />
              <ZoruChart.Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
              <ZoruChart.Bar dataKey="success" name="Completed" stackId="a" fill="hsl(var(--zoru-success, 142.1 70.6% 45.3%))" radius={[0, 0, 4, 4]} />
              <ZoruChart.Bar dataKey="failure" name="Failed/Abandoned" stackId="a" fill="hsl(var(--zoru-danger, 0 84.2% 60.2%))" radius={[4, 4, 0, 0]} />
            </ZoruChart.BarChart>
          </ChartContainer>
        </div>

      {/* Data Table */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--st-text)]">Recent Errors</h3>
          <p className="text-sm text-[var(--st-text-secondary)]">List of recent failed or abandoned sessions.</p>
        </div>
        <DataTable
          columns={columns}
          data={recentErrors}
          pageSize={10}
          filterColumn="sessionId"
          filterPlaceholder="Filter by Session ID..."
          empty="No recent errors found."
        />
      </div>
    </div>
  );
}
