'use client';

/**
 * Events Calendar — Deep calendar template.
 *
 * KPI strip (4): total this month · today · upcoming this week · attendance rate.
 * Filters: search · label color · attendance-mode (online / in-person).
 * View toggle: month · week · day.
 * Export: CSV / XLSX of the events visible in the current range.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

import { Badge, Button, Card, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, useToast } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { downloadCsv, downloadXlsx, type ExportRow } from '@/lib/crm-list-export';
import {
  getEvents,
  getEventAttendees,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsEvent,
  WsEventAttendee,
} from '@/lib/worksuite/knowledge-types';

type ViewMode = 'month' | 'week' | 'day';
type ModeFilter = 'all' | 'online' | 'in-person';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface FilterState {
  search: string;
  color: string;
  mode: ModeFilter;
}

const INITIAL_FILTERS: FilterState = { search: '', color: 'all', mode: 'all' };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string | Date);
  return Number.isFinite(d.getTime()) ? d : null;
}

export default function EventsCalendarPage(): React.JSX.Element {
  const { toast } = useToast();
  const [events, setEvents] = React.useState<(WsEvent & { _id: string })[]>([]);
  const [attendees, setAttendees] = React.useState<Record<string, WsEventAttendee[]>>({});
  const [loading, startTransition] = React.useTransition();
  const [view, setView] = React.useState<ViewMode>('month');
  const [anchor, setAnchor] = React.useState<Date>(() => startOfDay(new Date()));
  const [filters, setFilters] = React.useState<FilterState>(INITIAL_FILTERS);

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      try {
        const list = (await getEvents()) as (WsEvent & { _id: string })[];
        setEvents(list);
        // Pull attendees for events in current month for attendance KPI.
        const inMonth = list.filter((e) => {
          const d = fmtDate(e.start_date_time);
          if (!d) return false;
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });
        const pairs = await Promise.all(
          inMonth.map(async (e) => {
            const a = (await getEventAttendees(e._id)) as WsEventAttendee[];
            return [e._id, a] as const;
          }),
        );
        const map: Record<string, WsEventAttendee[]> = {};
        for (const [id, a] of pairs) map[id] = a;
        setAttendees(map);
      } catch (err) {
        toast({
          title: 'Could not load events',
          description: err instanceof Error ? err.message : 'Unknown',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Apply non-date filters. Returns events that pass search/colour/mode. */
  const filtered = React.useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return events.filter((e) => {
      if (q) {
        const hay = `${e.event_name ?? ''} ${e.where ?? ''} ${e.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.color !== 'all' && (e.label_color ?? '') !== filters.color) return false;
      if (filters.mode === 'online' && !e.online_link) return false;
      if (filters.mode === 'in-person' && e.online_link) return false;
      return true;
    });
  }, [events, filters]);

  /** Compute the visible date range for the current view. */
  const range = React.useMemo(() => {
    if (view === 'day') {
      const start = startOfDay(anchor);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    if (view === 'week') {
      const start = startOfDay(anchor);
      start.setDate(start.getDate() - start.getDay()); // Sunday
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return { start, end };
  }, [view, anchor]);

  /** Map of day-start-ms -> events scheduled on that day, after filtering. */
  const eventsByDayMs = React.useMemo(() => {
    const map = new Map<number, (WsEvent & { _id: string })[]>();
    for (const e of filtered) {
      const d = fmtDate(e.start_date_time);
      if (!d) continue;
      const key = startOfDay(d).getTime();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [filtered]);

  /** KPIs (computed against ALL events, not just current view). */
  const kpis = React.useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const weekStart = startOfDay(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let monthCount = 0;
    let todayCount = 0;
    let upcomingWeek = 0;
    let totalAttendees = 0;
    let confirmed = 0;
    for (const e of events) {
      const d = fmtDate(e.start_date_time);
      if (!d) continue;
      if (d >= monthStart && d < monthEnd) monthCount += 1;
      if (isSameDay(d, today)) todayCount += 1;
      if (d >= now && d < weekEnd) upcomingWeek += 1;
      const att = attendees[e._id] ?? [];
      for (const a of att) {
        totalAttendees += 1;
        if (a.status === 'yes') confirmed += 1;
      }
    }
    const attendanceRate =
      totalAttendees > 0 ? Math.round((confirmed / totalAttendees) * 100) : 0;
    return { monthCount, todayCount, upcomingWeek, attendanceRate, totalAttendees };
  }, [events, attendees]);

  const distinctColors = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.label_color) set.add(e.label_color);
    return Array.from(set).sort();
  }, [events]);

  const goPrev = React.useCallback(() => {
    setAnchor((cur) => {
      const next = new Date(cur);
      if (view === 'day') next.setDate(next.getDate() - 1);
      else if (view === 'week') next.setDate(next.getDate() - 7);
      else next.setMonth(next.getMonth() - 1);
      return next;
    });
  }, [view]);

  const goNext = React.useCallback(() => {
    setAnchor((cur) => {
      const next = new Date(cur);
      if (view === 'day') next.setDate(next.getDate() + 1);
      else if (view === 'week') next.setDate(next.getDate() + 7);
      else next.setMonth(next.getMonth() + 1);
      return next;
    });
  }, [view]);

  const goToday = React.useCallback(() => setAnchor(startOfDay(new Date())), []);

  /** Events that fall within the current visible range, sorted by start. */
  const visibleInRange = React.useMemo(() => {
    return filtered
      .filter((e) => {
        const d = fmtDate(e.start_date_time);
        if (!d) return false;
        return d >= range.start && d < range.end;
      })
      .sort((a, b) => {
        const da = fmtDate(a.start_date_time)?.getTime() ?? 0;
        const db = fmtDate(b.start_date_time)?.getTime() ?? 0;
        return da - db;
      });
  }, [filtered, range]);

  const buildExportRows = React.useCallback((): ExportRow[] => {
    return visibleInRange.map((e) => ({
      Name: e.event_name ?? '',
      Where: e.where ?? '',
      Start: e.start_date_time
        ? new Date(e.start_date_time as string).toISOString()
        : '',
      End: e.end_date_time ? new Date(e.end_date_time as string).toISOString() : '',
      Mode: e.online_link ? 'online' : 'in-person',
      Color: e.label_color ?? '',
      Reminder: e.send_reminder ? 'yes' : 'no',
      Repeat: e.repeat ? 'yes' : 'no',
    }));
  }, [visibleInRange]);

  const headers = ['Name', 'Where', 'Start', 'End', 'Mode', 'Color', 'Reminder', 'Repeat'];
  const stamp = new Date().toISOString().slice(0, 10);
  const exportCsv = React.useCallback(
    () => downloadCsv(`events-${stamp}.csv`, headers, buildExportRows()),
    [buildExportRows, stamp],
  );
  const exportXlsx = React.useCallback(
    () => downloadXlsx(`events-${stamp}.xlsx`, headers, buildExportRows(), 'Events'),
    [buildExportRows, stamp],
  );

  const filtersActive =
    filters.search !== '' || filters.color !== 'all' || filters.mode !== 'all';

  const headerLabel = React.useMemo(() => {
    if (view === 'day') {
      return anchor.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (view === 'week') {
      const end = new Date(range.start);
      end.setDate(end.getDate() + 6);
      return `${range.start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return anchor.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  }, [view, anchor, range]);

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <EntityListShell
        title={headerLabel}
        subtitle="Event calendar with KPIs, filters, and CSV / XLSX export."
        search={{
          value: filters.search,
          onChange: (v) => setFilters((p) => ({ ...p, search: v })),
          placeholder: 'Search events…',
        }}
        viewSwitcher={
          <div className="inline-flex rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-0.5">
            {(['month', 'week', 'day'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={
                  'rounded-[calc(var(--st-radius)-2px)] px-2.5 py-1 text-[12.5px] font-medium capitalize transition-colors ' +
                  (view === v
                    ? 'bg-[var(--st-bg)] text-[var(--st-text)] shadow-[var(--st-shadow-sm)]'
                    : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]')
                }
              >
                {v}
              </button>
            ))}
          </div>
        }
        primaryAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goPrev} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={goNext} aria-label="Next">
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <Button asChild>
              <Link href="/dashboard/crm/workspace/events/new">
                <Plus className="h-4 w-4" /> New event
              </Link>
            </Button>
          </div>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filters.color}
              onValueChange={(v) => setFilters((p) => ({ ...p, color: v }))}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Any colour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any colour</SelectItem>
                {distinctColors.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.mode}
              onValueChange={(v) => setFilters((p) => ({ ...p, mode: v as ModeFilter }))}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any mode</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="in-person">In-person</SelectItem>
              </SelectContent>
            </Select>
            {filtersActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(INITIAL_FILTERS)}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="sm" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={exportXlsx}>
                <Download className="h-3.5 w-3.5" /> XLSX
              </Button>
            </div>
          </div>
        }
        loading={loading && events.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="This month"
              value={kpis.monthCount}
              icon={<CalendarRange className="h-4 w-4" />}
            />
            <StatCard
              label="Today"
              value={kpis.todayCount}
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <StatCard
              label="Upcoming (7d)"
              value={kpis.upcomingWeek}
              icon={<Sparkles className="h-4 w-4" />}
            />
            <StatCard
              label="Attendance rate"
              value={`${kpis.attendanceRate}%`}
              icon={<Check className="h-4 w-4" />}
            />
          </div>

          {view === 'month' ? (
            <MonthGrid anchor={anchor} eventsByDayMs={eventsByDayMs} />
          ) : view === 'week' ? (
            <WeekGrid weekStart={range.start} eventsByDayMs={eventsByDayMs} />
          ) : (
            <DayList day={anchor} events={visibleInRange} />
          )}
        </div>
      </EntityListShell>
    </div>
  );
}

/* ─────────────── Sub-views ─────────────── */

function MonthGrid({
  anchor,
  eventsByDayMs,
}: {
  anchor: Date;
  eventsByDayMs: Map<number, (WsEvent & { _id: string })[]>;
}): React.JSX.Element {
  const year = anchor.getFullYear();
  const monthIdx = anchor.getMonth();
  const firstWeekday = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Card>
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
          if (d === null) {
            return (
              <div
                key={i}
                className="min-h-[88px] rounded-lg border border-transparent bg-[var(--st-bg-muted)] p-1.5"
              />
            );
          }
          const key = new Date(year, monthIdx, d).getTime();
          const dayEvents = eventsByDayMs.get(key) ?? [];
          return (
            <div
              key={i}
              className="min-h-[88px] rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1.5 text-[12px]"
            >
              <div className="mb-1 text-[11px] font-semibold text-[var(--st-text-secondary)]">{d}</div>
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
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekGrid({
  weekStart,
  eventsByDayMs,
}: {
  weekStart: Date;
  eventsByDayMs: Map<number, (WsEvent & { _id: string })[]>;
}): React.JSX.Element {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <Card>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2 min-h-[200px]"
          >
            <div className="mb-2 text-[11.5px] font-semibold text-[var(--st-text-secondary)] uppercase tracking-wide">
              {DAYS[d.getDay()]} {d.getDate()}
            </div>
            <div className="flex flex-col gap-1">
              {(eventsByDayMs.get(d.getTime()) ?? []).map((e) => {
                const time = fmtDate(e.start_date_time);
                return (
                  <Link
                    key={e._id}
                    href={`/dashboard/crm/workspace/events/${e._id}`}
                    className="block rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 px-2 py-1 text-[12px] hover:bg-[var(--st-bg-muted)]"
                  >
                    <div className="truncate font-medium">{e.event_name}</div>
                    <div className="text-[11px] text-[var(--st-text-secondary)]">
                      {time
                        ? time.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DayList({
  day,
  events,
}: {
  day: Date;
  events: (WsEvent & { _id: string })[];
}): React.JSX.Element {
  return (
    <Card>
      <div className="flex flex-col gap-2 p-1">
        <div className="text-[12.5px] font-semibold text-[var(--st-text-secondary)]">
          {day.toLocaleDateString(undefined, { weekday: 'long' })}
        </div>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--st-text-secondary)]">
            No events scheduled for this day.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {events.map((e) => {
              const start = fmtDate(e.start_date_time);
              const end = fmtDate(e.end_date_time);
              return (
                <li key={e._id} className="flex items-center gap-3 py-3">
                  <div className="w-20 shrink-0 text-[12px] font-medium text-[var(--st-text-secondary)]">
                    {start
                      ? start.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                    {end
                      ? ` – ${end.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : ''}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/crm/workspace/events/${e._id}`}
                      className="block truncate text-[13.5px] font-medium hover:underline"
                    >
                      {e.event_name}
                    </Link>
                    {e.where ? (
                      <div className="truncate text-[12px] text-[var(--st-text-secondary)]">
                        {e.where}
                      </div>
                    ) : null}
                  </div>
                  {e.online_link ? (
                    <a
                      href={e.online_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-[var(--st-text)] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Join
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
