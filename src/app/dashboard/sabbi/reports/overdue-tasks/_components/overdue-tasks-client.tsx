'use client';

/**
 * OverdueTasksClient - full client wrapper for the Overdue Tasks report.
 *
 * Responsibilities:
 *  - Filter bar (priority, days-overdue range), URL-driven GET form
 *  - KPI cards
 *  - Bar chart: overdue count by assignee (top 10)
 *  - Table: task rows with EntityRowLink, priority badge, days-overdue column
 *  - Bulk reassign / bulk extend due date (placeholder UI, triggers toast)
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
import {
  Download,
  FileSpreadsheet,
  UserCheck,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { bulkEscalatePriority, bulkReassignTasks } from '../../_components/local-actions';

import {
  Button,
  Card,
  Badge,
  Checkbox,
  Field,
  Input,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatCard } from '../../_components/report-toolbar';
import { downloadCsv, downloadXlsx, dateStamp, type ExportRow } from '@/lib/crm-list-export';
import type { OverdueTaskDetailRow, OverdueTasksDeepResult } from '@/app/actions/worksuite/reports.actions.types';

const PRIORITY_TONE: Record<string, BadgeTone> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
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
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [priority, setPriority] = React.useState<string>(filters.priority ?? '');

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

  const handleBulkReassign = async () => {
    if (selectedRows.length === 0) {
      toast.error('Select at least one task first.');
      return;
    }
    const assigneeId = prompt('Enter new assignee ID (mock UI):');
    if (assigneeId) {
      try {
        await bulkReassignTasks(Array.from(selected), assigneeId);
        toast.success(`Reassigned ${selectedRows.length} task(s).`);
        setSelected(new Set());
      } catch (err) {
        toast.error('Failed to reassign tasks.');
      }
    }
  };

  const handleBulkExtend = () => {
    if (selectedRows.length === 0) {
      toast.error('Select at least one task first.');
      return;
    }
    toast.success(`Extended due date for ${selectedRows.length} task(s).`);
  };

  const handleEscalatePriority = async () => {
    if (selectedRows.length === 0) {
      toast.error('Select at least one task first.');
      return;
    }
    try {
      await bulkEscalatePriority(Array.from(selected));
      toast.success(`Escalated priority for ${selectedRows.length} task(s) to High.`);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to escalate priority.');
    }
  };

  const exportRows: ExportRow[] = data.rows.map((r) => ({
    'Task': r.title,
    'Project': r.projectName,
    'Assignee': r.assignedTo,
    'Due Date': r.dueDate ? r.dueDate.slice(0, 10) : '-',
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

  // recharts library object props (not JSX style); use 20ui tokens.
  const tooltipStyle = {
    backgroundColor: 'var(--st-bg-secondary)',
    border: '1px solid var(--st-border)',
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <>
      {/* Filter bar */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
      >
        {/* Carry the Select value into the GET form. */}
        <input type="hidden" name="priority" value={priority} />
        <Field label="Priority">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger aria-label="Priority" className="w-32">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Min days overdue">
          <Input
            type="number"
            name="minDays"
            defaultValue={filters.minDays ?? ''}
            min="0"
            placeholder="0"
            inputSize="sm"
            className="w-24"
          />
        </Field>
        <Field label="Max days overdue">
          <Input
            type="number"
            name="maxDays"
            defaultValue={filters.maxDays ?? ''}
            min="0"
            placeholder="any"
            inputSize="sm"
            className="w-24"
          />
        </Field>
        <Button type="submit" variant="primary" size="sm">
          Apply
        </Button>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total overdue" value={String(data.kpis.total)} tone="red" />
        <StatCard label="Overdue today" value={String(data.kpis.overdueToday)} tone="red" hint="due date falls today" />
        <StatCard label="Overdue this week" value={String(data.kpis.overdueThisWeek)} tone="amber" hint="due within last 7 days" />
        <StatCard
          label="Avg days overdue"
          value={data.kpis.avgOverdueDays > 0 ? `${data.kpis.avgOverdueDays}d` : '-'}
          tone={data.kpis.avgOverdueDays > 14 ? 'red' : 'amber'}
        />
      </div>

      {/* Chart */}
      <Card padding="lg">
        <div className="mb-3">
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Overdue by assignee</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">Top 10 assignees by overdue task count.</p>
        </div>
        {data.byAssignee.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            tone="success"
            title="No overdue tasks"
            description="Every task is on schedule. New overdue items will appear here."
            size="sm"
          />
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.byAssignee}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="assignee" tick={{ fontSize: 11 }} width={120} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Overdue tasks" fill="var(--st-danger)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Bulk action toolbar */}
      {data.rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] text-[var(--st-text-secondary)]">
            {selected.size > 0 ? `${selected.size} selected` : `${data.rows.length} tasks`}
          </span>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <>
                <Button size="sm" variant="outline" iconLeft={UserCheck} onClick={handleBulkReassign}>
                  Reassign
                </Button>
                <Button size="sm" variant="outline" iconLeft={CalendarClock} onClick={handleBulkExtend}>
                  Extend due
                </Button>
                <Button size="sm" variant="danger" iconLeft={AlertTriangle} onClick={handleEscalatePriority}>
                  Escalate Priority
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" iconLeft={Download}>
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem iconLeft={FileSpreadsheet} onClick={handleCsv}>
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem iconLeft={FileSpreadsheet} onClick={handleXlsx}>
                  XLSX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr>
                <Th width={40}>
                  <Checkbox
                    aria-label="Select all"
                    checked={selected.size === data.rows.length && data.rows.length > 0}
                    onChange={toggleAll}
                  />
                </Th>
                <Th>Task</Th>
                <Th>Project</Th>
                <Th>Assignee</Th>
                <Th>Due date</Th>
                <Th align="right">Days overdue</Th>
                <Th>Priority</Th>
              </Tr>
            </THead>
            <TBody>
              {data.rows.length === 0 ? (
                <Tr>
                  <Td colSpan={7}>
                    <EmptyState
                      icon={CheckCircle2}
                      tone="success"
                      title="No overdue tasks"
                      description="Nice work. Every task is on schedule."
                      size="sm"
                    />
                  </Td>
                </Tr>
              ) : (
                data.rows.map((r: OverdueTaskDetailRow) => (
                  <Tr key={r._id} selected={selected.has(r._id)}>
                    <Td>
                      <Checkbox
                        aria-label={`Select ${r.title}`}
                        checked={selected.has(r._id)}
                        onChange={() => toggleRow(r._id)}
                      />
                    </Td>
                    <Td>
                      <EntityRowLink
                        href={`/dashboard/crm/tasks/${r._id}`}
                        label={r.title}
                        subtitle={r.status}
                      />
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">{r.projectName}</Td>
                    <Td className="text-[13px] text-[var(--st-text)]">{r.assignedTo}</Td>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {r.dueDate ? r.dueDate.slice(0, 10) : '-'}
                    </Td>
                    <Td align="right" className="text-[13px] font-medium text-[var(--st-text)]">
                      {r.daysOverdue}d
                    </Td>
                    <Td>
                      <Badge tone={PRIORITY_TONE[r.priority] ?? 'neutral'}>
                        {r.priority}
                      </Badge>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
