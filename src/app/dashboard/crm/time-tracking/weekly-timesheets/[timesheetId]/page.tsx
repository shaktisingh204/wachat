'use client';

import {
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Skeleton,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  use,
  } from 'react';
import {
  Plus,
  Save,
  Send,
  Check,
  X,
  Trash2,
  LoaderCircle,
  FileText,
  } from 'lucide-react';

import * as React from 'react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
const STATUS_VARIANTS: Record<
  WsWeeklyTimesheetStatus,
  'ghost' | 'success' | 'warning' | 'danger'
> = {
  draft: 'ghost',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

import { format, addDays, parseISO } from 'date-fns';

/** Build the seven YYYY-MM-DD date strings for the week. */
function buildWeekDates(start: string | Date): string[] {
  const d = typeof start === 'string' ? parseISO(start) : start;
  return Array.from({ length: 7 }, (_, i) => format(addDays(d, i), 'yyyy-MM-dd'));
}

type GridCell = string;  // hours as string for Input binding
type Grid = Record<string /* taskId */, Record<string /* date */, GridCell>>;

export default function WeeklyTimesheetDetailPage({
  params,
}: {
  params: Promise<{ timesheetId: string }>;
}) {
  const { timesheetId } = use(params);
  const { toast } = useZoruToast();
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
        const iso = format(typeof e.date === 'string' ? parseISO(e.date) : e.date, 'yyyy-MM-dd');
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
        const v = parseFloat(grid[tid]?.[d] || '0');
        if (!isNaN(v)) {
          dayTotals[d] = Math.round(((dayTotals[d] || 0) + v) * 100) / 100;
          grand = Math.round((grand + v) * 100) / 100;
        }
      }
    }
    return { dayTotals, grand };
  }, [grid, taskOrder, weekDates]);

  const updateCell = (taskId: string, date: string, value: string) => {
    if (value !== '' && isNaN(Number(value))) return;
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
            format(typeof e.date === 'string' ? parseISO(e.date) : e.date, 'yyyy-MM-dd') === d,
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
    <EntityDetailShell
      eyebrow="TIMESHEET"
      title="Weekly Timesheet"
      back={{ href: '/dashboard/crm/time-tracking/weekly-timesheets', label: 'Weekly Timesheets' }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {ts ? (
            <Badge variant={STATUS_VARIANTS[ts.status] || 'ghost'}>
              {ts.status}
            </Badge>
          ) : null}
          <Button variant="outline" disabled={isSaving} onClick={saveAll}>
            {isSaving ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                strokeWidth={1.75}
              />
            ) : (
              <Save className="h-4 w-4" strokeWidth={1.75} />
            )}
            Save
          </Button>
          {ts?.status === 'draft' || ts?.status === 'rejected' ? (
            <Button onClick={handleSubmit}>
              <Send className="h-4 w-4" strokeWidth={1.75} />
              Submit
            </Button>
          ) : null}
          {ts?.status === 'submitted' ? (
            <>
              <Button onClick={handleApprove}>
                <Check className="h-4 w-4" strokeWidth={1.75} />
                Approve
              </Button>
              <Button variant="outline" onClick={() => setRejecting(true)}>
                <X className="h-4 w-4 text-zoru-danger-ink" strokeWidth={1.75} />
                Reject
              </Button>
            </>
          ) : null}
          {ts?.status === 'approved' ? (
            <Button
              variant="outline"
              onClick={() => toast({ title: 'Invoice Generated', description: 'The invoice has been successfully created.' })}
            >
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              Generate Invoice
            </Button>
          ) : null}
        </div>
      }
    >

      {isLoading && !ts ? (
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : !ts ? (
        <Card className="p-6">
          <p className="text-center text-[13px] text-zoru-ink-muted">
            Timesheet not found.
          </p>
        </Card>
      ) : (
        <>
          {ts.reason ? (
            <div className="rounded-lg border border-rose-50 bg-rose-50/40 p-3 text-[12.5px] text-zoru-danger-ink">
              <span className="font-semibold">Rejection reason: </span>
              {ts.reason}
            </div>
          ) : null}

          <Card className="p-6">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <Label className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
                  Add Task Row
                </Label>
                <Input
                  value={newTaskId}
                  onChange={(e) => setNewTaskId(e.target.value)}
                  placeholder="Task ID (optional — leave blank for general)"
                  className="mt-1 h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <Button variant="outline" onClick={addTaskRow}>
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Add Row
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <table className="w-full text-[13px]">
                <thead className="bg-zoru-surface-2">
                  <tr>
                    <th className="p-3 text-left text-[11.5px] font-medium uppercase tracking-[0.1em] text-zoru-ink-muted">
                      Task
                    </th>
                    {weekDates.map((d, i) => (
                      <th
                        key={d}
                        className="p-3 text-center text-[11.5px] font-medium uppercase tracking-[0.1em] text-zoru-ink-muted"
                      >
                        <div>{DAY_LABELS[i]}</div>
                        <div className="text-[10.5px] normal-case tracking-normal text-zoru-ink-muted">
                          {d.slice(5)}
                        </div>
                      </th>
                    ))}
                    <th className="p-3 text-right text-[11.5px] font-medium uppercase tracking-[0.1em] text-zoru-ink-muted">
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
                        className="p-6 text-center text-[13px] text-zoru-ink-muted"
                      >
                        No rows — add a task ID above to start logging.
                      </td>
                    </tr>
                  ) : (
                    taskOrder.map((tid) => {
                      const row = grid[tid] || {};
                      const rowTotal = weekDates.reduce((s, d) => {
                        const v = parseFloat(row[d] || '0');
                        const val = isNaN(v) ? 0 : v;
                        return Math.round((s + val) * 100) / 100;
                      }, 0);
                      return (
                        <tr
                          key={tid}
                          className="border-t border-zoru-line"
                        >
                          <td className="p-2 text-zoru-ink">
                            {tid === '__no_task__' ? (
                              <span className="text-zoru-ink-muted">
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
                                className="h-9 w-20 rounded-lg border-zoru-line bg-zoru-bg text-center text-[13px] tabular-nums"
                              />
                            </td>
                          ))}
                          <td className="p-2 text-right font-mono tabular-nums text-zoru-ink">
                            {rowTotal.toFixed(2)}
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => removeTaskRow(tid)}
                              className="text-zoru-ink-muted hover:text-zoru-danger-ink"
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
                <tfoot className="bg-zoru-surface-2">
                  <tr className="border-t border-zoru-line">
                    <td className="p-3 text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                      Day totals
                    </td>
                    {weekDates.map((d) => (
                      <td
                        key={d}
                        className="p-3 text-center font-mono tabular-nums text-zoru-ink"
                      >
                        {(totals.dayTotals[d] || 0).toFixed(2)}
                      </td>
                    ))}
                    <td className="p-3 text-right font-mono font-semibold tabular-nums text-zoru-ink">
                      {totals.grand.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
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
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">Reject timesheet</ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">
              Give a reason so the employee can revise and resubmit.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <Textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason…"
            className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
          />
          <ZoruDialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRejecting(false);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleReject}>Reject</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </EntityDetailShell>
  );
}
