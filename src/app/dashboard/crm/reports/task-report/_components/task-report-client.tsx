'use client';

/**
 * TaskReportClient — full client wrapper for the Task Report page.
 *
 * Responsibilities:
 *  - Filter bar (project, assignee, status, priority, date range) — URL-driven GET form
 *  - KPI cards: total, completed, in-progress, overdue, completion rate %
 *  - Line chart: tasks completed per week
 *  - Table: task rows with EntityRowLink, status/priority badges
 *  - Export CSV / XLSX
 */

import * as React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download, FileSpreadsheet } from 'lucide-react';

import {
  Button,
  Card,
  Badge,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatCard, fmtPct } from '../../_components/report-toolbar';
import { downloadCsv, downloadXlsx, dateStamp, type ExportRow } from '@/lib/crm-list-export';
import type { TaskReportDeepResult, TaskDetailRow } from '@/app/actions/worksuite/reports.actions';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'danger'> = {
  Completed: 'success',
  'In Progress': 'warning',
  'To-Do': 'secondary',
  Overdue: 'danger',
};

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'secondary'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'secondary',
};

interface Props {
  data: TaskReportDeepResult;
  filters: {
    status?: string;
    priority?: string;
    from?: string;
    to?: string;
  };
}

export function TaskReportClient({ data, filters }: Props) {
  const exportRows: ExportRow[] = data.rows.map((r: TaskDetailRow) => ({
    'Task': r.title,
    'Project': r.projectName,
    'Assignee': r.assignedTo,
    'Status': r.status,
    'Priority': r.priority,
    'Created': r.createdAt ? r.createdAt.slice(0, 10) : '—',
    'Due': r.dueDate ? r.dueDate.slice(0, 10) : '—',
    'Completed': r.completedAt ? r.completedAt.slice(0, 10) : '—',
  }));

  const exportHeaders = ['Task', 'Project', 'Assignee', 'Status', 'Priority', 'Created', 'Due', 'Completed'];

  const handleCsv = () => {
    downloadCsv(`task-report-${dateStamp()}.csv`, exportHeaders, exportRows);
  };

  const handleXlsx = () => {
    void downloadXlsx(`task-report-${dateStamp()}.xlsx`, exportHeaders, exportRows, 'Tasks');
  };

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <>
      {/* Filter bar */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card px-3 py-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</span>
          <select
            name="status"
            defaultValue={filters.status ?? ''}
            className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          >
            <option value="">All</option>
            <option value="To-Do">To-Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Priority</span>
          <select
            name="priority"
            defaultValue={filters.priority ?? ''}
            className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          >
            <option value="">All</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">From</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? ''}
            className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">To</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? ''}
            className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          />
        </label>
        <Button type="submit" size="sm">Apply</Button>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total tasks" value={String(data.kpis.total)} />
        <StatCard label="Completed" value={String(data.kpis.completed)} tone="green" />
        <StatCard label="In progress" value={String(data.kpis.inProgress)} tone="amber" />
        <StatCard label="Overdue" value={String(data.kpis.overdue)} tone="red" />
        <StatCard
          label="Completion rate"
          value={fmtPct(data.kpis.completionRatePct)}
          tone={data.kpis.completionRatePct >= 75 ? 'green' : data.kpis.completionRatePct >= 40 ? 'amber' : 'red'}
        />
      </div>

      {/* Chart */}
      <Card className="p-6">
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-foreground">Tasks completed per week</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Weekly completion trend across the selected range.</p>
        </div>
        {data.weeklyCompleted.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">No completed tasks in range.</div>
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.weeklyCompleted}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Tasks completed"
                  stroke="hsl(142 71% 45%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Export toolbar */}
      <div className="flex justify-end">
        <DropdownMenu>
          <ZoruDropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
          </ZoruDropdownMenuTrigger>
          <ZoruDropdownMenuContent align="end">
            <ZoruDropdownMenuItem onClick={handleCsv}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
            </ZoruDropdownMenuItem>
            <ZoruDropdownMenuItem onClick={handleXlsx}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> XLSX
            </ZoruDropdownMenuItem>
          </ZoruDropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Task</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Project</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Assignee</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Priority</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Created</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Due</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Completed</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {data.rows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-muted-foreground"
                  >
                    No tasks found for selected filters.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                data.rows.map((r: TaskDetailRow) => (
                  <ZoruTableRow key={r._id} className="border-border">
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/tasks/${r._id}`}
                        label={r.title}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-muted-foreground">{r.projectName}</ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">{r.assignedTo}</ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>
                        {r.status}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={PRIORITY_VARIANT[r.priority] ?? 'secondary'}>
                        {r.priority}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-muted-foreground">
                      {r.createdAt ? r.createdAt.slice(0, 10) : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-muted-foreground">
                      {r.dueDate ? r.dueDate.slice(0, 10) : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-muted-foreground">
                      {r.completedAt ? r.completedAt.slice(0, 10) : '—'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
