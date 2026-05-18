'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  useDebouncedCallback } from 'use-debounce';
import {
  Clock,
  DollarSign,
  Filter,
  Play,
  PlayCircle,
  Plus,
  Square,
  TrendingUp,
  Calendar,
  } from 'lucide-react';

/**
 * Time Logs — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards: This week (h) · This month (h) · Billable hours · Most-logged project)
 *     • Filter row (employee · project · task · date range · billable flag)
 *     • Currently-running banner
 *     • Table columns: memo · employee · project · task · date · hours · billable · status · actions
 *
 * Server actions: startTimer, stopTimer, approveTimeLog, rejectTimeLog,
 *  deleteTimeLog, getTimeLogs.
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
  deleteTimeLog,
  getTimeLogs,
  rejectTimeLog,
  startTimer,
  stopTimer,
} from '@/app/actions/worksuite/time.actions';
import type { WsProjectTimeLog } from '@/lib/worksuite/time-types';

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday-first
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
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

  const kpis = React.useMemo(() => {
    const wkStart = startOfWeek().getTime();
    const mStart = startOfMonth().getTime();
    let wkH = 0;
    let mH = 0;
    let billH = 0;
    const projHrs = new Map<string, number>();
    for (const r of rows) {
      if (!r.start_time) continue;
      const ts = new Date(r.start_time as string | Date).getTime();
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
          runningLog ? (
            <ZoruButton
              variant="destructive"
              disabled={busy}
              onClick={() => runningLog._id && handleStop(runningLog._id)}
            >
              <Square className="h-4 w-4" /> Stop timer
            </ZoruButton>
          ) : (
            <ZoruButton onClick={() => setStartDialog(true)}>
              <Plus className="h-4 w-4" /> Start timer
            </ZoruButton>
          )
        }
        filters={
          <>
            <ZoruInput
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="Employee id"
              className="h-9 w-[160px] text-[13px]"
            />
            <ZoruInput
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="Project id"
              className="h-9 w-[160px] text-[13px]"
            />
            <ZoruInput
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              placeholder="Task id"
              className="h-9 w-[140px] text-[13px]"
            />
            <ZoruInput
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-[140px] text-[13px]"
            />
            <ZoruInput
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
            <ZoruButton variant="outline" size="sm" onClick={refresh}>
              <Filter className="h-4 w-4" /> Apply
            </ZoruButton>
            {hasActiveFilters ? (
              <ZoruButton
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
              </ZoruButton>
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
              <ZoruButton onClick={() => setStartDialog(true)}>
                <Play className="h-4 w-4" /> Start timer
              </ZoruButton>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruStatCard
              label="This week"
              value={`${kpis.thisWeek}h`}
              icon={<Calendar className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="This month"
              value={`${kpis.thisMonth}h`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Billable hours"
              value={`${kpis.billable}h`}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <ZoruStatCard
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
            <ZoruCard className="p-4">
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
            </ZoruCard>
          ) : null}

          {filtered.length === 0 && !loading ? null : (
            <TimeLogsTable
              rows={filtered}
              busy={busy}
              onStop={handleStop}
              onApprove={handleApprove}
              onReject={(log) => setRejecting(log)}
              onDelete={(id) => setDeleteId(id)}
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
