'use client';

import { Button, Card, Badge } from '@/components/sabcrm/20ui/compat';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

/**
 * Month-grid calendar view embedded into the events list page (§1D.4).
 * Replaces the standalone /events/calendar page when toggled on.
 *
 * - Month/prev/next navigation.
 * - Click an empty cell → opens /new prefilled with that date.
 * - Click an event chip → /events/[id].
 */

import * as React from 'react';
import Link from 'next/link';

import { toDate } from './events-shared';
import type { WsEvent } from '@/lib/worksuite/knowledge-types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface EventsCalendarProps {
    events: (WsEvent & { _id: string })[];
}

export function EventsCalendar({ events }: EventsCalendarProps): React.JSX.Element {
    const [month, setMonth] = React.useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const year = month.getFullYear();
    const monthIdx = month.getMonth();
    const firstWeekday = new Date(year, monthIdx, 1).getDay();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    const cells: (number | null)[] = React.useMemo(() => {
        const xs: (number | null)[] = [];
        for (let i = 0; i < firstWeekday; i++) xs.push(null);
        for (let d = 1; d <= daysInMonth; d++) xs.push(d);
        while (xs.length % 7 !== 0) xs.push(null);
        return xs;
    }, [firstWeekday, daysInMonth]);

    const eventsByDay = React.useMemo(() => {
        const map = new Map<number, (WsEvent & { _id: string })[]>();
        for (const e of events) {
            const d = toDate(e.start_date_time);
            if (!d) continue;
            if (d.getFullYear() === year && d.getMonth() === monthIdx) {
                const day = d.getDate();
                const list = map.get(day) ?? [];
                list.push(e);
                map.set(day, list);
            }
        }
        return map;
    }, [events, year, monthIdx]);

    const prev = React.useCallback(
        () => setMonth(new Date(year, monthIdx - 1, 1)),
        [year, monthIdx],
    );
    const next = React.useCallback(
        () => setMonth(new Date(year, monthIdx + 1, 1)),
        [year, monthIdx],
    );
    const goToday = React.useCallback(() => {
        const d = new Date();
        setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }, []);

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx;

    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Card>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--st-text)]">
                        <CalendarDays className="h-4 w-4" />
                        Loading calendar...
                    </h3>
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {DAYS.map((d) => (
                        <div
                            key={d}
                            className="py-2 text-center text-[11.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]"
                        >
                            {d}
                        </div>
                    ))}
                    {Array.from({ length: 35 }).map((_, i) => (
                        <div
                            key={i}
                            className="min-h-[88px] rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-1.5"
                        />
                    ))}
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--st-text)]">
                    <CalendarDays className="h-4 w-4" />
                    {month.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                </h3>
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={goToday}>
                        Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={prev} aria-label="Previous month">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={next} aria-label="Next month">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
                {DAYS.map((d) => (
                    <div
                        key={d}
                        className="py-2 text-center text-[11.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]"
                    >
                        {d}
                    </div>
                ))}
                {cells.map((d, i) => {
                    const dayEvents = d ? eventsByDay.get(d) ?? [] : [];
                    const isToday = isCurrentMonth && d === today.getDate();
                    const newHref = d
                        ? `/dashboard/crm/workspace/events/new?date=${new Date(year, monthIdx, d)
                              .toISOString()
                              .slice(0, 10)}`
                        : '';
                    return (
                        <div
                            key={i}
                            className={[
                                'min-h-[88px] rounded-md border p-1.5 text-[12px]',
                                d
                                    ? 'bg-[var(--st-bg)] border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                                    : 'bg-[var(--st-bg-muted)] border-transparent',
                                isToday ? 'ring-1 ring-[var(--st-text)]' : '',
                            ].join(' ')}
                        >
                            {d ? (
                                <>
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-[var(--st-text-secondary)]">{d}</span>
                                        <Link
                                            href={newHref}
                                            className="text-[10.5px] text-[var(--st-text-secondary)] hover:underline"
                                            aria-label={`Create event on ${year}-${monthIdx + 1}-${d}`}
                                        >
                                            +
                                        </Link>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        {dayEvents.slice(0, 3).map((e) => (
                                            <Link
                                                key={e._id}
                                                href={`/dashboard/crm/workspace/events/${e._id}`}
                                                className="truncate"
                                            >
                                                <Badge variant="ghost" className="w-full justify-start truncate">
                                                    {e.event_name}
                                                </Badge>
                                            </Link>
                                        ))}
                                        {dayEvents.length > 3 ? (
                                            <span className="text-[10.5px] text-[var(--st-text-secondary)]">
                                                +{dayEvents.length - 3} more
                                            </span>
                                        ) : null}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

export default EventsCalendar;
