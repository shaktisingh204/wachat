'use client';

import { Button } from '@/components/zoruui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * <AttendanceCalendarByEmployee> — month-grid where each row is an
 * employee and each column is a day; cells are colour-coded by status.
 *
 * Read-only — click a coloured cell to open the underlying record. Days
 * with no row appear empty.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';

import type { AttendanceListRow } from './types';

interface AttendanceCalendarByEmployeeProps {
  rows: AttendanceListRow[];
}

const STATUS_TO_COLOR: Record<string, string> = {
  present: 'bg-emerald-500/30 text-emerald-900 dark:text-emerald-100',
  wfh: 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-100',
  absent: 'bg-rose-500/30 text-rose-900 dark:text-rose-100',
  half_day: 'bg-amber-500/30 text-amber-900 dark:text-amber-100',
  leave: 'bg-sky-500/30 text-sky-900 dark:text-sky-100',
  holiday: 'bg-zoru-surface-2 text-zoru-ink-muted',
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function buildDayKeys(start: Date, daysInMonth: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < daysInMonth; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), i + 1);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export function AttendanceCalendarByEmployee({
  rows,
}: AttendanceCalendarByEmployeeProps) {
  const [cursor, setCursor] = React.useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate();
  const dayKeys = buildDayKeys(cursor, daysInMonth);
  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  // Index by employeeId → { dayKey → row[] }
  const byEmployeeDay = React.useMemo(() => {
    const map = new Map<string, Map<string, AttendanceListRow[]>>();
    for (const r of rows) {
      if (!r.date) continue;
      const d = new Date(r.date);
      if (Number.isNaN(d.getTime())) continue;
      // Only this-month rows contribute to the grid.
      if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) {
        continue;
      }
      const key = d.toISOString().slice(0, 10);
      const inner = map.get(r.employeeId) ?? new Map<string, AttendanceListRow[]>();
      const list = inner.get(key) ?? [];
      list.push(r);
      inner.set(key, list);
      map.set(r.employeeId, inner);
    }
    return map;
  }, [rows, cursor]);

  const employees = Array.from(byEmployeeDay.keys()).sort();

  return (
    <div className="flex w-full flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-medium text-zoru-ink">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(addMonths(cursor, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zoru-line">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-zoru-surface-2">
              <th className="min-w-[160px] p-2 text-left text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                Employee
              </th>
              {dayKeys.map((k, i) => (
                <th
                  key={k}
                  className="w-7 p-1 text-center font-normal text-zoru-ink-muted"
                  title={k}
                >
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td
                  colSpan={1 + dayKeys.length}
                  className="h-20 text-center text-[12.5px] text-zoru-ink-muted"
                >
                  No attendance entries for this month.
                </td>
              </tr>
            ) : (
              employees.map((empId) => {
                const inner = byEmployeeDay.get(empId)!;
                return (
                  <tr key={empId} className="border-t border-zoru-line">
                    <td className="p-2 align-middle">
                      <EntityPickerChip entity="employee" id={empId} />
                    </td>
                    {dayKeys.map((k) => {
                      const items = inner.get(k) ?? [];
                      if (items.length === 0) {
                        return (
                          <td
                            key={k}
                            className="h-7 w-7 border-l border-zoru-line/40"
                          />
                        );
                      }
                      const first = items[0];
                      const color = STATUS_TO_COLOR[first.status] ?? 'bg-zoru-surface-2';
                      return (
                        <td
                          key={k}
                          className="h-7 w-7 border-l border-zoru-line/40 p-0"
                          title={`${first.status.replace(/_/g, ' ')} · ${k}`}
                        >
                          <Link
                            href={`/dashboard/hrm/payroll/attendance/${first._id}`}
                            className={`block h-full w-full ${color} hover:opacity-80`}
                          >
                            <span className="sr-only">
                              {first.status} on {k}
                            </span>
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zoru-ink-muted">
        <Legend className="bg-emerald-500/30" label="Present / WFH" />
        <Legend className="bg-rose-500/30" label="Absent" />
        <Legend className="bg-amber-500/30" label="Half day" />
        <Legend className="bg-sky-500/30" label="Leave" />
        <Legend className="bg-zoru-surface-2" label="Holiday" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm ${className}`} aria-hidden />
      {label}
    </span>
  );
}
