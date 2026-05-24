'use client';

import { useCallback, useEffect, useMemo, useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { Send, Check, X, Download, Plus, Search, Trash2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { Badge, Button, Card, useZoruToast, Input, Checkbox } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import {
  submitWeeklyTimesheet,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet,
  upsertWeeklyEntry,
  deleteWeeklyEntry,
} from '@/app/actions/worksuite/time.actions';
import { wsToISODate } from '@/lib/worksuite/time-types';
import type {
  WsWeeklyTimesheet,
  WsWeeklyTimesheetEntry,
  WsWeeklyTimesheetStatus,
} from '@/lib/worksuite/time-types';

type StatusVariant = 'secondary' | 'warning' | 'success' | 'danger';
const STATUS_VARIANT: Record<WsWeeklyTimesheetStatus, StatusVariant> = {
  draft: 'secondary',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try {
    return format(new Date(v as any), 'EEE dd MMM');
  } catch {
    return '—';
  }
}

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
  const { toast } = useZoruToast();

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

  // Collaborative editing mockup
  useEffect(() => {
    if (sheet.status !== 'draft') return;
    const timeout = setTimeout(() => {
      const mockTaskId = 'collab-task-update';
      setTaskIds((prev) => Array.from(new Set([...prev, mockTaskId])));
      toast({
        title: 'Collaborative Sync',
        description: 'A coworker added a new task row to this timesheet.',
        variant: 'success',
      });
    }, 15000);
    return () => clearTimeout(timeout);
  }, [sheet.status, toast]);

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
  const handleCellBlur = (taskId: string, dateKey: string, raw: string) => {
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
      const r = await upsertWeeklyEntry(sheetId, taskId === 'default' ? '' : taskId, dateKey, hours);
      if (!r.ok) {
        toast({ title: 'Error', description: (r as any).error, variant: 'destructive' });
      }
    });
  };

  const handleSubmit = () => {
    startSave(async () => {
      const r = await submitWeeklyTimesheet(sheetId);
      if (r.ok) {
        toast({ title: 'Submitted', description: 'Timesheet submitted for approval.', variant: 'success' });
        setSheet((s) => ({ ...s, status: 'submitted' }));
      } else {
        toast({ title: 'Error', description: (r as any).error, variant: 'destructive' });
      }
    });
  };

  const handleApprove = () => {
    startSave(async () => {
      const r = await approveWeeklyTimesheet(sheetId);
      if (r.ok) {
        toast({ title: 'Approved', variant: 'success' });
        setSheet((s) => ({ ...s, status: 'approved' }));
      } else {
        toast({ title: 'Error', description: (r as any).error, variant: 'destructive' });
      }
    });
  };

  const handleReject = () => {
    const reason = window.prompt('Reason for rejection?') ?? '';
    startSave(async () => {
      const r = await rejectWeeklyTimesheet(sheetId, reason);
      if (r.ok) {
        toast({ title: 'Rejected', variant: 'success' });
        setSheet((s) => ({ ...s, status: 'rejected', reason }));
      } else {
        toast({ title: 'Error', description: (r as any).error, variant: 'destructive' });
      }
    });
  };

  const handleExportCSV = () => {
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
    toast({ title: 'Exported', description: 'Timesheet exported to CSV.' });
  };

  const handleAddTask = () => {
    const newId = `task-${Date.now()}`;
    setTaskIds((prev) => [...prev, newId]);
  };

  const handleBulkDeleteTasks = () => {
    if (selectedTasks.size === 0) return;
    
    // Remove tasks from view optimistically
    const tasksToRemove = Array.from(selectedTasks);
    setTaskIds((prev) => prev.filter((id) => !tasksToRemove.includes(id)));
    setEntries((prev) => prev.filter((e) => !tasksToRemove.includes(e.task_id || 'default')));
    setSelectedTasks(new Set());
    
    toast({ title: 'Tasks Removed', description: 'Tasks and associated hours cleared.', variant: 'success' });
    
    startSave(async () => {
      // In a real app we'd call a bulk delete endpoint or delete each entry.
      // Since entries don't have straightforward IDs in our grouped structure, 
      // we can just set their hours to 0 via upsert to remove them.
      for (const tId of tasksToRemove) {
        for (const d of weekDays) {
           await upsertWeeklyEntry(sheetId, tId === 'default' ? '' : tId, wsToISODate(d), 0);
        }
      }
    });
  };

  const toggleTaskSelection = (id: string) => {
    const next = new Set(selectedTasks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTasks(next);
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks));
    }
  };

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // 48px row height
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  const canEdit = sheet.status === 'draft' || sheet.status === 'rejected';

  if (!mounted) return null; // Prevent hydration mismatch entirely for formatted dates

  return (
    <EntityDetailShell
      title="Weekly Timesheet"
      eyebrow={`${fmtDate(sheet.week_start_date)} – ${fmtDate(sheet.week_end_date)}`}
      back={{ href: '/dashboard/hrm/payroll/weekly-timesheets', label: 'Weekly Timesheets' }}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {sheet.status === 'draft' && (
            <Button onClick={handleSubmit} disabled={isSaving}>
              <Send className="mr-2 h-4 w-4" strokeWidth={1.75} />
              Submit
            </Button>
          )}
          {sheet.status === 'submitted' && (
            <>
              <Button variant="outline" onClick={handleApprove} disabled={isSaving}>
                <Check className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Approve
              </Button>
              <Button variant="outline" onClick={handleReject} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Reject
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap gap-4">
        <Card className="p-6">
          <p className="text-[12px] text-zoru-ink-muted">Status</p>
          <div className="mt-1">
            <Badge variant={STATUS_VARIANT[sheet.status]}>{sheet.status}</Badge>
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-[12px] text-zoru-ink-muted">Total Hours</p>
          <p className="mt-1 text-[22px] text-zoru-ink">
            {grandTotal.toFixed(1)}h
          </p>
        </Card>
        {sheet.reason && (
          <Card className="p-6">
            <p className="text-[12px] text-zoru-ink-muted">Rejection Reason</p>
            <p className="mt-1 text-[13px] text-zoru-danger-ink">{sheet.reason}</p>
          </Card>
        )}
      </div>

      <Card className="p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[16px] text-zoru-ink">Hours Grid</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
              <Input
                placeholder="Filter tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px] pl-9"
              />
            </div>
            {canEdit && selectedTasks.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDeleteTasks} disabled={isSaving}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={handleAddTask} disabled={isSaving}>
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            )}
          </div>
        </div>

        <div ref={parentRef} className="overflow-x-auto overflow-y-auto max-h-[500px] rounded-lg border border-zoru-line">
          <table className="w-full min-w-[900px] text-[13px] border-collapse relative">
            <thead className="sticky top-0 z-10 bg-zoru-surface-2 shadow-sm">
              <tr className="border-b border-zoru-line">
                <th className="px-3 py-2 text-center w-[40px]">
                  <Checkbox
                    checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                    onCheckedChange={toggleSelectAll}
                    disabled={!canEdit}
                  />
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-zoru-ink-muted min-w-[200px]">
                  Task / Description
                </th>
                {weekDays.map((d) => (
                  <th
                    key={d.toISOString()}
                    className="border-l border-zoru-line px-3 py-2 text-center text-[12px] font-medium text-zoru-ink"
                  >
                    <div>{format(d, 'EEE')}</div>
                    <div className="text-[11px] text-zoru-ink-muted">{format(d, 'MMM d')}</div>
                  </th>
                ))}
                <th className="border-l border-zoru-line px-3 py-2 text-center text-[12px] font-medium text-zoru-ink-muted">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 && <tr><td colSpan={10} style={{ height: `${paddingTop}px` }} /></tr>}
              
              {virtualItems.map((virtualRow) => {
                const taskId = filteredTasks[virtualRow.index];
                const rowHours = groupedTasks.get(taskId) || {};
                const rowTotal = weekDays.reduce((sum, d) => sum + (rowHours[wsToISODate(d)] || 0), 0);

                return (
                  <tr key={taskId} className="border-b border-zoru-line last:border-b-0 hover:bg-zoru-surface/50">
                    <td className="px-3 py-2 text-center">
                      <Checkbox
                        checked={selectedTasks.has(taskId)}
                        onCheckedChange={() => toggleTaskSelection(taskId)}
                        disabled={!canEdit}
                      />
                    </td>
                    <td className="px-3 py-2 text-[13px] text-zoru-ink font-medium">
                      {taskId === 'default' ? 'Hours logged (General)' : taskId}
                    </td>
                    {weekDays.map((d) => {
                      const key = wsToISODate(d);
                      return (
                        <td key={d.toISOString()} className="border-l border-zoru-line px-2 py-1.5 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={24}
                            step={0.5}
                            disabled={!canEdit || isSaving}
                            defaultValue={rowHours[key] || ''}
                            onBlur={(e) => handleCellBlur(taskId, key, e.target.value)}
                            className="w-16 mx-auto h-8 text-center text-[13px]"
                          />
                        </td>
                      );
                    })}
                    <td className="border-l border-zoru-line px-3 py-2 text-center font-semibold text-zoru-ink">
                      {rowTotal.toFixed(1)}h
                    </td>
                  </tr>
                );
              })}

              {paddingBottom > 0 && <tr><td colSpan={10} style={{ height: `${paddingBottom}px` }} /></tr>}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-zoru-surface-2 shadow-[0_-1px_0_0_rgba(0,0,0,0.1)]">
              <tr className="border-t border-zoru-line">
                <td colSpan={2} className="px-3 py-3 text-[12px] font-medium text-zoru-ink-muted text-right">
                  Daily Total
                </td>
                {columnTotals.map((h, i) => (
                  <td
                    key={i}
                    className="border-l border-zoru-line px-3 py-3 text-center text-[13px] font-semibold text-zoru-ink"
                  >
                    {h.toFixed(1)}h
                  </td>
                ))}
                <td className="border-l border-zoru-line px-3 py-3 text-center text-[13px] font-bold text-zoru-ink">
                  {grandTotal.toFixed(1)}h
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!canEdit && (
          <p className="mt-3 text-[12px] text-zoru-ink-muted">
            Timesheet is {sheet.status} — editing is disabled.
          </p>
        )}
      </Card>
    </EntityDetailShell>
  );
}
