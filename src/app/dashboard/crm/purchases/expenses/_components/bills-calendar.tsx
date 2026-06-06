'use client';

import { Button } from '@/components/sabcrm/20ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * <BillsCalendar> — month-view calendar grouping bills by due date.
 *
 * Read-only: each day shows up to 3 bill chips + a "+N more" overflow.
 * Overdue bills render in red. Click a chip to navigate to detail.
 */

import * as React from 'react';
import Link from 'next/link';

import type { BillListRow } from './types';

interface BillsCalendarProps {
  bills: BillListRow[];
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function isOverdue(bill: BillListRow): boolean {
  if (!bill.dueDate) return false;
  const s = (bill.status ?? '').toLowerCase();
  if (s === 'paid' || s === 'cancelled') return false;
  const t = new Date(bill.dueDate).getTime();
  return !Number.isNaN(t) && t < Date.now() && bill.balance > 0;
}

export function BillsCalendar({ bills }: BillsCalendarProps) {
  const [cursor, setCursor] = React.useState<Date>(() => startOfMonth(new Date()));

  const byDay = React.useMemo(() => {
    const map = new Map<string, BillListRow[]>();
    for (const bill of bills) {
      if (!bill.dueDate) continue;
      const dt = new Date(bill.dueDate);
      if (Number.isNaN(dt.getTime())) continue;
      const key = dayKey(dt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(bill);
    }
    return map;
  }, [bills]);

  const firstOfMonth = cursor;
  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const todayKey = dayKey(new Date());

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-medium text-[var(--st-text)]">{monthLabel}</h3>
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

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--st-border)] bg-[var(--st-border)] text-[12px]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="bg-[var(--st-bg-muted)] px-2 py-1 text-center text-[11px] font-medium text-[var(--st-text-secondary)]"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          const key = dayKey(cell);
          const inMonth = cell.getMonth() === firstOfMonth.getMonth();
          const isToday = key === todayKey;
          const items = byDay.get(key) ?? [];
          const overflow = items.length - 3;
          return (
            <div
              key={i}
              className={`min-h-[88px] bg-[var(--st-bg-secondary)] p-1 ${
                inMonth ? '' : 'bg-[var(--st-bg-muted)]/60 text-[var(--st-text-secondary)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] ${
                    isToday
                      ? 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-text)] text-white'
                      : 'text-[var(--st-text-secondary)]'
                  }`}
                >
                  {cell.getDate()}
                </span>
                {items.length > 0 ? (
                  <span className="text-[10px] text-[var(--st-text-secondary)]">
                    {items.length}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {items.slice(0, 3).map((bill) => {
                  const overdue = isOverdue(bill);
                  return (
                    <Link
                      key={bill._id}
                      href={`/dashboard/crm/purchases/expenses/${bill._id}`}
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] ${
                        overdue
                          ? 'bg-[var(--st-danger)]/15 text-[var(--st-danger)] hover:bg-[var(--st-danger)]/25'
                          : 'bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-border)]'
                      }`}
                      title={`${bill.billNo} · ${fmtMoney(bill.balance, bill.currency)}`}
                    >
                      {bill.billNo}
                    </Link>
                  );
                })}
                {overflow > 0 ? (
                  <span className="text-[10px] text-[var(--st-text-secondary)]">
                    +{overflow} more
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[var(--st-text-secondary)]">
        Bills plotted by due date. Overdue items appear in red.
      </p>
    </div>
  );
}
