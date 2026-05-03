"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { cn } from "./lib/cn";
import { ZoruButton } from "./button";

export interface ZoruFullscreenCalendarEvent {
  id: string;
  date: Date;
  title: React.ReactNode;
  meta?: React.ReactNode;
}

export interface ZoruFullscreenCalendarProps {
  /** Initial month rendered. Defaults to the current month. */
  defaultMonth?: Date;
  events?: ZoruFullscreenCalendarEvent[];
  onSelectDate?: (date: Date) => void;
  onCreateEvent?: (date: Date) => void;
  className?: string;
}

/**
 * Month-grid calendar that fills its parent container. Each cell shows
 * up to 3 events; click a cell to call `onSelectDate`.
 */
export function ZoruFullscreenCalendar({
  defaultMonth = new Date(),
  events = [],
  onSelectDate,
  onCreateEvent,
  className,
}: ZoruFullscreenCalendarProps) {
  const [month, setMonth] = React.useState(defaultMonth);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const out: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      out.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return out;
  }, [month]);

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, ZoruFullscreenCalendarEvent[]>();
    for (const e of events) {
      const key = format(e.date, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-zoru-line px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zoru-ink">
            {format(month, "MMMM yyyy")}
          </p>
          <p className="text-xs text-zoru-ink-muted">
            {events.length} event{events.length === 1 ? "" : "s"} this month
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ZoruButton
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft />
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setMonth(new Date())}
          >
            Today
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight />
          </ZoruButton>
        </div>
      </header>

      <div className="grid grid-cols-7 border-b border-zoru-line text-[10px] uppercase tracking-wide text-zoru-ink-subtle">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-3 py-2 text-left">
            {d}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((day, idx) => {
          const inMonth = isSameMonth(day, month);
          const dayEvents = eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate?.(day)}
              className={cn(
                "group relative flex flex-col items-stretch border-b border-r border-zoru-line p-2 text-left transition-colors",
                "hover:bg-zoru-surface focus-visible:outline-none",
                !inMonth && "bg-zoru-surface/40 text-zoru-ink-subtle",
                idx % 7 === 6 && "border-r-0",
                idx >= days.length - 7 && "border-b-0",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs",
                    isToday(day) && "bg-zoru-primary text-zoru-primary-foreground",
                    !isToday(day) && inMonth && "text-zoru-ink",
                  )}
                >
                  {format(day, "d")}
                </span>
                {onCreateEvent && (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateEvent(day);
                    }}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Add event on ${format(day, "PP")}`}
                  >
                    <Plus className="h-3 w-3 text-zoru-ink-muted" />
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      "truncate rounded-[3px] bg-zoru-surface-2 px-1.5 py-0.5 text-[11px] text-zoru-ink",
                      isSameDay(day, e.date) && isToday(day) &&
                        "bg-zoru-primary/10",
                    )}
                  >
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-zoru-ink-muted">
                    + {dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
