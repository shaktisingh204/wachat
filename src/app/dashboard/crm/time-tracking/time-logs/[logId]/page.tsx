'use client';

import * as React from 'react';
import Link from 'next/link';
import { useEffect, useState, useTransition, use } from 'react';
import {
  ArrowLeft,
  Clock,
  Coffee,
  Square,
  LoaderCircle,
  Trash2,
} from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
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
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link
          href="/dashboard/crm/time-tracking/time-logs"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to Time Logs
        </Link>
      </div>

      <CrmPageHeader
        title={log?.memo || 'Time Log'}
        subtitle={log ? `Started ${fmt(log.start_time)}` : 'Loading…'}
        icon={Clock}
        actions={
          log && !log.end_time ? (
            <ClayButton
              variant="obsidian"
              className="bg-destructive text-white hover:bg-destructive/90"
              leading={<Square className="h-4 w-4" strokeWidth={1.75} />}
              disabled={isBusy}
              onClick={handleStopTimer}
            >
              Stop Timer
            </ClayButton>
          ) : null
        }
      />

      {isLoading && !log ? (
        <ClayCard>
          <Skeleton className="h-24 w-full" />
        </ClayCard>
      ) : !log ? (
        <ClayCard>
          <p className="text-center text-[13px] text-muted-foreground">
            Log not found.
          </p>
        </ClayCard>
      ) : (
        <>
          <ClayCard>
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
                  <ClayBadge
                    tone={
                      log.status === 'approved' || log.approved
                        ? 'green'
                        : log.status === 'rejected'
                          ? 'red'
                          : !log.end_time
                            ? 'amber'
                            : 'neutral'
                    }
                    dot
                  >
                    {log.status === 'approved' || log.approved
                      ? 'Approved'
                      : log.status === 'rejected'
                        ? 'Rejected'
                        : !log.end_time
                          ? 'Running'
                          : 'Pending'}
                  </ClayBadge>
                }
              />
            </div>
            {log.reason ? (
              <div className="mt-4 rounded-lg border border-rose-50 bg-rose-50/40 p-3 text-[12.5px] text-destructive">
                <span className="font-semibold">Reason: </span>
                {log.reason}
              </div>
            ) : null}
          </ClayCard>

          <ClayCard>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-foreground">
                  Breaks
                </h2>
                <p className="text-[12.5px] text-muted-foreground">
                  Record pauses during this session.
                </p>
              </div>
            </div>

            {!log.end_time ? (
              <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border bg-secondary p-3">
                <div className="min-w-[220px] flex-1">
                  <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Reason
                  </Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Coffee, lunch…"
                    className="mt-1 h-9 rounded-lg border-border bg-card text-[13px]"
                  />
                </div>
                {activeBreak ? (
                  <ClayButton
                    variant="obsidian"
                    className="bg-destructive text-white hover:bg-destructive/90"
                    leading={<Square className="h-4 w-4" strokeWidth={1.75} />}
                    disabled={isBusy}
                    onClick={() =>
                      activeBreak._id && handleStopBreak(activeBreak._id)
                    }
                  >
                    Stop Break
                  </ClayButton>
                ) : (
                  <ClayButton
                    variant="obsidian"
                    leading={
                      isBusy ? (
                        <LoaderCircle
                          className="h-4 w-4 animate-spin"
                          strokeWidth={1.75}
                        />
                      ) : (
                        <Coffee className="h-4 w-4" strokeWidth={1.75} />
                      )
                    }
                    disabled={isBusy}
                    onClick={handleStartBreak}
                  >
                    Start Break
                  </ClayButton>
                )}
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Reason</TableHead>
                    <TableHead className="text-muted-foreground">Start</TableHead>
                    <TableHead className="text-muted-foreground">End</TableHead>
                    <TableHead className="text-muted-foreground">Duration</TableHead>
                    <TableHead className="w-[100px] text-right text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breaks.length === 0 ? (
                    <TableRow className="border-border">
                      <TableCell
                        colSpan={5}
                        className="h-20 text-center text-[13px] text-muted-foreground"
                      >
                        No breaks recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    breaks.map((br) => (
                      <TableRow key={br._id} className="border-border">
                        <TableCell className="text-[13px] text-foreground">
                          {br.reason || '—'}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {fmt(br.start_time)}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {br.end_time ? fmt(br.end_time) : '—'}
                        </TableCell>
                        <TableCell className="text-[13px] text-foreground">
                          {br.end_time
                            ? wsFormatDuration(br.start_time, br.end_time)
                            : '— running'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {!br.end_time ? (
                              <ClayButton
                                size="sm"
                                variant="obsidian"
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
                              </ClayButton>
                            ) : (
                              <ClayButton
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  br._id && handleDeleteBreak(br._id)
                                }
                                aria-label="Delete"
                              >
                                <Trash2
                                  className="h-3.5 w-3.5 text-destructive"
                                  strokeWidth={1.75}
                                />
                              </ClayButton>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ClayCard>
        </>
      )}
    </div>
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
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-[13.5px] text-foreground">{value}</div>
    </div>
  );
}
