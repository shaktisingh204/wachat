'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Card,
  Checkbox,
  Input,
  StatCard,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  useDebouncedCallback } from 'use-debounce';
import {
  Clock,
  DollarSign,
  Download,
  Filter,
  LoaderCircle,
  Play,
  PlayCircle,
  Plus,
  Square,
  Trash2,
  TrendingUp,
  Calendar,
  } from 'lucide-react';

/**
 * Time Logs — list page (rebuilt per §1D.1).
 *
 * Additions over the original:
 *  - Checkbox multi-select on every row
 *  - Bulk bar: Mark billable + Mark non-billable + Delete with confirm
 *  - Export CSV/XLSX (time log entries with hours, project, task, billable flag)
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  StartTimerDialog,
  RejectLogDialog,
  type StartTimerForm,
} from './_components/start-timer-dialog';
import {
  TimeLogsTable,
  LiveElapsed,
} from './_components/time-logs-table';
import {
  approveTimeLog,
  bulkDeleteTimeLogs,
  bulkMarkBillable,
  deleteTimeLog,
  getTimeLogs,
  rejectTimeLog,
  startTimer,
  stopTimer,
} from '@/app/actions/worksuite/time.actions';
import type { WsProjectTimeLog } from '@/lib/worksuite/time-types';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import { format, parseISO, startOfWeek as dfStartOfWeek, startOfMonth as dfStartOfMonth, getTime } from 'date-fns';

function startOfWeek(): Date {
  return dfStartOfWeek(new Date(), { weekStartsOn: 1 });
}

function startOfMonth(): Date {
  return dfStartOfMonth(new Date());
}

function fmtHours(log: WsProjectTimeLog): string {
  const h = Number(log.total_hours) || 0;
  const m = Number(log.total_minutes) || 0;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function TimeLogsPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<WsProjectTimeLog[]>([]);
  const [loading, startLoading] = React.useTransition();
  const [search, setSearch] = React.useState('');

  // Filters
  const [employeeFilter, setEmployeeFilter] = React.useState<string>('');
  const [projectFilter, setProjectFilter] = React.useState<string>('');
  const [taskFilter, setTaskFilter] = React.useState<string>('');
  const [fromDate, setFromDate] = React.useState<string>('');
  const [toDate, setToDate] = React.useState<string>('');
  const [billableFilter, setBillableFilter] = React.useState<string>('all');

  // Timer + dialogs
  const [startDialog, setStartDialog] = React.useState(false);
  const [startForm, setStartForm] = React.useState({
    project_id: '',
    task_id: '',
    memo: '',
  });
  const [rejecting, setRejecting] = React.useState<WsProjectTimeLog | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Selection
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkPending, startBulkTransition] = React.useTransition();

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = await getTimeLogs({
          project_id: projectFilter || undefined,
          user_id: employeeFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        });
        setRows(list);
      } catch (e) {
        toast({
          title: 'Failed to load time logs',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    });
  }, [employeeFilter, projectFilter, fromDate, toDate, toast]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearch = useDebouncedCallback((v: string) => setSearch(v), 300);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (taskFilter && String(r.task_id ?? '') !== taskFilter) return false;
      if (billableFilter === 'billable' && !(r as { billable?: boolean }).billable) {
        return false;
      }
      if (
        billableFilter === 'non-billable' &&
        (r as { billable?: boolean }).billable
      ) {
        return false;
      }
      if (!q) return true;
      return (r.memo || '').toLowerCase().includes(q);
    });
  }, [rows, search, taskFilter, billableFilter]);

  // Selection helpers
  const filteredIds = React.useMemo(
    () => filtered.map((r) => r._id).filter((id): id is string => typeof id === 'string'),
    [filtered],
  );
  const allChecked =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someChecked = filteredIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allChecked) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = React.useMemo(
    () => [...selected].filter((id) => filteredIds.includes(id)),
    [selected, filteredIds],
  );
  const hasSelection = selectedIds.length > 0;

  const kpis = React.useMemo(() => {
    const wkStart = startOfWeek().getTime();
    const mStart = startOfMonth().getTime();
    let wkH = 0;
    let mH = 0;
    let billH = 0;
    const projHrs = new Map<string, number>();
    for (const r of rows) {
      if (!r.start_time) continue;
      const ts = getTime(typeof r.start_time === 'string' ? parseISO(r.start_time) : new Date(r.start_time as any));
      const h =
        (Number(r.total_hours) || 0) + (Number(r.total_minutes) || 0) / 60;
      if (ts >= wkStart) wkH += h;
      if (ts >= mStart) mH += h;
      if ((r as { billable?: boolean }).billable) billH += h;
      if (r.project_id) {
        const k = String(r.project_id);
        projHrs.set(k, (projHrs.get(k) || 0) + h);
      }
    }
    let topProj: string | null = null;
    let topVal = 0;
    for (const [k, v] of projHrs.entries()) {
      if (v > topVal) {
        topVal = v;
        topProj = k;
      }
    }
    return {
      thisWeek: Math.round(wkH * 10) / 10,
      thisMonth: Math.round(mH * 10) / 10,
      billable: Math.round(billH * 10) / 10,
      topProject: topProj,
    };
  }, [rows]);

  const runningLog = React.useMemo(() => rows.find((r) => !r.end_time), [rows]);

  const handleStart = React.useCallback(async () => {
    setBusy(true);
    const res = await startTimer(
      startForm.project_id || undefined,
      startForm.task_id || undefined,
      startForm.memo || undefined,
    );
    setBusy(false);
    if (res.ok) {
      toast({ title: 'Timer started', description: 'Clock is running.' });
      setStartDialog(false);
      setStartForm({ project_id: '', task_id: '', memo: '' });
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  }, [startForm, refresh, toast]);

  const handleStop = React.useCallback(
    async (id: string) => {
      setBusy(true);
      const res = await stopTimer(id);
      setBusy(false);
      if (res.ok) {
        toast({ title: 'Timer stopped' });
        refresh();
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      }
    },
    [refresh, toast],
  );

  const handleApprove = React.useCallback(
    async (id: string) => {
      const res = await approveTimeLog(id);
      if (res.ok) {
        toast({ title: 'Approved' });
        refresh();
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      }
    },
    [refresh, toast],
  );

  const handleReject = React.useCallback(async () => {
    if (!rejecting?._id) return;
    const res = await rejectTimeLog(rejecting._id, rejectReason);
    if (res.ok) {
      toast({ title: 'Rejected' });
      setRejecting(null);
      setRejectReason('');
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  }, [rejecting, rejectReason, refresh, toast]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteId) return;
    const res = await deleteTimeLog(deleteId);
    if (res?.success) {
      toast({ title: 'Deleted' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res?.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
    setDeleteId(null);
  }, [deleteId, refresh, toast]);

  // Bulk mark billable/non-billable
  const handleBulkMarkBillable = (billable: boolean) => {
    startBulkTransition(async () => {
      const res = await bulkMarkBillable(selectedIds, billable);
      if (res.ok) {
        toast({ title: `${res.count} log(s) updated` });
        setSelected(new Set());
        refresh();
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Bulk delete
  const handleBulkDelete = () => {
    startBulkTransition(async () => {
      const res = await bulkDeleteTimeLogs(selectedIds);
      if (res.ok) {
        toast({ title: `${res.count} log(s) deleted` });
        setSelected(new Set());
        refresh();
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      }
      setBulkDeleteOpen(false);
    });
  };

  // Export CSV/XLSX
  const handleExportCsv = () => {
    const exportRows = filtered.map((r) => ({
      Memo: r.memo || '',
      'Employee ID': String(r.user_id ?? ''),
      'Project ID': String(r.project_id ?? ''),
      'Task ID': String(r.task_id ?? ''),
      Date: r.start_time ? format(typeof r.start_time === 'string' ? parseISO(r.start_time) : new Date(r.start_time as any), 'yyyy-MM-dd') : '',
      Hours: Number(r.total_hours) || 0,
      Minutes: Number(r.total_minutes) || 0,
      Billable: (r as { billable?: boolean }).billable ? 'Yes' : 'No',
      Status: r.end_time ? 'completed' : 'running',
    }));
    downloadCsv(
      `time-logs-${dateStamp()}.csv`,
      Object.keys(exportRows[0] ?? {}),
      exportRows,
    );
    toast({ title: 'CSV exported' });
  };

  const handleExportXlsx = async () => {
    const exportRows = filtered.map((r) => ({
      Memo: r.memo || '',
      'Employee ID': String(r.user_id ?? ''),
      'Project ID': String(r.project_id ?? ''),
      'Task ID': String(r.task_id ?? ''),
      Date: r.start_time ? format(typeof r.start_time === 'string' ? parseISO(r.start_time) : new Date(r.start_time as any), 'yyyy-MM-dd') : '',
      Hours: Number(r.total_hours) || 0,
      Minutes: Number(r.total_minutes) || 0,
      Billable: (r as { billable?: boolean }).billable ? 'Yes' : 'No',
      Status: r.end_time ? 'completed' : 'running',
    }));
    await downloadXlsx(
      `time-logs-${dateStamp()}.xlsx`,
      Object.keys(exportRows[0] ?? {}),
      exportRows,
      'Time Logs',
    );
    toast({ title: 'XLSX exported' });
  };

  const hasActiveFilters =
    !!employeeFilter ||
    !!projectFilter ||
    !!taskFilter ||
    !!fromDate ||
    !!toDate ||
    billableFilter !== 'all';

  return (
    <>
      <EntityListShell
        title="Time Logs"
        subtitle="Start and stop timers on projects. Approve, reject, or audit hours."
        search={{
          value: search,
          onChange: handleSearch,
          placeholder: 'Search memo…',
        }}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={filtered.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> XLSX
            </Button>
            {runningLog ? (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => runningLog._id && handleStop(runningLog._id)}
              >
                <Square className="h-4 w-4" /> Stop timer
              </Button>
            ) : (
              <Button onClick={() => setStartDialog(true)}>
                <Plus className="h-4 w-4" /> Start timer
              </Button>
            )}
          </div>
        }
        filters={
          <>
            <Input
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="Employee id"
              className="h-9 w-[160px] text-[13px]"
            />
            <Input
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="Project id"
              className="h-9 w-[160px] text-[13px]"
            />
            <Input
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              placeholder="Task id"
              className="h-9 w-[140px] text-[13px]"
            />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-[140px] text-[13px]"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-[140px] text-[13px]"
            />
            <EnumFilterField
              enumName="timeBillableFilter"
              value={billableFilter}
              onChange={setBillableFilter}
              allLabel="All"
            />
            <Button variant="outline" size="sm" onClick={refresh}>
              <Filter className="h-4 w-4" /> Apply
            </Button>
            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEmployeeFilter('');
                  setProjectFilter('');
                  setTaskFilter('');
                  setFromDate('');
                  setToDate('');
                  setBillableFilter('all');
                }}
              >
                Clear
              </Button>
            ) : null}
          </>
        }
        empty={
          !loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <PlayCircle className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No time logged</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Start a timer or import logs from your project pages to see them
                here.
              </p>
              <Button onClick={() => setStartDialog(true)}>
                <Play className="h-4 w-4" /> Start timer
              </Button>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="This week"
              value={`${kpis.thisWeek}h`}
              icon={<Calendar className="h-4 w-4" />}
            />
            <StatCard
              label="This month"
              value={`${kpis.thisMonth}h`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Billable hours"
              value={`${kpis.billable}h`}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <StatCard
              label="Top project"
              value={
                kpis.topProject ? (
                  <EntityPickerChip
                    entity="project"
                    id={kpis.topProject}
                    fallback="—"
                  />
                ) : (
                  '—'
                )
              }
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          {/* Running timer banner */}
          {runningLog ? (
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
                    Currently tracking
                  </p>
                  <p className="mt-1 text-[14.5px] font-semibold text-zoru-ink">
                    {runningLog.memo || 'Untitled session'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
                    Elapsed
                  </p>
                  <p className="mt-1 font-mono text-[28px] font-semibold leading-none tabular-nums text-zoru-ink">
                    <LiveElapsed start={runningLog.start_time} />
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {/* Bulk selection header */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                <Checkbox
                  checked={allChecked}
                  aria-checked={someChecked && !allChecked ? 'mixed' : allChecked}
                  onCheckedChange={toggleAll}
                  aria-label="Select all visible logs"
                />
                Select all
              </label>
            </div>
          )}

          {/* Bulk action bar */}
          {hasSelection && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm">
              <span className="font-medium text-foreground">
                {selectedIds.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={bulkPending}
                onClick={() => handleBulkMarkBillable(true)}
              >
                {bulkPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Mark billable
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulkPending}
                onClick={() => handleBulkMarkBillable(false)}
              >
                Mark non-billable
              </Button>
              <ZoruAlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={bulkPending}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete selected
                </Button>
                <ZoruAlertDialogContent>
                  <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>
                      Delete {selectedIds.length} log(s)?
                    </ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>
                      This permanently removes the selected time entries. This
                      action cannot be undone.
                    </ZoruAlertDialogDescription>
                  </ZoruAlertDialogHeader>
                  <ZoruAlertDialogFooter>
                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                    <ZoruAlertDialogAction
                      onClick={handleBulkDelete}
                      disabled={bulkPending}
                    >
                      {bulkPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Delete
                    </ZoruAlertDialogAction>
                  </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
              </ZoruAlertDialog>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </Button>
            </div>
          )}

          {filtered.length === 0 && !loading ? null : (
            <TimeLogsTable
              rows={filtered}
              busy={busy}
              onStop={handleStop}
              onApprove={handleApprove}
              onReject={(log) => setRejecting(log)}
              onDelete={(id) => setDeleteId(id)}
              selected={selected}
              onToggleRow={toggleOne}
            />
          )}
        </div>
      </EntityListShell>

      <StartTimerDialog
        open={startDialog}
        busy={busy}
        form={startForm}
        onFormChange={(next: StartTimerForm) => setStartForm(next)}
        onOpenChange={setStartDialog}
        onConfirm={handleStart}
      />

      <RejectLogDialog
        open={rejecting !== null}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setRejectReason('');
          }
        }}
        onConfirm={handleReject}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this time log?"
        description="This permanently removes the time entry. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
