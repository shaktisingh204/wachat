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

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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

function statusTone(
  log: WsProjectTimeLog,
): 'neutral' | 'green' | 'red' | 'amber' {
  if (log.status === 'approved' || log.approved) return 'green';
  if (log.status === 'rejected') return 'red';
  if (!log.end_time) return 'amber';
  return 'neutral';
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
  const { toast } = useToast();
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
            <ClayButton
              variant="obsidian"
              className="bg-clay-red text-white hover:bg-clay-red/90"
              leading={<Square className="h-4 w-4" strokeWidth={1.75} />}
              disabled={isBusy}
              onClick={() => runningLog._id && handleStop(runningLog._id)}
            >
              Stop Timer
            </ClayButton>
          ) : (
            <ClayButton
              variant="obsidian"
              leading={<Play className="h-4 w-4" strokeWidth={1.75} />}
              onClick={() => setStartDialog(true)}
            >
              Start Timer
            </ClayButton>
          )
        }
      />

      {runningLog ? (
        <ClayCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-clay-ink-muted">
                Currently tracking
              </p>
              <p className="mt-1 text-[14.5px] font-semibold text-clay-ink">
                {runningLog.memo || 'Untitled session'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-clay-ink-muted">
                Elapsed
              </p>
              <p className="mt-1 font-mono text-[32px] font-semibold leading-none text-clay-ink tabular-nums">
                <LiveElapsed start={runningLog.start_time} />
              </p>
            </div>
          </div>
        </ClayCard>
      ) : null}

      <ClayCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Label className="text-[11px] uppercase tracking-[0.18em] text-clay-ink-muted">
              Project ID
            </Label>
            <Input
              value={filters.project_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, project_id: e.target.value }))
              }
              placeholder="Mongo ObjectId"
              className="mt-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <Label className="text-[11px] uppercase tracking-[0.18em] text-clay-ink-muted">
              Employee ID
            </Label>
            <Input
              value={filters.user_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, user_id: e.target.value }))
              }
              placeholder="Mongo ObjectId"
              className="mt-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Label className="text-[11px] uppercase tracking-[0.18em] text-clay-ink-muted">
              From
            </Label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((f) => ({ ...f, from: e.target.value }))
              }
              className="mt-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Label className="text-[11px] uppercase tracking-[0.18em] text-clay-ink-muted">
              To
            </Label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) =>
                setFilters((f) => ({ ...f, to: e.target.value }))
              }
              className="mt-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <ClayButton
            variant="pill"
            leading={<Filter className="h-4 w-4" strokeWidth={1.75} />}
            onClick={refresh}
          >
            Apply
          </ClayButton>
          <ClayButton
            variant="ghost"
            leading={<RotateCcw className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() =>
              setFilters({ project_id: '', user_id: '', from: '', to: '' })
            }
          >
            Reset
          </ClayButton>
        </div>
      </ClayCard>

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Memo</TableHead>
                <TableHead className="text-clay-ink-muted">Project</TableHead>
                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                <TableHead className="text-clay-ink-muted">Start</TableHead>
                <TableHead className="text-clay-ink-muted">End</TableHead>
                <TableHead className="text-clay-ink-muted">Duration</TableHead>
                <TableHead className="text-clay-ink-muted">Status</TableHead>
                <TableHead className="w-[200px] text-right text-clay-ink-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                [0, 1, 2].map((i) => (
                  <TableRow key={i} className="border-clay-border">
                    <TableCell colSpan={8}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No time logs yet — start a timer to begin.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((log) => (
                  <TableRow key={log._id} className="border-clay-border">
                    <TableCell className="text-[13px] text-clay-ink">
                      <Link
                        href={`/dashboard/crm/time-tracking/time-logs/${log._id}`}
                        className="hover:underline"
                      >
                        {log.memo || '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink-muted">
                      {log.project_id ? String(log.project_id) : '—'}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink-muted">
                      {log.user_id ? String(log.user_id) : '—'}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink-muted">
                      {formatDateTime(log.start_time)}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink-muted">
                      {log.end_time ? formatDateTime(log.end_time) : '—'}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {log.end_time
                        ? wsFormatDuration(log.start_time, log.end_time)
                        : (
                            <LiveElapsed start={log.start_time} />
                          )}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={statusTone(log)} dot>
                        {statusLabel(log)}
                      </ClayBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {!log.end_time ? (
                          <ClayButton
                            size="sm"
                            variant="obsidian"
                            className="bg-clay-red text-white hover:bg-clay-red/90"
                            onClick={() => log._id && handleStop(log._id)}
                            disabled={isBusy}
                          >
                            <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </ClayButton>
                        ) : !log.approved && log.status !== 'approved' ? (
                          <>
                            <ClayButton
                              size="sm"
                              variant="pill"
                              onClick={() => log._id && handleApprove(log._id)}
                              aria-label="Approve"
                            >
                              <Check className="h-3.5 w-3.5 text-clay-green" strokeWidth={2} />
                            </ClayButton>
                            <ClayButton
                              size="sm"
                              variant="pill"
                              onClick={() => setRejecting(log)}
                              aria-label="Reject"
                            >
                              <X className="h-3.5 w-3.5 text-clay-red" strokeWidth={2} />
                            </ClayButton>
                          </>
                        ) : null}
                        <ClayButton
                          size="sm"
                          variant="ghost"
                          onClick={() => log._id && handleDelete(log._id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-clay-red" strokeWidth={1.75} />
                        </ClayButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>

      <Dialog open={startDialog} onOpenChange={setStartDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">Start a timer</DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Optionally pin the timer to a project or task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-clay-ink">Project ID</Label>
              <Input
                value={startForm.project_id}
                onChange={(e) =>
                  setStartForm((f) => ({ ...f, project_id: e.target.value }))
                }
                placeholder="Optional — Mongo ObjectId"
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label className="text-clay-ink">Task ID</Label>
              <Input
                value={startForm.task_id}
                onChange={(e) =>
                  setStartForm((f) => ({ ...f, task_id: e.target.value }))
                }
                placeholder="Optional — Mongo ObjectId"
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label className="text-clay-ink">Memo</Label>
              <Textarea
                rows={3}
                value={startForm.memo}
                onChange={(e) =>
                  setStartForm((f) => ({ ...f, memo: e.target.value }))
                }
                placeholder="What are you working on?"
                className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <ClayButton variant="pill" onClick={() => setStartDialog(false)}>
              Cancel
            </ClayButton>
            <ClayButton
              variant="obsidian"
              disabled={isBusy}
              leading={
                isBusy ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Play className="h-4 w-4" strokeWidth={1.75} />
                )
              }
              onClick={handleStart}
            >
              Start
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejecting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">Reject log</DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Give a reason for the rejection — the employee will see this.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason…"
            className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
          />
          <DialogFooter className="gap-2">
            <ClayButton
              variant="pill"
              onClick={() => {
                setRejecting(null);
                setRejectReason('');
              }}
            >
              Cancel
            </ClayButton>
            <ClayButton variant="obsidian" onClick={handleReject}>
              Reject
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
