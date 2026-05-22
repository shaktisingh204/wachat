'use client';

import { Badge, Button, Card, useZoruToast } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { useParams,
  useRouter } from 'next/navigation';
import { format,
  addDays } from 'date-fns';
import {
  Send,
  Check,
  X,
  LoaderCircle,
  } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import {
  getWeeklyTimesheetById,
  getWeeklyEntries,
  upsertWeeklyEntry,
  submitWeeklyTimesheet,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet,
} from '@/app/actions/worksuite/time.actions';
import { wsToISODate } from '@/lib/worksuite/time-types';
import type {
  WsWeeklyTimesheet,
  WsWeeklyTimesheetEntry,
  WsWeeklyTimesheetStatus,
} from '@/lib/worksuite/time-types';

type StatusVariant = 'secondary' | 'warning' | 'success' | 'danger';
const STATUS_VARIANT: Record<WsWeeklyTimesheetStatus, StatusVariant> = {
  draft: 'secondary',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try {
    return format(new Date(v as any), 'EEE dd MMM');
  } catch {
    return '—';
  }
}

export default function WeeklyTimesheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useZoruToast();

  const [sheet, setSheet] = useState<WsWeeklyTimesheet | null>(null);
  const [entries, setEntries] = useState<WsWeeklyTimesheetEntry[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [isSaving, startSave] = useTransition();

  // Local edits: key = YYYY-MM-DD, value = hours string
  const [cellValues, setCellValues] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    startLoad(async () => {
      const [ts, ents] = await Promise.all([
        getWeeklyTimesheetById(id),
        getWeeklyEntries(id),
      ]);
      setSheet(ts as WsWeeklyTimesheet | null);
      setEntries(ents as WsWeeklyTimesheetEntry[]);
      // Seed cell values from server
      const initial: Record<string, string> = {};
      for (const e of ents as WsWeeklyTimesheetEntry[]) {
        const dateKey = wsToISODate(new Date(e.date as any));
        initial[dateKey] = String(e.hours ?? 0);
      }
      setCellValues(initial);
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Build 7 day columns
  const weekDays = useMemo<Date[]>(() => {
    if (!sheet?.week_start_date) return [];
    try {
      const start = new Date(sheet.week_start_date as any);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } catch {
      return [];
    }
  }, [sheet]);

  const columnTotals = useMemo(() => {
    return weekDays.map((d) => {
      const key = wsToISODate(d);
      return Number(cellValues[key] || 0);
    });
  }, [weekDays, cellValues]);

  const grandTotal = useMemo(
    () => columnTotals.reduce((s, h) => s + h, 0),
    [columnTotals],
  );

  const handleCellBlur = (dateKey: string, raw: string) => {
    const hours = Number(raw);
    if (isNaN(hours)) return;
    startSave(async () => {
      const r = await upsertWeeklyEntry(id, '', dateKey, hours);
      if (!r.ok) {
        toast({ title: 'Error', description: (r as any).error, variant: 'destructive' });
      }
      load();
    });
  };

  const handleSubmit = () => {
    startSave(async () => {
      const r = await submitWeeklyTimesheet(id);
      if (r.ok) {
        toast({ title: 'Submitted', description: 'Timesheet submitted for approval.' });
        load();
      } else {
        toast({ title: 'Error', description: (r as any).error, variant: 'destructive' });
      }
    });
  };

  const handleApprove = () => {
    startSave(async () => {
      const r = await approveWeeklyTimesheet(id);
      if (r.ok) {
        toast({ title: 'Approved' });
        load();
      } else {
        toast({ title: 'Error', description: (r as any).error, variant: 'destructive' });
      }
    });
  };

  const handleReject = () => {
    const reason = window.prompt('Reason for rejection?') ?? '';
    startSave(async () => {
      const r = await rejectWeeklyTimesheet(id, reason);
      if (r.ok) {
        toast({ title: 'Rejected' });
        load();
      } else {
        toast({ title: 'Error', description: (r as any).error, variant: 'destructive' });
      }
    });
  };

  if (isLoading && !sheet) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
        Timesheet not found.
      </div>
    );
  }

  const canEdit = sheet.status === 'draft' || sheet.status === 'rejected';

  return (
    <EntityDetailShell
      title="Weekly Timesheet"
      eyebrow={`${fmtDate(sheet.week_start_date)} – ${fmtDate(sheet.week_end_date)}`}
      back={{ href: '/dashboard/hrm/payroll/weekly-timesheets', label: 'Weekly Timesheets' }}
      actions={
        <div className="flex items-center gap-2">
          {sheet.status === 'draft' && (
            <ZoruButton
              onClick={handleSubmit}
              disabled={isSaving}
            >
              <Send className="h-4 w-4" strokeWidth={1.75} />
              Submit
            </ZoruButton>
          )}
          {sheet.status === 'submitted' && (
            <>
              <ZoruButton
                variant="outline"
                onClick={handleApprove}
                disabled={isSaving}
              >
                <Check className="h-4 w-4" strokeWidth={1.75} />
                Approve
              </ZoruButton>
              <ZoruButton
                variant="outline"
                onClick={handleReject}
                disabled={isSaving}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
                Reject
              </ZoruButton>
            </>
          )}
        </div>
      }
    >

      {/* Summary bar */}
      <div className="flex flex-wrap gap-4">
        <ZoruCard className="p-6">
          <p className="text-[12px] text-zoru-ink-muted">Status</p>
          <div className="mt-1">
            <ZoruBadge variant={STATUS_VARIANT[sheet.status]}>
              {sheet.status}
            </ZoruBadge>
          </div>
        </ZoruCard>
        <ZoruCard className="p-6">
          <p className="text-[12px] text-zoru-ink-muted">Total Hours</p>
          <p className="mt-1 text-[22px] text-zoru-ink">
            {sheet.total_hours}h {String(sheet.total_minutes ?? 0).padStart(2, '0')}m
          </p>
        </ZoruCard>
        {sheet.reason && (
          <ZoruCard className="p-6">
            <p className="text-[12px] text-zoru-ink-muted">Rejection Reason</p>
            <p className="mt-1 text-[13px] text-zoru-danger-ink">{sheet.reason}</p>
          </ZoruCard>
        )}
      </div>

      {/* Timesheet grid */}
      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[16px] text-zoru-ink">Hours Grid</h2>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <table className="w-full min-w-[700px] text-[13px]">
            <thead>
              <tr className="border-b border-zoru-line bg-zoru-surface-2">
                <th className="px-3 py-2 text-left text-[12px] font-medium text-zoru-ink-muted">
                  Task / Description
                </th>
                {weekDays.map((d) => (
                  <th
                    key={d.toISOString()}
                    className="border-l border-zoru-line px-3 py-2 text-center text-[12px] font-medium text-zoru-ink"
                  >
                    <div>{format(d, 'EEE')}</div>
                    <div className="text-[11px] text-zoru-ink-muted">{format(d, 'MMM d')}</div>
                  </th>
                ))}
                <th className="border-l border-zoru-line px-3 py-2 text-center text-[12px] font-medium text-zoru-ink-muted">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zoru-line">
                <td className="px-3 py-2 text-[13px] text-zoru-ink-muted">Hours logged</td>
                {weekDays.map((d) => {
                  const key = wsToISODate(d);
                  return (
                    <td
                      key={d.toISOString()}
                      className="border-l border-zoru-line px-2 py-1.5 text-center"
                    >
                      <input
                        type="number"
                        min={0}
                        max={24}
                        step={0.5}
                        disabled={!canEdit || isSaving}
                        value={cellValues[key] ?? '0'}
                        onChange={(e) =>
                          setCellValues((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        onBlur={(e) => handleCellBlur(key, e.target.value)}
                        className="w-16 rounded-md border border-zoru-line bg-zoru-bg px-2 py-1 text-center text-[13px] text-zoru-ink disabled:opacity-60"
                      />
                    </td>
                  );
                })}
                <td className="border-l border-zoru-line px-3 py-2 text-center font-semibold text-zoru-ink">
                  {grandTotal.toFixed(1)}h
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-zoru-line bg-zoru-surface-2">
                <td className="px-3 py-2 text-[12px] font-medium text-zoru-ink-muted">
                  Daily Total
                </td>
                {columnTotals.map((h, i) => (
                  <td
                    key={i}
                    className="border-l border-zoru-line px-3 py-2 text-center text-[13px] font-semibold text-zoru-ink"
                  >
                    {h.toFixed(1)}h
                  </td>
                ))}
                <td className="border-l border-zoru-line px-3 py-2 text-center text-[13px] font-bold text-zoru-ink">
                  {grandTotal.toFixed(1)}h
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!canEdit && (
          <p className="mt-3 text-[12px] text-zoru-ink-muted">
            Timesheet is {sheet.status} — editing is disabled.
          </p>
        )}
      </ZoruCard>
    </EntityDetailShell>
  );
}
