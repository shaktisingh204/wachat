'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';

import { Badge, Card, useToast } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import {
  submitWeeklyTimesheet,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet,
  upsertWeeklyEntry,
} from '@/app/actions/worksuite/time.actions';
import { wsToISODate } from '@/lib/worksuite/time-types';
import type {
  WsWeeklyTimesheet,
  WsWeeklyTimesheetEntry,
  WsWeeklyTimesheetStatus,
} from '@/lib/worksuite/time-types';

import { HoursGrid } from './components/hours-grid';
import { TimesheetActions } from './components/timesheet-actions';
import { useCollaborativeSync } from './components/useCollaborativeSync';

type StatusVariant = 'secondary' | 'warning' | 'success' | 'danger';
const STATUS_VARIANT: Record<WsWeeklyTimesheetStatus, StatusVariant> = {
  draft: 'secondary',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};



export function TimesheetDetailClient({
  initialSheet,
  initialEntries,
  sheetId,
}: {
  initialSheet: WsWeeklyTimesheet;
  initialEntries: WsWeeklyTimesheetEntry[];
  sheetId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [sheet, setSheet] = useState<WsWeeklyTimesheet>(initialSheet);
  const [entries, setEntries] = useState<WsWeeklyTimesheetEntry[]>(initialEntries);
  const [isSaving, startSave] = useTransition();

  const [taskIds, setTaskIds] = useState<string[]>(() => {
    const ids = new Set(initialEntries.map((e) => e.task_id || 'default'));
    if (ids.size === 0) ids.add('default');
    return Array.from(ids);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // WebSockets Collaborative Sync Hook
  useCollaborativeSync(sheetId, sheet.status === 'draft', setEntries, setTaskIds);

  const weekDays = useMemo<Date[]>(() => {
    if (!sheet.week_start_date) return [];
    try {
      const start = new Date(sheet.week_start_date as any);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } catch {
      return [];
    }
  }, [sheet]);

  const filteredTasks = useMemo(() => {
    return taskIds.filter((id) => id.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [taskIds, searchQuery]);

  const groupedTasks = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const id of taskIds) {
      map.set(id, {});
    }
    for (const e of entries) {
      const tId = e.task_id || 'default';
      if (!map.has(tId)) map.set(tId, {});
      const dKey = wsToISODate(new Date(e.date as any));
      map.get(tId)![dKey] = e.hours;
    }
    return map;
  }, [entries, taskIds]);

  const columnTotals = useMemo(() => {
    return weekDays.map((d) => {
      const key = wsToISODate(d);
      let sum = 0;
      for (const tId of taskIds) {
        sum += groupedTasks.get(tId)?.[key] || 0;
      }
      return sum;
    });
  }, [weekDays, taskIds, groupedTasks]);

  const grandTotal = useMemo(() => columnTotals.reduce((s, h) => s + h, 0), [columnTotals]);

  // Actions
  const handleCellBlur = useCallback((taskId: string, dateKey: string, raw: string) => {
    const hours = Number(raw) || 0;
    
    // Optimistic UI update
    setEntries((prev) => {
      const idx = prev.findIndex((e) => (e.task_id || 'default') === taskId && wsToISODate(new Date(e.date as any)) === dateKey);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], hours };
        return next;
      }
      return [...prev, { task_id: taskId === 'default' ? '' : taskId, date: new Date(dateKey), hours, weekly_timesheet_id: sheetId } as WsWeeklyTimesheetEntry];
    });

    startSave(async () => {
      try {
        const r = await upsertWeeklyEntry(sheetId, taskId === 'default' ? '' : taskId, dateKey, hours);
        if (!r.ok) {
          toast({ title: 'Error', description: (r as any).error || 'Failed to update entry', variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Error', description: err.message || 'An unexpected error occurred', variant: 'destructive' });
      }
    });
  }, [sheetId, toast]);

  const handleSubmit = useCallback(() => {
    startSave(async () => {
      try {
        const r = await submitWeeklyTimesheet(sheetId);
        if (r.ok) {
          toast({ title: 'Submitted', description: 'Timesheet submitted for approval.', variant: 'success' });
          setSheet((s) => ({ ...s, status: 'submitted' }));
        } else {
          toast({ title: 'Submission Failed', description: (r as any).error, variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    });
  }, [sheetId, toast]);

  const handleApprove = useCallback(() => {
    startSave(async () => {
      try {
        const r = await approveWeeklyTimesheet(sheetId);
        if (r.ok) {
          toast({ title: 'Approved', variant: 'success' });
          setSheet((s) => ({ ...s, status: 'approved' }));
        } else {
          toast({ title: 'Approval Failed', description: (r as any).error, variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    });
  }, [sheetId, toast]);

  const handleReject = useCallback(() => {
    const reason = window.prompt('Reason for rejection?') ?? '';
    startSave(async () => {
      try {
        const r = await rejectWeeklyTimesheet(sheetId, reason);
        if (r.ok) {
          toast({ title: 'Rejected', variant: 'success' });
          setSheet((s) => ({ ...s, status: 'rejected', reason }));
        } else {
          toast({ title: 'Rejection Failed', description: (r as any).error, variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    });
  }, [sheetId, toast]);

  const handleExportCSV = useCallback(() => {
    const headers = ['Task ID', ...weekDays.map((d) => format(d, 'yyyy-MM-dd')), 'Total'];
    const csvRows = [headers.join(',')];
    filteredTasks.forEach((taskId) => {
      const rowHours = groupedTasks.get(taskId) || {};
      let total = 0;
      const hours = weekDays.map((d) => {
        const h = rowHours[wsToISODate(d)] || 0;
        total += h;
        return h;
      });
      csvRows.push([taskId, ...hours, total].join(','));
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `timesheet_${wsToISODate(new Date(sheet.week_start_date as any))}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Exported CSV', description: 'Timesheet exported to CSV successfully.', variant: 'success' });
  }, [filteredTasks, groupedTasks, sheet.week_start_date, weekDays, toast]);

  const handleExportPDF = useCallback(async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();
      doc.text(`Timesheet: ${wsToISODate(new Date(sheet.week_start_date as any))} to ${wsToISODate(new Date(sheet.week_end_date as any))}`, 14, 15);

      const head = [['Task ID', ...weekDays.map(d => format(d, 'yyyy-MM-dd')), 'Total']];
      const body = filteredTasks.map(taskId => {
        const rowHours = groupedTasks.get(taskId) || {};
        let total = 0;
        const hours = weekDays.map(d => {
          const h = rowHours[wsToISODate(d)] || 0;
          total += h;
          return h;
        });
        return [taskId, ...hours.map(h => h.toString()), total.toString()];
      });

      autoTable(doc, {
        head,
        body,
        startY: 20,
      });

      doc.save(`timesheet_${wsToISODate(new Date(sheet.week_start_date as any))}.pdf`);
      toast({ title: 'Exported PDF', description: 'Timesheet exported to PDF successfully.', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Export Error', description: err.message, variant: 'destructive' });
    }
  }, [filteredTasks, groupedTasks, sheet.week_start_date, sheet.week_end_date, weekDays, toast]);

  const handleAddTask = useCallback(() => {
    const newId = `task-${Date.now()}`;
    setTaskIds((prev) => [...prev, newId]);
  }, []);

  const handleBulkDeleteTasks = useCallback(() => {
    if (selectedTasks.size === 0) return;
    
    // Remove tasks from view optimistically
    const tasksToRemove = Array.from(selectedTasks);
    setTaskIds((prev) => prev.filter((id) => !tasksToRemove.includes(id)));
    setEntries((prev) => prev.filter((e) => !tasksToRemove.includes(e.task_id || 'default')));
    setSelectedTasks(new Set());
    
    toast({ title: 'Tasks Removed', description: 'Tasks and associated hours cleared.', variant: 'success' });
    
    startSave(async () => {
      try {
        // Bulk remove hours
        for (const tId of tasksToRemove) {
          for (const d of weekDays) {
             await upsertWeeklyEntry(sheetId, tId === 'default' ? '' : tId, wsToISODate(d), 0);
          }
        }
      } catch (err: any) {
        toast({ title: 'Delete Error', description: err.message, variant: 'destructive' });
      }
    });
  }, [selectedTasks, sheetId, weekDays, toast]);

  const toggleTaskSelection = useCallback((id: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedTasks((prev) => {
      if (prev.size === filteredTasks.length) {
        return new Set();
      }
      return new Set(filteredTasks);
    });
  }, [filteredTasks]);

  const canEdit = sheet.status === 'draft' || sheet.status === 'rejected';

  if (!mounted) return null; // Prevent hydration mismatch entirely for formatted dates

  return (
    <EntityDetailShell
      title="Weekly Timesheet"
      eyebrow={`${fmtDate(sheet.week_start_date)} – ${fmtDate(sheet.week_end_date)}`}
      back={{ href: '/dashboard/hrm/payroll/weekly-timesheets', label: 'Weekly Timesheets' }}
      actions={
        <TimesheetActions
          status={sheet.status}
          isSaving={isSaving}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      }
    >
      <div className="flex flex-wrap gap-4">
        <Card className="p-6 min-w-[200px]">
          <p className="text-[12px] text-[var(--st-text-secondary)]">Status</p>
          <div className="mt-1">
            <Badge variant={STATUS_VARIANT[sheet.status]}>{sheet.status}</Badge>
          </div>
        </Card>
        <Card className="p-6 min-w-[200px]">
          <p className="text-[12px] text-[var(--st-text-secondary)]">Total Hours</p>
          <p className="mt-1 text-[22px] text-[var(--st-text)]">
            {grandTotal.toFixed(1)}h
          </p>
        </Card>
        {sheet.reason && (
          <Card className="p-6 flex-1 min-w-[200px]">
            <p className="text-[12px] text-[var(--st-text-secondary)]">Rejection Reason</p>
            <p className="mt-1 text-[13px] text-[var(--st-danger)]">{sheet.reason}</p>
          </Card>
        )}
      </div>

      <HoursGrid
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredTasks={filteredTasks}
        selectedTasks={selectedTasks}
        toggleTaskSelection={toggleTaskSelection}
        toggleSelectAll={toggleSelectAll}
        canEdit={canEdit}
        isSaving={isSaving}
        weekDays={weekDays}
        groupedTasks={groupedTasks}
        handleCellBlur={handleCellBlur}
        handleAddTask={handleAddTask}
        handleBulkDeleteTasks={handleBulkDeleteTasks}
        columnTotals={columnTotals}
        grandTotal={grandTotal}
        status={sheet.status}
      />
    </EntityDetailShell>
  );
}
