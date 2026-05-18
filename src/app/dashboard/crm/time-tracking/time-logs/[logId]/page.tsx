'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
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
  useState,
  useTransition,
  use } from 'react';
import {
  Clock,
  Coffee,
  Square,
  LoaderCircle,
  Trash2,
  } from 'lucide-react';

import * as React from 'react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import {
  getTimeLogById,
  getBreaksForLog,
  startBreak,
  stopBreak,
  deleteBreak,
  stopTimer,
} from '@/app/actions/worksuite/time.actions';
import {
  wsFormatDuration,
  type WsProjectTimeLog,
  type WsProjectTimeLogBreak,
} from '@/lib/worksuite/time-types';

function fmt(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function TimeLogDetailPage({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const { logId } = use(params);
  const { toast } = useZoruToast();
  const [log, setLog] = useState<WsProjectTimeLog | null>(null);
  const [breaks, setBreaks] = useState<WsProjectTimeLogBreak[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [reason, setReason] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const [l, b] = await Promise.all([
        getTimeLogById(logId),
        getBreaksForLog(logId),
      ]);
      setLog(l as WsProjectTimeLog | null);
      setBreaks(b);
    });
  }, [logId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeBreak = breaks.find((br) => !br.end_time);

  const handleStartBreak = async () => {
    setIsBusy(true);
    const res = await startBreak(logId, reason);
    setIsBusy(false);
    if (res.ok) {
      setReason('');
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleStopBreak = async (breakId: string) => {
    setIsBusy(true);
    const res = await stopBreak(breakId);
    setIsBusy(false);
    if (res.ok) refresh();
    else toast({ title: 'Error', description: res.error, variant: 'destructive' });
  };

  const handleStopTimer = async () => {
    setIsBusy(true);
    const res = await stopTimer(logId);
    setIsBusy(false);
    if (res.ok) {
      toast({ title: 'Timer stopped' });
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleDeleteBreak = async (id: string) => {
    const res = await deleteBreak(id);
    if (res.success) refresh();
    else
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
  };

  return (
    <EntityDetailShell
      eyebrow="TIME LOG"
      title={log?.memo || 'Time Log'}
      back={{ href: '/dashboard/crm/time-tracking/time-logs', label: 'Time Logs' }}
      actions={
        log && !log.end_time ? (
          <ZoruButton
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={isBusy}
            onClick={handleStopTimer}
          >
            <Square className="h-4 w-4" strokeWidth={1.75} />
            Stop Timer
          </ZoruButton>
        ) : undefined
      }
    >

      {isLoading && !log ? (
        <ZoruCard className="p-6">
          <ZoruSkeleton className="h-24 w-full" />
        </ZoruCard>
      ) : !log ? (
        <ZoruCard className="p-6">
          <p className="text-center text-[13px] text-zoru-ink-muted">
            Log not found.
          </p>
        </ZoruCard>
      ) : (
        <>
          <ZoruCard className="p-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Project" value={log.project_id ? String(log.project_id) : '—'} />
              <Field label="Task" value={log.task_id ? String(log.task_id) : '—'} />
              <Field label="Employee" value={log.user_id ? String(log.user_id) : '—'} />
              <Field
                label="Total"
                value={
                  log.end_time
                    ? wsFormatDuration(log.start_time, log.end_time)
                    : 'Running…'
                }
              />
              <Field label="Start" value={fmt(log.start_time)} />
              <Field label="End" value={log.end_time ? fmt(log.end_time) : '—'} />
              <Field
                label="Earnings"
                value={log.earnings ? `${log.earnings}` : '—'}
              />
              <Field
                label="Status"
                value={
                  <ZoruBadge
                    variant={
                      log.status === 'approved' || log.approved
                        ? 'success'
                        : log.status === 'rejected'
                          ? 'danger'
                          : !log.end_time
                            ? 'warning'
                            : 'ghost'
                    }
                  >
                    {log.status === 'approved' || log.approved
                      ? 'Approved'
                      : log.status === 'rejected'
                        ? 'Rejected'
                        : !log.end_time
                          ? 'Running'
                          : 'Pending'}
                  </ZoruBadge>
                }
              />
            </div>
            {log.reason ? (
              <div className="mt-4 rounded-lg border border-rose-50 bg-rose-50/40 p-3 text-[12.5px] text-zoru-danger-ink">
                <span className="font-semibold">Reason: </span>
                {log.reason}
              </div>
            ) : null}
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-zoru-ink">
                  Breaks
                </h2>
                <p className="text-[12.5px] text-zoru-ink-muted">
                  Record pauses during this session.
                </p>
              </div>
            </div>

            {!log.end_time ? (
              <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-3">
                <div className="min-w-[220px] flex-1">
                  <ZoruLabel className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
                    Reason
                  </ZoruLabel>
                  <ZoruInput
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Coffee, lunch…"
                    className="mt-1 h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
                </div>
                {activeBreak ? (
                  <ZoruButton
                    className="bg-destructive text-white hover:bg-destructive/90"
                    disabled={isBusy}
                    onClick={() =>
                      activeBreak._id && handleStopBreak(activeBreak._id)
                    }
                  >
                    <Square className="h-4 w-4" strokeWidth={1.75} />
                    Stop Break
                  </ZoruButton>
                ) : (
                  <ZoruButton disabled={isBusy} onClick={handleStartBreak}>
                    {isBusy ? (
                      <LoaderCircle
                        className="h-4 w-4 animate-spin"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <Coffee className="h-4 w-4" strokeWidth={1.75} />
                    )}
                    Start Break
                  </ZoruButton>
                )}
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-lg border border-zoru-line">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="text-zoru-ink-muted">Reason</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Start</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">End</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Duration</ZoruTableHead>
                    <ZoruTableHead className="w-[100px] text-right text-zoru-ink-muted">
                      Actions
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {breaks.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={5}
                        className="h-20 text-center text-[13px] text-zoru-ink-muted"
                      >
                        No breaks recorded.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    breaks.map((br) => (
                      <ZoruTableRow key={br._id} className="border-zoru-line">
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {br.reason || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                          {fmt(br.start_time)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                          {br.end_time ? fmt(br.end_time) : '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {br.end_time
                            ? wsFormatDuration(br.start_time, br.end_time)
                            : '— running'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {!br.end_time ? (
                              <ZoruButton
                                size="sm"
                                className="bg-destructive text-white hover:bg-destructive/90"
                                onClick={() =>
                                  br._id && handleStopBreak(br._id)
                                }
                                disabled={isBusy}
                              >
                                <Square
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.75}
                                />
                              </ZoruButton>
                            ) : (
                              <ZoruButton
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  br._id && handleDeleteBreak(br._id)
                                }
                                aria-label="Delete"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5 text-zoru-danger-ink"
                                  strokeWidth={1.75}
                                />
                              </ZoruButton>
                            )}
                          </div>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))
                  )}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          </ZoruCard>
        </>
      )}
    </EntityDetailShell>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
        {label}
      </p>
      <div className="mt-1 text-[13.5px] text-zoru-ink">{value}</div>
    </div>
  );
}
