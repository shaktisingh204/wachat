'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { format } from 'date-fns';
import {
  Play,
  Square,
  Check,
  X,
  Timer,
  Clock,
  Plus,
  Filter,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getTimeLogs,
  startTimer,
  stopTimer,
  approveTimeLog,
  rejectTimeLog,
  saveTimeLog,
} from '@/app/actions/worksuite/time.actions';
import {
  wsFormatDuration,
} from '@/lib/worksuite/time-types';
import type { WsProjectTimeLog } from '@/lib/worksuite/time-types';

/* ─────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────── */

function formatTs(ts?: string | Date | null): string {
  if (!ts) return '—';
  try {
    return format(new Date(ts), 'dd MMM yy, HH:mm');
  } catch {
    return '—';
  }
}

function elapsedLabel(startTs: string | Date): string {
  const ms = Date.now() - new Date(startTs).getTime();
  if (ms <= 0) return '0h 00m 00s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

type StatusTone = 'amber' | 'green' | 'red' | 'neutral' | 'blue';

function statusTone(log: WsProjectTimeLog): StatusTone {
  if (!log.end_time) return 'amber';          // running
  if (log.status === 'approved') return 'green';
  if (log.status === 'rejected') return 'red';
  return 'neutral';
}

function statusLabel(log: WsProjectTimeLog): string {
  if (!log.end_time) return 'Running';
  if (log.status === 'approved') return 'Approved';
  if (log.status === 'rejected') return 'Rejected';
  return 'Pending';
}

/* ─────────────────────────────────────────────
 *  Page
 * ──────────────────────────────────────────── */

export default function TimeLogsPage() {
  const { toast } = useToast();

  // Data state
  const [logs, setLogs] = useState<WsProjectTimeLog[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isActing, startActing] = useTransition();

  // Filter state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Start-timer memo
  const [memo, setMemo] = useState('');

  // Live elapsed ticker
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual entry dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualMemo, setManualMemo] = useState('');
  const [isSavingManual, startManualSave] = useTransition();

  /* ── Load ── */
  const load = () => {
    startTransition(async () => {
      const filter: { from?: string; to?: string } = {};
      if (fromDate) filter.from = fromDate;
      if (toDate) filter.to = toDate;
      const data = await getTimeLogs(
        Object.keys(filter).length ? filter : undefined,
      );
      setLogs(data);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Live ticker for running entries ── */
  const hasRunning = useMemo(
    () => logs.some((l) => !l.end_time),
    [logs],
  );

  useEffect(() => {
    if (hasRunning) {
      tickRef.current = setInterval(() => setTick((n) => n + 1), 1000);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [hasRunning]);

  /* ── Actions ── */
  const handleStartTimer = () => {
    startActing(async () => {
      const r = await startTimer(undefined, undefined, memo.trim() || undefined);
      if (r.ok) {
        toast({ title: 'Timer started', description: 'Your timer is now running.' });
        setMemo('');
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleStopTimer = (id: string) => {
    startActing(async () => {
      const r = await stopTimer(id);
      if (r.ok) {
        toast({ title: 'Timer stopped', description: 'Time entry saved.' });
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleApprove = (id: string) => {
    startActing(async () => {
      const r = await approveTimeLog(id);
      if (r.ok) {
        toast({ title: 'Approved', description: 'Time log approved.' });
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleReject = (id: string) => {
    const reason = window.prompt('Reason for rejection?') ?? '';
    if (reason === null) return; // cancelled
    startActing(async () => {
      const r = await rejectTimeLog(id, reason);
      if (r.ok) {
        toast({ title: 'Rejected', description: 'Time log rejected.' });
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleManualSave = () => {
    if (!manualStart || !manualEnd) {
      toast({
        title: 'Validation error',
        description: 'Start time and end time are required.',
        variant: 'destructive',
      });
      return;
    }
    startManualSave(async () => {
      const fd = new FormData();
      fd.set('start_time', new Date(manualStart).toISOString());
      fd.set('end_time', new Date(manualEnd).toISOString());
      if (manualMemo.trim()) fd.set('memo', manualMemo.trim());
      const r = await saveTimeLog(null, fd);
      if (r.error) {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      } else {
        toast({ title: 'Entry saved', description: 'Manual time entry created.' });
        setManualOpen(false);
        setManualStart('');
        setManualEnd('');
        setManualMemo('');
        load();
      }
    });
  };

  /* ── Derived ── */
  const runningLog = useMemo(
    () => logs.find((l) => !l.end_time) ?? null,
    [logs],
  );

  const totalFormatted = useMemo(() => {
    const completedLogs = logs.filter((l) => l.end_time);
    const totalMins = completedLogs.reduce(
      (sum, l) => sum + (l.total_hours ?? 0) * 60 + (l.total_minutes ?? 0),
      0,
    );
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }, [logs]);

  /* ── Render ── */
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Time Logs"
        subtitle="Track, start, stop, and approve employee time entries."
        icon={Clock}
        actions={
          <>
            <ClayButton
              variant="pill"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              onClick={() => setManualOpen(true)}
            >
              Add Manual Entry
            </ClayButton>
          </>
        }
      />

      {/* ── Active Timer Banner ── */}
      {runningLog && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-clay-md border border-clay-amber-soft bg-clay-amber-soft/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-amber-soft">
              <Timer className="h-4 w-4 text-clay-amber" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-clay-ink">
                Timer running
              </p>
              <p className="font-mono text-[12px] text-clay-ink-muted">
                {elapsedLabel(runningLog.start_time)}
                {runningLog.memo ? ` · ${runningLog.memo}` : ''}
              </p>
            </div>
          </div>
          <ClayButton
            variant="pill"
            disabled={isActing}
            onClick={() => handleStopTimer(String(runningLog._id))}
            leading={<Square className="h-3.5 w-3.5 fill-current text-clay-amber" strokeWidth={1.75} />}
          >
            Stop Timer
          </ClayButton>
        </div>
      )}

      {/* ── Start Timer Card ── */}
      {!runningLog && (
        <ClayCard>
          <div className="flex flex-wrap items-center gap-3">
            <Timer className="h-5 w-5 shrink-0 text-clay-ink-muted" strokeWidth={1.75} />
            <Input
              placeholder="What are you working on? (optional memo)"
              className="h-9 min-w-[220px] flex-1 rounded-clay-md border-clay-border bg-clay-surface text-[13px] placeholder:text-clay-ink-muted focus-visible:ring-clay-rose"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartTimer();
              }}
            />
            <ClayButton
              variant="obsidian"
              leading={<Play className="h-4 w-4 fill-current" strokeWidth={1.75} />}
              disabled={isActing}
              onClick={handleStartTimer}
            >
              Start Timer
            </ClayButton>
          </div>
        </ClayCard>
      )}

      {/* ── Logs Table Card ── */}
      <ClayCard>
        {/* Card header + filters */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-clay-ink">Time Entries</h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              {logs.length} entr{logs.length === 1 ? 'y' : 'ies'}
              {(fromDate || toDate) ? ' (filtered)' : ''}
              {logs.length > 0 ? ` · ${totalFormatted} total` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 shrink-0 text-clay-ink-muted" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-[150px] rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              aria-label="From date"
            />
            <span className="text-[12px] text-clay-ink-muted">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-[150px] rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              aria-label="To date"
            />
            <ClayButton
              variant="pill"
              onClick={load}
              disabled={isLoading}
            >
              Apply
            </ClayButton>
            {(fromDate || toDate) && (
              <ClayButton
                variant="pill"
                onClick={() => { setFromDate(''); setToDate(''); }}
              >
                Clear
              </ClayButton>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                <TableHead className="text-clay-ink-muted">Start Time</TableHead>
                <TableHead className="text-clay-ink-muted">End Time</TableHead>
                <TableHead className="text-clay-ink-muted">Duration</TableHead>
                <TableHead className="text-clay-ink-muted">Memo</TableHead>
                <TableHead className="text-clay-ink-muted">Status</TableHead>
                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No time entries found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const id = String(log._id);
                  const isRunning = !log.end_time;
                  const tone = statusTone(log);
                  const label = statusLabel(log);
                  const isPending =
                    !!log.end_time &&
                    log.status !== 'approved' &&
                    log.status !== 'rejected';

                  const duration = isRunning
                    ? elapsedLabel(log.start_time)
                    : wsFormatDuration(log.start_time, log.end_time);

                  return (
                    <TableRow
                      key={id}
                      className={
                        isRunning
                          ? 'border-clay-border bg-clay-amber-soft/10'
                          : 'border-clay-border'
                      }
                    >
                      {/* Employee */}
                      <TableCell className="text-[13px] font-medium text-clay-ink">
                        {log.user_id || '—'}
                      </TableCell>

                      {/* Start time */}
                      <TableCell className="text-[13px] text-clay-ink">
                        {formatTs(log.start_time)}
                      </TableCell>

                      {/* End time */}
                      <TableCell className="text-[13px] text-clay-ink">
                        {isRunning ? (
                          <span className="text-clay-amber">Running…</span>
                        ) : (
                          formatTs(log.end_time)
                        )}
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="font-mono text-[13px] text-clay-ink">
                        {duration}
                      </TableCell>

                      {/* Memo */}
                      <TableCell className="max-w-[200px] truncate text-[11.5px] text-clay-ink-muted">
                        {log.memo || '—'}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <ClayBadge tone={tone} dot>
                          {label}
                        </ClayBadge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isRunning && (
                            <ClayButton variant="pill" size="sm" title="Stop Timer" disabled={isActing} onClick={() => handleStopTimer(id)}>
                              <Square className="h-3.5 w-3.5 fill-current text-clay-amber" />
                            </ClayButton>
                          )}
                          {isPending && (
                            <>
                              <ClayButton variant="pill" size="sm" title="Approve" disabled={isActing} onClick={() => handleApprove(id)}>
                                <Check className="h-3.5 w-3.5 text-clay-green" />
                              </ClayButton>
                              <ClayButton variant="pill" size="sm" title="Reject" disabled={isActing} onClick={() => handleReject(id)}>
                                <X className="h-3.5 w-3.5 text-clay-red" />
                              </ClayButton>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>

      {/* ── Manual Entry Dialog ── */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="bg-clay-surface sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-clay-ink">
              Add Manual Entry
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-clay-ink-muted">
                Start Time <span className="text-clay-red">*</span>
              </label>
              <Input
                type="datetime-local"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-clay-ink-muted">
                End Time <span className="text-clay-red">*</span>
              </label>
              <Input
                type="datetime-local"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            {manualStart && manualEnd && new Date(manualEnd) > new Date(manualStart) && (
              <p className="text-[12px] text-clay-ink-muted">
                Duration:{' '}
                <span className="font-mono font-medium text-clay-ink">
                  {wsFormatDuration(manualStart, manualEnd)}
                </span>
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-clay-ink-muted">
                Memo
              </label>
              <Input
                placeholder="What did you work on?"
                value={manualMemo}
                onChange={(e) => setManualMemo(e.target.value)}
                className="h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px] placeholder:text-clay-ink-muted"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <ClayButton variant="pill" onClick={() => setManualOpen(false)} disabled={isSavingManual}>
              Cancel
            </ClayButton>
            <ClayButton variant="obsidian" disabled={isSavingManual || !manualStart || !manualEnd} onClick={handleManualSave}>
              {isSavingManual ? 'Saving…' : 'Save Entry'}
            </ClayButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
