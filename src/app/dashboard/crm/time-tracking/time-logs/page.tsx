'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  PlayCircle,
  Play,
  Square,
  Check,
  X,
  Trash2,
  Filter,
  RotateCcw,
  LoaderCircle,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  getTimeLogs,
  startTimer,
  stopTimer,
  approveTimeLog,
  rejectTimeLog,
  deleteTimeLog,
} from '@/app/actions/worksuite/time.actions';
import {
  wsFormatDuration,
  type WsProjectTimeLog,
} from '@/lib/worksuite/time-types';

function formatDateTime(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function statusVariant(
  log: WsProjectTimeLog,
): 'ghost' | 'success' | 'danger' | 'warning' {
  if (log.status === 'approved' || log.approved) return 'success';
  if (log.status === 'rejected') return 'danger';
  if (!log.end_time) return 'warning';
  return 'ghost';
}

function statusLabel(log: WsProjectTimeLog): string {
  if (log.status === 'approved' || log.approved) return 'Approved';
  if (log.status === 'rejected') return 'Rejected';
  if (!log.end_time) return 'Running';
  return 'Pending';
}

function LiveElapsed({ start }: { start: string | Date }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);
  return <span>{wsFormatDuration(start, new Date())}</span>;
}

export default function TimeLogsPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<WsProjectTimeLog[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [startDialog, setStartDialog] = useState(false);
  const [rejecting, setRejecting] = useState<WsProjectTimeLog | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filters, setFilters] = useState({
    project_id: '',
    user_id: '',
    from: '',
    to: '',
  });
  const [startForm, setStartForm] = useState({
    project_id: '',
    task_id: '',
    memo: '',
  });
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(() => {
    startLoading(async () => {
      try {
        const list = await getTimeLogs({
          project_id: filters.project_id || undefined,
          user_id: filters.user_id || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        });
        setRows(list);
      } catch (e) {
        console.error('Failed to load time logs', e);
      }
    });
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runningLog = useMemo(() => rows.find((r) => !r.end_time), [rows]);

  const handleStart = async () => {
    setIsBusy(true);
    const res = await startTimer(
      startForm.project_id || undefined,
      startForm.task_id || undefined,
      startForm.memo || undefined,
    );
    setIsBusy(false);
    if (res.ok) {
      toast({ title: 'Timer started', description: 'Clock is running.' });
      setStartDialog(false);
      setStartForm({ project_id: '', task_id: '', memo: '' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const handleStop = async (logId: string) => {
    setIsBusy(true);
    const res = await stopTimer(logId);
    setIsBusy(false);
    if (res.ok) {
      toast({ title: 'Timer stopped' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (logId: string) => {
    const res = await approveTimeLog(logId);
    if (res.ok) {
      toast({ title: 'Approved' });
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
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
  };

  const handleDelete = async (id: string) => {
    const res = await deleteTimeLog(id);
    if (res.success) {
      toast({ title: 'Deleted' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Time Logs"
        subtitle="Track project time with start/stop timers. Approve or reject submissions."
        icon={PlayCircle}
        actions={
          runningLog ? (
            <ZoruButton
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isBusy}
              onClick={() => runningLog._id && handleStop(runningLog._id)}
            >
              <Square className="h-4 w-4" strokeWidth={1.75} />
              Stop Timer
            </ZoruButton>
          ) : (
            <ZoruButton onClick={() => setStartDialog(true)}>
              <Play className="h-4 w-4" strokeWidth={1.75} />
              Start Timer
            </ZoruButton>
          )
        }
      />

      {runningLog ? (
        <ZoruCard className="p-6">
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
              <p className="mt-1 font-mono text-[32px] font-semibold leading-none text-zoru-ink tabular-nums">
                <LiveElapsed start={runningLog.start_time} />
              </p>
            </div>
          </div>
        </ZoruCard>
      ) : null}

      <ZoruCard className="p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <ZoruLabel className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
              Project ID
            </ZoruLabel>
            <ZoruInput
              value={filters.project_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, project_id: e.target.value }))
              }
              placeholder="Mongo ObjectId"
              className="mt-1 h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <ZoruLabel className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
              Employee ID
            </ZoruLabel>
            <ZoruInput
              value={filters.user_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, user_id: e.target.value }))
              }
              placeholder="Mongo ObjectId"
              className="mt-1 h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <ZoruLabel className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
              From
            </ZoruLabel>
            <ZoruInput
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((f) => ({ ...f, from: e.target.value }))
              }
              className="mt-1 h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <ZoruLabel className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
              To
            </ZoruLabel>
            <ZoruInput
              type="date"
              value={filters.to}
              onChange={(e) =>
                setFilters((f) => ({ ...f, to: e.target.value }))
              }
              className="mt-1 h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </div>
          <ZoruButton variant="outline" onClick={refresh}>
            <Filter className="h-4 w-4" strokeWidth={1.75} />
            Apply
          </ZoruButton>
          <ZoruButton
            variant="ghost"
            onClick={() =>
              setFilters({ project_id: '', user_id: '', from: '', to: '' })
            }
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            Reset
          </ZoruButton>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Memo</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Project</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Start</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">End</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Duration</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="w-[200px] text-right text-zoru-ink-muted">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                [0, 1, 2].map((i) => (
                  <ZoruTableRow key={i} className="border-zoru-line">
                    <ZoruTableCell colSpan={8}>
                      <ZoruSkeleton className="h-8 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : rows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No time logs yet — start a timer to begin.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((log) => (
                  <ZoruTableRow key={log._id} className="border-zoru-line">
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      <Link
                        href={`/dashboard/crm/time-tracking/time-logs/${log._id}`}
                        className="hover:underline"
                      >
                        {log.memo || '—'}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      {log.project_id ? String(log.project_id) : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      {log.user_id ? String(log.user_id) : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      {formatDateTime(log.start_time)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      {log.end_time ? formatDateTime(log.end_time) : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {log.end_time
                        ? wsFormatDuration(log.start_time, log.end_time)
                        : (
                            <LiveElapsed start={log.start_time} />
                          )}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={statusVariant(log)}>
                        {statusLabel(log)}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {!log.end_time ? (
                          <ZoruButton
                            size="sm"
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => log._id && handleStop(log._id)}
                            disabled={isBusy}
                          >
                            <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </ZoruButton>
                        ) : !log.approved && log.status !== 'approved' ? (
                          <>
                            <ZoruButton
                              size="sm"
                              variant="outline"
                              onClick={() => log._id && handleApprove(log._id)}
                              aria-label="Approve"
                            >
                              <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
                            </ZoruButton>
                            <ZoruButton
                              size="sm"
                              variant="outline"
                              onClick={() => setRejecting(log)}
                              aria-label="Reject"
                            >
                              <X className="h-3.5 w-3.5 text-zoru-danger-ink" strokeWidth={2} />
                            </ZoruButton>
                          </>
                        ) : null}
                        <ZoruButton
                          size="sm"
                          variant="ghost"
                          onClick={() => log._id && handleDelete(log._id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" strokeWidth={1.75} />
                        </ZoruButton>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

      <ZoruDialog open={startDialog} onOpenChange={setStartDialog}>
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">Start a timer</ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">
              Optionally pin the timer to a project or task.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div>
              <ZoruLabel className="text-zoru-ink">Project ID</ZoruLabel>
              <ZoruInput
                value={startForm.project_id}
                onChange={(e) =>
                  setStartForm((f) => ({ ...f, project_id: e.target.value }))
                }
                placeholder="Optional — Mongo ObjectId"
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel className="text-zoru-ink">Task ID</ZoruLabel>
              <ZoruInput
                value={startForm.task_id}
                onChange={(e) =>
                  setStartForm((f) => ({ ...f, task_id: e.target.value }))
                }
                placeholder="Optional — Mongo ObjectId"
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel className="text-zoru-ink">Memo</ZoruLabel>
              <ZoruTextarea
                rows={3}
                value={startForm.memo}
                onChange={(e) =>
                  setStartForm((f) => ({ ...f, memo: e.target.value }))
                }
                placeholder="What are you working on?"
                className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
          </div>
          <ZoruDialogFooter className="gap-2">
            <ZoruButton variant="outline" onClick={() => setStartDialog(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton disabled={isBusy} onClick={handleStart}>
              {isBusy ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  strokeWidth={1.75}
                />
              ) : (
                <Play className="h-4 w-4" strokeWidth={1.75} />
              )}
              Start
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <ZoruDialog
        open={rejecting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setRejectReason('');
          }
        }}
      >
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">Reject log</ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">
              Give a reason for the rejection — the employee will see this.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruTextarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason…"
            className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
          />
          <ZoruDialogFooter className="gap-2">
            <ZoruButton
              variant="outline"
              onClick={() => {
                setRejecting(null);
                setRejectReason('');
              }}
            >
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleReject}>Reject</ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
