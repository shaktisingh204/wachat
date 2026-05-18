'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition } from 'react';
import { format } from 'date-fns';
import {
  Play,
  Square,
  Check,
  X,
  Timer,
  Plus,
  Filter,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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

type StatusVariant = 'warning' | 'success' | 'danger' | 'secondary' | 'info';

function statusVariant(log: WsProjectTimeLog): StatusVariant {
  if (!log.end_time) return 'warning';          // running
  if (log.status === 'approved') return 'success';
  if (log.status === 'rejected') return 'danger';
  return 'secondary';
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
  const { toast } = useZoruToast();

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
    <EntityListShell
      title="Time Logs"
      subtitle="Track, start, stop, and approve employee time entries."
      primaryAction={
        <ZoruButton
          variant="outline"
          onClick={() => setManualOpen(true)}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add Manual Entry
        </ZoruButton>
      }
    >

      {/* ── Active Timer Banner ── */}
      {runningLog && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-50 bg-amber-50/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50">
              <Timer className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13px] text-zoru-ink">
                Timer running
              </p>
              <p className="font-mono text-[12px] text-zoru-ink-muted">
                {elapsedLabel(runningLog.start_time)}
                {runningLog.memo ? ` · ${runningLog.memo}` : ''}
              </p>
            </div>
          </div>
          <ZoruButton
            variant="outline"
            disabled={isActing}
            onClick={() => handleStopTimer(String(runningLog._id))}
          >
            <Square className="h-3.5 w-3.5 fill-current text-amber-500" strokeWidth={1.75} />
            Stop Timer
          </ZoruButton>
        </div>
      )}

      {/* ── Start Timer Card ── */}
      {!runningLog && (
        <ZoruCard className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Timer className="h-5 w-5 shrink-0 text-zoru-ink-muted" strokeWidth={1.75} />
            <ZoruInput
              placeholder="What are you working on? (optional memo)"
              className="h-9 min-w-[220px] flex-1 rounded-lg border-zoru-line bg-zoru-bg text-[13px] placeholder:text-zoru-ink-muted focus-visible:ring-primary"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartTimer();
              }}
            />
            <ZoruButton
              disabled={isActing}
              onClick={handleStartTimer}
            >
              <Play className="h-4 w-4 fill-current" strokeWidth={1.75} />
              Start Timer
            </ZoruButton>
          </div>
        </ZoruCard>
      )}

      {/* ── Logs Table Card ── */}
      <ZoruCard className="p-6">
        {/* Card header + filters */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] text-zoru-ink">Time Entries</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {logs.length} entr{logs.length === 1 ? 'y' : 'ies'}
              {(fromDate || toDate) ? ' (filtered)' : ''}
              {logs.length > 0 ? ` · ${totalFormatted} total` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
            <ZoruInput
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-[150px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              aria-label="From date"
            />
            <span className="text-[12px] text-zoru-ink-muted">to</span>
            <ZoruInput
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-[150px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              aria-label="To date"
            />
            <ZoruButton
              variant="outline"
              onClick={load}
              disabled={isLoading}
            >
              Apply
            </ZoruButton>
            {(fromDate || toDate) && (
              <ZoruButton
                variant="outline"
                onClick={() => { setFromDate(''); setToDate(''); }}
              >
                Clear
              </ZoruButton>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Start Time</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">End Time</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Duration</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Memo</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Loading…
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : logs.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No time entries found.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                logs.map((log) => {
                  const id = String(log._id);
                  const isRunning = !log.end_time;
                  const variant = statusVariant(log);
                  const label = statusLabel(log);
                  const isPending =
                    !!log.end_time &&
                    log.status !== 'approved' &&
                    log.status !== 'rejected';

                  const duration = isRunning
                    ? elapsedLabel(log.start_time)
                    : wsFormatDuration(log.start_time, log.end_time);

                  return (
                    <ZoruTableRow
                      key={id}
                      className={
                        isRunning
                          ? 'border-zoru-line bg-amber-50/10'
                          : 'border-zoru-line'
                      }
                    >
                      {/* Employee */}
                      <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">
                        {log.user_id || '—'}
                      </ZoruTableCell>

                      {/* Start time */}
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {formatTs(log.start_time)}
                      </ZoruTableCell>

                      {/* End time */}
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {isRunning ? (
                          <span className="text-amber-500">Running…</span>
                        ) : (
                          formatTs(log.end_time)
                        )}
                      </ZoruTableCell>

                      {/* Duration */}
                      <ZoruTableCell className="font-mono text-[13px] text-zoru-ink">
                        {duration}
                      </ZoruTableCell>

                      {/* Memo */}
                      <ZoruTableCell className="max-w-[200px] truncate text-[11.5px] text-zoru-ink-muted">
                        {log.memo || '—'}
                      </ZoruTableCell>

                      {/* Status */}
                      <ZoruTableCell>
                        <ZoruBadge variant={variant}>
                          {label}
                        </ZoruBadge>
                      </ZoruTableCell>

                      {/* Actions */}
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isRunning && (
                            <ZoruButton variant="outline" size="sm" title="Stop Timer" disabled={isActing} onClick={() => handleStopTimer(id)}>
                              <Square className="h-3.5 w-3.5 fill-current text-amber-500" />
                            </ZoruButton>
                          )}
                          {isPending && (
                            <>
                              <ZoruButton variant="outline" size="sm" title="Approve" disabled={isActing} onClick={() => handleApprove(id)}>
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              </ZoruButton>
                              <ZoruButton variant="outline" size="sm" title="Reject" disabled={isActing} onClick={() => handleReject(id)}>
                                <X className="h-3.5 w-3.5 text-zoru-danger-ink" />
                              </ZoruButton>
                            </>
                          )}
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

      {/* ── Manual Entry Dialog ── */}
      <ZoruDialog open={manualOpen} onOpenChange={setManualOpen}>
        <ZoruDialogContent className="bg-zoru-bg sm:max-w-[440px]">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-[16px] text-zoru-ink">
              Add Manual Entry
            </ZoruDialogTitle>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-zoru-ink-muted">
                Start Time <span className="text-zoru-danger-ink">*</span>
              </label>
              <ZoruInput
                type="datetime-local"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-zoru-ink-muted">
                End Time <span className="text-zoru-danger-ink">*</span>
              </label>
              <ZoruInput
                type="datetime-local"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            {manualStart && manualEnd && new Date(manualEnd) > new Date(manualStart) && (
              <p className="text-[12px] text-zoru-ink-muted">
                Duration:{' '}
                <span className="font-mono font-medium text-zoru-ink">
                  {wsFormatDuration(manualStart, manualEnd)}
                </span>
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-zoru-ink-muted">
                Memo
              </label>
              <ZoruInput
                placeholder="What did you work on?"
                value={manualMemo}
                onChange={(e) => setManualMemo(e.target.value)}
                className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px] placeholder:text-zoru-ink-muted"
              />
            </div>
          </div>

          <ZoruDialogFooter className="gap-2">
            <ZoruButton variant="outline" onClick={() => setManualOpen(false)} disabled={isSavingManual}>
              Cancel
            </ZoruButton>
            <ZoruButton disabled={isSavingManual || !manualStart || !manualEnd} onClick={handleManualSave}>
              {isSavingManual ? 'Saving…' : 'Save Entry'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </EntityListShell>
  );
}
