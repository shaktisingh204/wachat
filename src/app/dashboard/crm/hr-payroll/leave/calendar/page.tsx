'use client';

import { ZoruCard, ZoruButton } from '@/components/zoruui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowLeft } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getLeavesForDateRange } from '@/app/actions/worksuite/leave.actions';
import type { WsLeaveCalendarEntry } from '@/lib/worksuite/leave-types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function monthEnd(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function LeaveCalendarPage() {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [entries, setEntries] = useState<WsLeaveCalendarEntry[]>([]);
  const [isLoading, startTransition] = useTransition();

  const start = useMemo(() => monthStart(cursor), [cursor]);
  const end = useMemo(() => monthEnd(cursor), [cursor]);

  useEffect(() => {
    startTransition(async () => {
      const rows = await getLeavesForDateRange(start, end);
      setEntries(rows);
    });
  }, [start, end]);

  const entriesByDay = useMemo(() => {
    const m = new Map<string, WsLeaveCalendarEntry[]>();
    for (const e of entries) {
      const bucket = m.get(e.date) ?? [];
      bucket.push(e);
      m.set(e.date, bucket);
    }
    return m;
  }, [entries]);

  const grid = useMemo(() => {
    const first = start.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date | null; iso: string | null }> = [];
    for (let i = 0; i < first; i++) cells.push({ date: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      date.setHours(0, 0, 0, 0);
      cells.push({ date, iso: toIso(date) });
    }
    return cells;
  }, [cursor, start]);

  const goPrev = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date());

  const monthLabel = cursor.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const today = toIso(new Date());

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Calendar"
        subtitle="Monthly view of approved leaves across the organization."
        icon={CalendarDays}
        actions={
          <Link href="/dashboard/crm/hr-payroll/leave">
            <ZoruButton variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ZoruButton
              variant="outline"
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </ZoruButton>
            <div className="min-w-[180px] text-center text-[16px] text-zoru-ink">
              {monthLabel}
            </div>
            <ZoruButton
              variant="outline"
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" />
              Next
            </ZoruButton>
          </div>
          <ZoruButton variant="outline" onClick={goToday}>
            Today
          </ZoruButton>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[11.5px] uppercase text-zoru-ink-muted"
            >
              {d}
            </div>
          ))}
          {grid.map((cell, idx) => {
            if (!cell.date) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[90px] rounded-lg border border-transparent"
                />
              );
            }
            const dayEntries = entriesByDay.get(cell.iso!) ?? [];
            const isToday = cell.iso === today;
            return (
              <div
                key={cell.iso!}
                className={
                  'min-h-[90px] rounded-lg border bg-zoru-bg p-1.5 ' +
                  (isToday
                    ? 'border-zoru-ink ring-1 ring-zoru-ink'
                    : 'border-zoru-line')
                }
              >
                <div className="mb-1 text-[12px] text-zoru-ink">
                  {cell.date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEntries.slice(0, 3).map((e) => (
                    <div
                      key={`${e._id}-${e.date}`}
                      className="truncate rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        backgroundColor: (e.color || '#94A3B8') + '25',
                        color: e.color || '#64748B',
                      }}
                      title={`${e.employeeName} — ${e.type_name}`}
                    >
                      {e.employeeName ?? 'Employee'}
                    </div>
                  ))}
                  {dayEntries.length > 3 ? (
                    <div className="text-[10.5px] text-zoru-ink-muted">
                      +{dayEntries.length - 3} more
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {isLoading ? (
          <p className="mt-4 text-center text-[12px] text-zoru-ink-muted">Loading…</p>
        ) : null}
      </ZoruCard>
    </div>
  );
}
