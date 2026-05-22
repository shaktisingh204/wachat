'use client';

/**
 * OverdueTasksClient — full client wrapper for the Overdue Tasks report.
 *
 * Responsibilities:
 *  - Filter bar (project, assignee, priority, days-overdue range) — URL-driven GET form
 *  - KPI cards
 *  - Bar chart: overdue count by assignee (top 10)
 *  - Table: task rows with EntityRowLink, priority badge, days-overdue column
 *  - Bulk reassign / bulk extend due date (placeholder UI — triggers alert)
 *  - Export CSV / XLSX
 */

import * as React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Download, FileSpreadsheet, UserCheck, CalendarClock } from 'lucide-react';

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
import { StatCard } from '../../_components/report-toolbar';
import { downloadCsv, downloadXlsx, dateStamp, type ExportRow } from '@/lib/crm-list-export';
import type { OverdueTaskDetailRow, OverdueTasksDeepResult } from '@/app/actions/worksuite/reports.actions';

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'secondary'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'secondary',
};

interface Props {
  data: OverdueTasksDeepResult;
  filters: {
    priority?: string;
    minDays?: string;
    maxDays?: string;
  };
}

export function OverdueTasksClient({ data, filters }: Props) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === data.rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.rows.map((r) => r._id)));
    }
  };

  const selectedRows = data.rows.filter((r) => selected.has(r._id));

  const handleBulkReassign = () => {
    if (selectedRows.length === 0) {
      alert('Select at least one task first.');
      return;
    }
    // UI placeholder — a real implementation would open a modal/drawer.
    alert(`Reassign ${selectedRows.length} task(s) — open reassign modal here.`);
  };

  const handleBulkExtend = () => {
    if (selectedRows.length === 0) {
      alert('Select at least one task first.');
      return;
    }
    alert(`Extend due date for ${selectedRows.length} task(s) — open extend modal here.`);
  };

  const exportRows: ExportRow[] = data.rows.map((r) => ({
    'Task': r.title,
    'Project': r.projectName,
    'Assignee': r.assignedTo,
    'Due Date': r.dueDate ? r.dueDate.slice(0, 10) : '—',
    'Days Overdue': r.daysOverdue,
    'Priority': r.priority,
    'Status': r.status,
  }));

  const exportHeaders = ['Task', 'Project', 'Assignee', 'Due Date', 'Days Overdue', 'Priority', 'Status'];

  const handleCsv = () => {
    downloadCsv(`overdue-tasks-${dateStamp()}.csv`, exportHeaders, exportRows);
  };

  const handleXlsx = () => {
    void downloadXlsx(`overdue-tasks-${dateStamp()}.xlsx`, exportHeaders, exportRows, 'Overdue Tasks');
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
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Min days overdue</span>
          <input
            type="number"
            name="minDays"
            defaultValue={filters.minDays ?? ''}
            min="0"
            placeholder="0"
            className="h-9 w-24 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Max days overdue</span>
          <input
            type="number"
            name="maxDays"
            defaultValue={filters.maxDays ?? ''}
            min="0"
            placeholder="any"
            className="h-9 w-24 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
          />
        </label>
        <Button type="submit" size="sm">Apply</Button>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total overdue" value={String(data.kpis.total)} tone="red" />
        <StatCard label="Overdue today" value={String(data.kpis.overdueToday)} tone="red" hint="due date falls today" />
        <StatCard label="Overdue this week" value={String(data.kpis.overdueThisWeek)} tone="amber" hint="due within last 7 days" />
        <StatCard
          label="Avg days overdue"
          value={data.kpis.avgOverdueDays > 0 ? `${data.kpis.avgOverdueDays}d` : '—'}
          tone={data.kpis.avgOverdueDays > 14 ? 'red' : 'amber'}
        />
      </div>

      {/* Chart */}
      <Card className="p-6">
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-foreground">Overdue by assignee</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Top 10 assignees by overdue task count.</p>
        </div>
        {data.byAssignee.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">No overdue tasks.</div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.byAssignee}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="assignee" tick={{ fontSize: 11 }} width={120} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Overdue tasks" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Bulk action toolbar */}
      {data.rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selected` : `${data.rows.length} tasks`}
          </span>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={handleBulkReassign}>
                  <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                  Reassign
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkExtend}>
                  <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                  Extend due
                </Button>
              </>
            )}
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
        </div>
      )}

      {/* Table */}
      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={selected.size === data.rows.length && data.rows.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Task</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Project</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Assignee</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Due date</ZoruTableHead>
                <ZoruTableHead className="text-right text-muted-foreground">Days overdue</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Priority</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {data.rows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-muted-foreground"
                  >
                    No overdue tasks — nice work!
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                data.rows.map((r: OverdueTaskDetailRow) => (
                  <ZoruTableRow key={r._id} className="border-border">
                    <ZoruTableCell>
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.title}`}
                        checked={selected.has(r._id)}
                        onChange={() => toggleRow(r._id)}
                        className="h-4 w-4 rounded border-border"
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/tasks/${r._id}`}
                        label={r.title}
                        subtitle={r.status}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-muted-foreground">{r.projectName}</ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">{r.assignedTo}</ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-destructive">
                      {r.dueDate ? r.dueDate.slice(0, 10) : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[13px] font-medium text-destructive">
                      {r.daysOverdue}d
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge variant={PRIORITY_VARIANT[r.priority] ?? 'secondary'}>
                        {r.priority}
                      </Badge>
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
