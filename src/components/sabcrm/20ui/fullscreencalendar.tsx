'use client';

/**
 * 20ui — FullscreenCalendar.
 *
 * A full-page month grid with events, mirroring Ui20's fullscreen-calendar
 * but reimplemented in the 20ui token system (no import). The header
 * carries a month label, a "Month" view label, and prev / today / next
 * IconButtons; the body is a 7-column grid with a weekday header row and day
 * cells (date number, today highlight, outside-month muting, event chips with
 * an overflow "+N" indicator). All date math is date-fns.
 *
 * `month` is optionally controlled (pair with `onMonthChange`); left
 * uncontrolled it manages its own visible month from today.
 *
 * Accessibility: the grid uses role="grid" / role="row" / role="gridcell"
 * with an aria-label announcing the visible month; each day cell is a native
 * <button> with an aria-label like "5 June 2026, 2 events"; event chips are
 * native <button>s with their own accessible names; the today cell is marked
 * with aria-current="date".
 *
 * Example:
 *   const events = [
 *     { id: 'e1', date: new Date(2026, 5, 5), title: 'Kickoff call' },        // "Kickoff call"
 *     { id: 'e2', date: new Date(2026, 5, 5), title: 'Design review', color: '#f97316' },
 *   ];
 *   <FullscreenCalendar events={events} onDateClick={(d) => …} />
 */

import * as React from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { IconButton, Button } from './button';

import './fullscreencalendar.css';

/** A single event placed on a calendar day. */
export interface CalendarEvent {
  id: string;
  date: Date;
  title: React.ReactNode;
  /** Optional accent colour for the chip dot (hex / rgb / css var). */
  color?: string;
}

export interface FullscreenCalendarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Events to render. Multiple events can share a day. */
  events?: CalendarEvent[];
  /** Controlled visible month. Pair with `onMonthChange`. */
  month?: Date;
  /** Initial visible month when uncontrolled. Defaults to today. */
  defaultMonth?: Date;
  /** Fired whenever the visible month changes (prev / next / today). */
  onMonthChange?: (month: Date) => void;
  /** Fired when a day cell is clicked, with that day's Date. */
  onDateClick?: (date: Date) => void;
  /** Fired when an event chip is clicked. */
  onEventClick?: (event: CalendarEvent) => void;
  /** First day of the week (0 = Sunday … 1 = Monday). Defaults to 0. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Max event chips shown per day before collapsing to "+N". Defaults to 3. */
  maxChipsPerDay?: number;
}

const WEEKDAYS_FROM_SUNDAY = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

const DAY_KEY_FMT = 'yyyy-MM-dd';

/** Local date-key (no timezone surprises from toISOString's UTC shift). */
function dayKey(date: Date): string {
  return format(date, DAY_KEY_FMT);
}

export const FullscreenCalendar = React.forwardRef<
  HTMLDivElement,
  FullscreenCalendarProps
>(function FullscreenCalendar(
  {
    events = [],
    month: monthProp,
    defaultMonth,
    onMonthChange,
    onDateClick,
    onEventClick,
    weekStartsOn = 0,
    maxChipsPerDay = 3,
    className,
    ...rest
  },
  ref,
) {
  // Controlled when `month` is provided; otherwise track internally.
  const isControlled = monthProp != null;
  const [internalMonth, setInternalMonth] = React.useState<Date>(
    () => defaultMonth ?? new Date(),
  );
  const month = isControlled ? (monthProp as Date) : internalMonth;

  const setMonth = React.useCallback(
    (next: Date) => {
      if (!isControlled) setInternalMonth(next);
      onMonthChange?.(next);
    },
    [isControlled, onMonthChange],
  );

  // The visible 6-week grid (leading + trailing days of adjacent months).
  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn });
    const out: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      out.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return out;
  }, [month, weekStartsOn]);

  // Group events by local day key for O(1) per-cell lookup.
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dayKey(event.date);
      const arr = map.get(key);
      if (arr) arr.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  // Weekday header labels rotated to honour weekStartsOn.
  const weekdayLabels = React.useMemo(
    () =>
      WEEKDAYS_FROM_SUNDAY.map(
        (_, i) => WEEKDAYS_FROM_SUNDAY[(i + weekStartsOn) % 7],
      ),
    [weekStartsOn],
  );

  // Split the flat day list into weeks so each grid row is a role="row".
  const weeks = React.useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);

  const monthLabel = format(month, 'MMMM yyyy');
  const eventCount = events.length;

  const goPrev = React.useCallback(
    () => setMonth(subMonths(month, 1)),
    [month, setMonth],
  );
  const goNext = React.useCallback(
    () => setMonth(addMonths(month, 1)),
    [month, setMonth],
  );
  const goToday = React.useCallback(() => setMonth(new Date()), [setMonth]);

  const cls = ['u-fc', className].filter(Boolean).join(' ');
  const safeMax = Math.max(0, maxChipsPerDay);

  return (
    <div ref={ref} className={cls} {...rest}>
      <header className="u-fc__header">
        <div className="u-fc__heading">
          <h2 className="u-fc__title">{monthLabel}</h2>
          <p className="u-fc__subtitle">
            {eventCount} event{eventCount === 1 ? '' : 's'} this month
          </p>
        </div>

        <div className="u-fc__controls">
          <span className="u-fc__view-label" aria-hidden="true">
            Month
          </span>
          <div className="u-fc__nav" role="group" aria-label="Change month">
            <IconButton
              label="Previous month"
              icon={ChevronLeft}
              variant="outline"
              size="sm"
              className="u-fc__nav-btn"
              onClick={goPrev}
            />
            <Button
              variant="outline"
              size="sm"
              className="u-fc__today-btn"
              onClick={goToday}
            >
              Today
            </Button>
            <IconButton
              label="Next month"
              icon={ChevronRight}
              variant="outline"
              size="sm"
              className="u-fc__nav-btn"
              onClick={goNext}
            />
          </div>
        </div>
      </header>

      <div
        className="u-fc__grid"
        role="grid"
        aria-label={`Calendar, ${monthLabel}`}
      >
        <div className="u-fc__weekdays" role="row">
          {weekdayLabels.map((label) => (
            <div key={label} className="u-fc__weekday" role="columnheader">
              <span className="u-fc__weekday-full">{label}</span>
            </div>
          ))}
        </div>

        <div className="u-fc__weeks">
          {weeks.map((week) => (
            <div key={dayKey(week[0])} className="u-fc__week" role="row">
              {week.map((day) => {
                const inMonth = isSameMonth(day, month);
                const today = isToday(day);
                const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
                const shown = dayEvents.slice(0, safeMax);
                const overflow = dayEvents.length - shown.length;
                const dayNumber = format(day, 'd');
                const ariaDate = format(day, 'd MMMM yyyy');
                const countLabel = dayEvents.length
                  ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
                  : '';

                return (
                  <div className="u-fc__cell" role="gridcell" key={dayKey(day)}>
                    <button
                      type="button"
                      className={[
                        'u-fc__day',
                        !inMonth && 'u-fc__day--outside',
                        today && 'u-fc__day--today',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={`${ariaDate}${countLabel}`}
                      aria-current={today ? 'date' : undefined}
                      onClick={() => onDateClick?.(day)}
                    >
                      <span className="u-fc__date" aria-hidden="true">
                        {dayNumber}
                      </span>
                    </button>

                    {dayEvents.length > 0 ? (
                      <ul className="u-fc__events">
                        {shown.map((event) => (
                          <li key={event.id} className="u-fc__event-item">
                            <button
                              type="button"
                              className="u-fc__event"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(event);
                              }}
                            >
                              <span
                                className="u-fc__event-dot"
                                style={
                                  event.color
                                    ? { background: event.color }
                                    : undefined
                                }
                                aria-hidden="true"
                              />
                              <span className="u-fc__event-title">
                                {event.title}
                              </span>
                            </button>
                          </li>
                        ))}
                        {overflow > 0 ? (
                          <li className="u-fc__event-item">
                            <button
                              type="button"
                              className="u-fc__overflow"
                              aria-label={`Show ${overflow} more event${overflow === 1 ? '' : 's'} on ${ariaDate}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDateClick?.(day);
                              }}
                            >
                              +{overflow} more
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default FullscreenCalendar;
