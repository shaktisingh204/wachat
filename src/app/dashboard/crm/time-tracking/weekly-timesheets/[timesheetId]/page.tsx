'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  use,
} from 'react';
import {
  ArrowLeft,
  CalendarRange,
  Plus,
  Save,
  Send,
  Check,
  X,
  Trash2,
  LoaderCircle,
} from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
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
  getWeeklyTimesheetById,
  getWeeklyEntries,
  upsertWeeklyEntry,
  submitWeeklyTimesheet,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet,
} from '@/app/actions/worksuite/time.actions';
import {
  wsToISODate,
  type WsWeeklyTimesheet,
  type WsWeeklyTimesheetEntry,
  type WsWeeklyTimesheetStatus,
} from '@/lib/worksuite/time-types';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STATUS_TONES: Record<
  WsWeeklyTimesheetStatus,
  'neutral' | 'green' | 'amber' | 'red'
> = {
  draft: 'neutral',
  submitted: 'amber',
  approved: 'green',
  rejected: 'red',
};

/** Build the seven YYYY-MM-DD date strings for the week. */
function buildWeekDates(start: string | Date): string[] {
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return wsToISODate(x);
  });
}

type GridCell = string;  // hours as string for Input binding
type Grid = Record<string /* taskId */, Record<string /* date */, GridCell>>;

export default function WeeklyTimesheetDetailPage({
  params,
}: {
  params: Promise<{ timesheetId: string }>;
}) {
  const { timesheetId } = use(params);
  const { toast } = useToast();
  const [ts, setTs] = useState<WsWeeklyTimesheet | null>(null);
  const [entries, setEntries] = useState<WsWeeklyTimesheetEntry[]>([]);
  const [grid, setGrid] = useState<Grid>({});
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [newTaskId, setNewTaskId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [t, list] = await Promise.all([
        getWeeklyTimesheetById(timesheetId),
        getWeeklyEntries(timesheetId),
      ]);
      setTs(t as WsWeeklyTimesheet | null);
      setEntries(list);
      // Build grid
      const g: Grid = {};
      const order: string[] = [];
      for (const e of list) {
        const tid = e.task_id ? String(e.task_id) : '__no_task__';
        if (!g[tid]) {
          g[tid] = {};
          order.push(tid);
        }
        const iso = new Date(e.date).toISOString().slice(0, 10);
        g[tid][iso] = String(e.hours ?? '');
      }
      setGrid(g);
      setTaskOrder(order);
    });
  }, [timesheetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const weekDates = useMemo(() => {
    if (!ts?.week_start_date) return [];
    return buildWeekDates(ts.week_start_date);
  }, [ts?.week_start_date]);

  const totals = useMemo(() => {
    const dayTotals: Record<string, number> = {};
    let grand = 0;
    for (const tid of taskOrder) {
      for (const d of weekDates) {
        const v = Number(grid[tid]?.[d] || 0);
        if (!isNaN(v)) {
          dayTotals[d] = (dayTotals[d] || 0) + v;
          grand += v;
        }
      }
    }
    return { dayTotals, grand };
  }, [grid, taskOrder, weekDates]);

  const updateCell = (taskId: string, date: string, value: string) => {
    setGrid((g) => ({
      ...g,
      [taskId]: { ...(g[taskId] || {}), [date]: value },
    }));
  };

  const addTaskRow = () => {
    const tid = newTaskId.trim() || '__no_task__';
    if (taskOrder.includes(tid)) {
      toast({ title: 'Row exists', description: 'That task is already added.' });
      return;
    }
    setTaskOrder((o) => [...o, tid]);
    setGrid((g) => ({ ...g, [tid]: {} }));
    setNewTaskId('');
  };

  const removeTaskRow = (tid: string) => {
    setTaskOrder((o) => o.filter((x) => x !== tid));
    setGrid((g) => {
      const { [tid]: _removed, ...rest } = g;
      return rest;
    });
  };

  const saveAll = async () => {
    setIsSaving(true);
    let ok = true;
    for (const tid of taskOrder) {
      for (const d of weekDates) {
        const raw = grid[tid]?.[d] ?? '';
        const hours = Number(raw);
        const existing = entries.find(
          (e) =>
            (e.task_id ? String(e.task_id) : '__no_task__') === tid &&
            new Date(e.date).toISOString().slice(0, 10) === d,
        );
        const prevHours = existing ? Number(existing.hours) : 0;
        const nextHours = isNaN(hours) ? 0 : hours;
        if (raw === '' && !existing) continue;
        if (prevHours === nextHours) continue;
        const res = await upsertWeeklyEntry(
          timesheetId,
          tid === '__no_task__' ? '' : tid,
          d,
          nextHours,
        );
        if (!res.ok) ok = false;
      }
    }
    setIsSaving(false);
    if (ok) {
      toast({ title: 'Saved', description: 'Entries updated.' });
      refresh();
    } else {
      toast({
        title: 'Some entries failed',
        description: 'Check your inputs and try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    const res = await submitWeeklyTimesheet(timesheetId);
    if (res.ok) {
      toast({ title: 'Submitted' });
      refresh();
    } else toast({ title: 'Error', description: res.error, variant: 'destructive' });
  };

  const handleApprove = async () => {
    const res = await approveWeeklyTimesheet(timesheetId);
    if (res.ok) {
      toast({ title: 'Approved' });
      refresh();
    } else toast({ title: 'Error', description: res.error, variant: 'destructive' });
  };

  const handleReject = async () => {
    const res = await rejectWeeklyTimesheet(timesheetId, rejectReason);
    if (res.ok) {
      toast({ title: 'Rejected' });
      setRejecting(false);
      setRejectReason('');
      refresh();
    } else toast({ title: 'Error', description: res.error, variant: 'destructive' });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link
          href="/dashboard/crm/time-tracking/weekly-timesheets"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to Weekly Timesheets
        </Link>
      </div>

      <CrmPageHeader
        title="Weekly Timesheet"
        subtitle={
          ts
            ? `Week of ${new Date(ts.week_start_date).toISOString().slice(0, 10)} — ${new Date(
                ts.week_end_date,
              )
                .toISOString()
                .slice(0, 10)}`
            : 'Loading…'
        }
        icon={CalendarRange}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {ts ? (
              <ClayBadge tone={STATUS_TONES[ts.status] || 'neutral'} dot>
                {ts.status}
              </ClayBadge>
            ) : null}
            <ClayButton
              variant="pill"
              leading={
                isSaving ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={1.75} />
                )
              }
              disabled={isSaving}
              onClick={saveAll}
            >
              Save
            </ClayButton>
            {ts?.status === 'draft' || ts?.status === 'rejected' ? (
              <ClayButton
                variant="obsidian"
                leading={<Send className="h-4 w-4" strokeWidth={1.75} />}
                onClick={handleSubmit}
              >
                Submit
              </ClayButton>
            ) : null}
            {ts?.status === 'submitted' ? (
              <>
                <ClayButton
                  variant="obsidian"
                  leading={<Check className="h-4 w-4" strokeWidth={1.75} />}
                  onClick={handleApprove}
                >
                  Approve
                </ClayButton>
                <ClayButton
                  variant="pill"
                  leading={
                    <X
                      className="h-4 w-4 text-destructive"
                      strokeWidth={1.75}
                    />
                  }
                  onClick={() => setRejecting(true)}
                >
                  Reject
                </ClayButton>
              </>
            ) : null}
          </div>
        }
      />

      {isLoading && !ts ? (
        <ClayCard>
          <Skeleton className="h-40 w-full" />
        </ClayCard>
      ) : !ts ? (
        <ClayCard>
          <p className="text-center text-[13px] text-muted-foreground">
            Timesheet not found.
          </p>
        </ClayCard>
      ) : (
        <>
          {ts.reason ? (
            <div className="rounded-lg border border-rose-50 bg-rose-50/40 p-3 text-[12.5px] text-destructive">
              <span className="font-semibold">Rejection reason: </span>
              {ts.reason}
            </div>
          ) : null}

          <ClayCard>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Add Task Row
                </Label>
                <Input
                  value={newTaskId}
                  onChange={(e) => setNewTaskId(e.target.value)}
                  placeholder="Task ID (optional — leave blank for general)"
                  className="mt-1 h-9 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
              <ClayButton
                variant="pill"
                leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
                onClick={addTaskRow}
              >
                Add Row
              </ClayButton>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-secondary">
                  <tr>
                    <th className="p-3 text-left text-[11.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      Task
                    </th>
                    {weekDates.map((d, i) => (
                      <th
                        key={d}
                        className="p-3 text-center text-[11.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
                      >
                        <div>{DAY_LABELS[i]}</div>
                        <div className="text-[10.5px] normal-case tracking-normal text-muted-foreground">
                          {d.slice(5)}
                        </div>
                      </th>
                    ))}
                    <th className="p-3 text-right text-[11.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      Total
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {taskOrder.length === 0 ? (
                    <tr>
                      <td
                        colSpan={weekDates.length + 3}
                        className="p-6 text-center text-[13px] text-muted-foreground"
                      >
                        No rows — add a task ID above to start logging.
                      </td>
                    </tr>
                  ) : (
                    taskOrder.map((tid) => {
                      const row = grid[tid] || {};
                      const rowTotal = weekDates.reduce((s, d) => {
                        const v = Number(row[d] || 0);
                        return s + (isNaN(v) ? 0 : v);
                      }, 0);
                      return (
                        <tr
                          key={tid}
                          className="border-t border-border"
                        >
                          <td className="p-2 text-foreground">
                            {tid === '__no_task__' ? (
                              <span className="text-muted-foreground">
                                (General)
                              </span>
                            ) : (
                              <span className="font-mono text-[12px]">{tid}</span>
                            )}
                          </td>
                          {weekDates.map((d) => (
                            <td key={d} className="p-1.5">
                              <Input
                                type="number"
                                step="0.25"
                                min="0"
                                value={row[d] ?? ''}
                                onChange={(e) =>
                                  updateCell(tid, d, e.target.value)
                                }
                                className="h-9 w-20 rounded-lg border-border bg-card text-center text-[13px] tabular-nums"
                              />
                            </td>
                          ))}
                          <td className="p-2 text-right font-mono tabular-nums text-foreground">
                            {rowTotal.toFixed(2)}
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => removeTaskRow(tid)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Remove row"
                            >
                              <Trash2
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-secondary">
                  <tr className="border-t border-border">
                    <td className="p-3 text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground">
                      Day totals
                    </td>
                    {weekDates.map((d) => (
                      <td
                        key={d}
                        className="p-3 text-center font-mono tabular-nums text-foreground"
                      >
                        {(totals.dayTotals[d] || 0).toFixed(2)}
                      </td>
                    ))}
                    <td className="p-3 text-right font-mono font-semibold tabular-nums text-foreground">
                      {totals.grand.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </ClayCard>
        </>
      )}

      <Dialog
        open={rejecting}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(false);
            setRejectReason('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reject timesheet</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Give a reason so the employee can revise and resubmit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason…"
            className="rounded-lg border-border bg-card text-[13px]"
          />
          <DialogFooter className="gap-2">
            <ClayButton
              variant="pill"
              onClick={() => {
                setRejecting(false);
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
