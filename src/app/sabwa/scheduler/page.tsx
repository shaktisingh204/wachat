"use client";

/**
 * SabWa — Scheduler Calendar (`/sabwa/scheduler`).
 *
 * Hand-rolled month/week/day calendar — no external calendar lib. Events
 * are draggable between cells; dropping fires `updateScheduledMessage`
 * with the new `scheduledFor`. Clicking an event opens the shared
 * `ScheduleDialog` in edit mode; the "New schedule" button opens it in
 * create mode.
 *
 * Phase 1: data is fetched via `listScheduledMessages`, which is still a
 * stub that throws "not implemented". We fall back to a small, clearly
 * marked sample set so the UI is meaningful in dev — the moment the
 * action lands, the sample disappears.
 */

import * as React from "react";
import Link from "next/link";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  listScheduledMessages,
  updateScheduledMessage,
} from "@/app/actions/sabwa.actions";
import type {
  SabwaScheduled,
  SabwaScheduledTargetType,
} from "@/lib/sabwa/types";

import {
  ScheduleDialog,
  targetTypeMeta,
  type ScheduleDialogInitial,
} from "./_components/schedule-dialog";

type ViewMode = "month" | "week" | "day";

interface CalendarEvent {
  id: string;
  date: Date;
  body: string;
  primaryTargetType: SabwaScheduledTargetType;
  raw: ScheduleDialogInitial;
}

// ─── Sample fallback (replaced by listScheduledMessages once wired) ─────────

function buildSampleEvents(anchor: Date): CalendarEvent[] {
  const at = (dayOffset: number, hour: number, minute: number): Date => {
    const d = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate(),
    );
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  return [
    {
      id: "sample-1",
      date: at(1, 9, 0),
      body: "Daily standup nudge",
      primaryTargetType: "group",
      raw: { body: "Daily standup nudge" },
    },
    {
      id: "sample-2",
      date: at(2, 14, 30),
      body: "Promo blast — weekend sale",
      primaryTargetType: "broadcast",
      raw: { body: "Promo blast — weekend sale" },
    },
    {
      id: "sample-3",
      date: at(0, 18, 0),
      body: "Personal check-in",
      primaryTargetType: "individual",
      raw: { body: "Personal check-in" },
    },
  ];
}

// ─── Date helpers ───────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfMonthGrid(d: Date): Date {
  const first = startOfMonth(d);
  const day = first.getDay();
  return new Date(first.getFullYear(), first.getMonth(), 1 - day);
}
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isoForCellId(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SchedulerCalendarPage() {
  const [view, setView] = React.useState<ViewMode>("month");
  const [cursor, setCursor] = React.useState<Date>(() => new Date());
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [usingSample, setUsingSample] = React.useState(false);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">(
    "create",
  );
  const [dialogInitial, setDialogInitial] = React.useState<
    ScheduleDialogInitial | undefined
  >();
  const [defaultDate, setDefaultDate] = React.useState<Date | undefined>();

  // ─ Data fetch ──────────────────────────────────────────────────────────
  const refresh = React.useCallback(async () => {
    setLoaded(false);
    try {
      // Phase 1: no session id available yet — passing empty string surfaces
      // the canonical "not implemented" error from the stub.
      const res = await listScheduledMessages("");
      if (res.ok && Array.isArray(res.items)) {
        const mapped: CalendarEvent[] = res.items.map(toCalendarEvent);
        setEvents(mapped);
        setUsingSample(false);
      } else {
        setEvents(buildSampleEvents(new Date()));
        setUsingSample(true);
      }
    } catch {
      setEvents(buildSampleEvents(new Date()));
      setUsingSample(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // ─ Range helpers ──────────────────────────────────────────────────────
  const monthGridStart = React.useMemo(
    () => startOfMonthGrid(cursor),
    [cursor],
  );
  const weekStart = React.useMemo(() => startOfWeek(cursor), [cursor]);
  const dayStart = React.useMemo(() => startOfDay(cursor), [cursor]);

  const eventsByDay = React.useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = isoForCellId(e.date);
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    return m;
  }, [events]);

  // ─ Drag and drop ──────────────────────────────────────────────────────
  const onEventDragStart = (id: string) =>
    (ev: React.DragEvent<HTMLDivElement>) => {
      ev.dataTransfer.setData("text/plain", id);
      ev.dataTransfer.effectAllowed = "move";
    };

  const onCellDragOver = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
  };

  const onCellDrop = (target: Date) =>
    async (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      const id = ev.dataTransfer.getData("text/plain");
      if (!id) return;
      const existing = events.find((e) => e.id === id);
      if (!existing) return;
      const next = new Date(target);
      next.setHours(
        existing.date.getHours(),
        existing.date.getMinutes(),
        0,
        0,
      );
      // Optimistic update
      setEvents((curr) =>
        curr.map((e) => (e.id === id ? { ...e, date: next } : e)),
      );
      if (!usingSample) {
        try {
          await updateScheduledMessage(id, { scheduledFor: next });
        } catch {
          // Roll back: pull a fresh list.
          void refresh();
        }
      }
    };

  // ─ Dialog plumbing ────────────────────────────────────────────────────
  const openCreate = (when?: Date) => {
    setDialogMode("create");
    setDialogInitial(undefined);
    setDefaultDate(when);
    setDialogOpen(true);
  };
  const openEdit = (e: CalendarEvent) => {
    setDialogMode("edit");
    setDialogInitial({
      ...e.raw,
      scheduledId: e.id,
      scheduledFor: e.date,
      body: e.body,
      targets: e.raw.targets,
    });
    setDefaultDate(undefined);
    setDialogOpen(true);
  };

  // ─ View nav ───────────────────────────────────────────────────────────
  const onPrev = () => {
    if (view === "month")
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    else if (view === "week") setCursor(addDays(cursor, -7));
    else setCursor(addDays(cursor, -1));
  };
  const onNext = () => {
    if (view === "month")
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    else if (view === "week") setCursor(addDays(cursor, 7));
    else setCursor(addDays(cursor, 1));
  };

  const headerLabel =
    view === "month"
      ? monthLabel(cursor)
      : view === "week"
        ? `Week of ${weekStart.toLocaleDateString()}`
        : dayStart.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        {/* ─── Toolbar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-secondary p-3">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Scheduler — Calendar
                </h1>
                {usingSample && loaded && (
                  <Badge variant="secondary">Sample data</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Drag events to reschedule. Click an event to edit; click a
                day to add.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
              {(["month", "week", "day"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setView(m)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs capitalize",
                    view === m
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={onPrev}
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCursor(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onNext}
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/sabwa/scheduler/queue">
                <ListChecks className="mr-1.5 h-4 w-4" />
                Queue
              </Link>
            </Button>
            <Button size="sm" onClick={() => openCreate(cursor)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New schedule
            </Button>
          </div>
        </div>

        <p
          aria-live="polite"
          className="text-sm font-medium text-muted-foreground"
        >
          {headerLabel}
        </p>

        {/* ─── Body ────────────────────────────────────────────────── */}
        {view === "month" && (
          <MonthGrid
            gridStart={monthGridStart}
            cursor={cursor}
            eventsByDay={eventsByDay}
            onCellDragOver={onCellDragOver}
            onCellDrop={onCellDrop}
            onEventDragStart={onEventDragStart}
            onEventClick={openEdit}
            onCellClick={(d) => {
              setCursor(d);
              setView("day");
            }}
            onAddInCell={(d) => openCreate(d)}
          />
        )}
        {view === "week" && (
          <WeekGrid
            weekStart={weekStart}
            events={events}
            onCellDragOver={onCellDragOver}
            onCellDrop={onCellDrop}
            onEventDragStart={onEventDragStart}
            onEventClick={openEdit}
            onSlotClick={(d) => openCreate(d)}
          />
        )}
        {view === "day" && (
          <DayGrid
            day={dayStart}
            events={events.filter((e) => sameDay(e.date, dayStart))}
            onCellDragOver={onCellDragOver}
            onCellDrop={onCellDrop}
            onEventDragStart={onEventDragStart}
            onEventClick={openEdit}
            onSlotClick={(d) => openCreate(d)}
          />
        )}
      </div>

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={dialogInitial}
        defaultDate={defaultDate}
        onSaved={() => void refresh()}
      />
    </TooltipProvider>
  );
}

// ─── Month grid ─────────────────────────────────────────────────────────────

interface MonthGridProps {
  gridStart: Date;
  cursor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onCellDragOver: (ev: React.DragEvent<HTMLDivElement>) => void;
  onCellDrop: (
    target: Date,
  ) => (ev: React.DragEvent<HTMLDivElement>) => void | Promise<void>;
  onEventDragStart: (
    id: string,
  ) => (ev: React.DragEvent<HTMLDivElement>) => void;
  onEventClick: (e: CalendarEvent) => void;
  onCellClick: (d: Date) => void;
  onAddInCell: (d: Date) => void;
}

function MonthGrid({
  gridStart,
  cursor,
  eventsByDay,
  onCellDragOver,
  onCellDrop,
  onEventDragStart,
  onEventClick,
  onCellClick,
  onAddInCell,
}: MonthGridProps) {
  const cells = React.useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [gridStart]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {DAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((d) => {
          const key = isoForCellId(d);
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = d.getMonth() === cursor.getMonth();
          const today = sameDay(d, new Date());
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <div
                  onDragOver={onCellDragOver}
                  onDrop={onCellDrop(d)}
                  onClick={() => onCellClick(d)}
                  className={cn(
                    "group relative min-h-[96px] cursor-pointer border-b border-r p-1.5 text-xs",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium",
                        today &&
                          "bg-primary text-primary-foreground",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add schedule on ${d.toDateString()}`}
                      className="rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-foreground/10"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onAddInCell(d);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <EventChip
                        key={e.id}
                        event={e}
                        onDragStart={onEventDragStart(e.id)}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onEventClick(e);
                        }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              {dayEvents.length > 0 && (
                <TooltipContent side="top">
                  {dayEvents.length} scheduled item
                  {dayEvents.length === 1 ? "" : "s"}
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week grid ──────────────────────────────────────────────────────────────

interface WeekGridProps {
  weekStart: Date;
  events: CalendarEvent[];
  onCellDragOver: (ev: React.DragEvent<HTMLDivElement>) => void;
  onCellDrop: (
    target: Date,
  ) => (ev: React.DragEvent<HTMLDivElement>) => void | Promise<void>;
  onEventDragStart: (
    id: string,
  ) => (ev: React.DragEvent<HTMLDivElement>) => void;
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (d: Date) => void;
}

function WeekGrid({
  weekStart,
  events,
  onCellDragOver,
  onCellDrop,
  onEventDragStart,
  onEventClick,
  onSlotClick,
}: WeekGridProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="px-2 py-1.5 text-center">
            <div>{DAY_LABELS[d.getDay()]}</div>
            <div
              className={cn(
                "mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px]",
                sameDay(d, new Date()) &&
                  "bg-primary text-primary-foreground",
              )}
            >
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {HOURS.map((h) => (
            <React.Fragment key={h}>
              <div className="border-b border-r px-2 py-1 text-right text-[10px] text-muted-foreground">
                {h.toString().padStart(2, "0")}:00
              </div>
              {days.map((d) => {
                const slot = new Date(d);
                slot.setHours(h, 0, 0, 0);
                const slotEvents = events.filter(
                  (e) =>
                    sameDay(e.date, d) && e.date.getHours() === h,
                );
                return (
                  <div
                    key={`${d.toISOString()}-${h}`}
                    onDragOver={onCellDragOver}
                    onDrop={onCellDrop(slot)}
                    onClick={() => onSlotClick(slot)}
                    className="relative min-h-[40px] cursor-pointer border-b border-r p-0.5"
                  >
                    {slotEvents.map((e) => (
                      <EventChip
                        key={e.id}
                        event={e}
                        onDragStart={onEventDragStart(e.id)}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onEventClick(e);
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Day grid ───────────────────────────────────────────────────────────────

interface DayGridProps {
  day: Date;
  events: CalendarEvent[];
  onCellDragOver: (ev: React.DragEvent<HTMLDivElement>) => void;
  onCellDrop: (
    target: Date,
  ) => (ev: React.DragEvent<HTMLDivElement>) => void | Promise<void>;
  onEventDragStart: (
    id: string,
  ) => (ev: React.DragEvent<HTMLDivElement>) => void;
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (d: Date) => void;
}

function DayGrid({
  day,
  events,
  onCellDragOver,
  onCellDrop,
  onEventDragStart,
  onEventClick,
  onSlotClick,
}: DayGridProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
        <div className="grid grid-cols-[80px_1fr]">
          {HOURS.map((h) => {
            const slot = new Date(day);
            slot.setHours(h, 0, 0, 0);
            const slotEvents = events.filter((e) => e.date.getHours() === h);
            return (
              <React.Fragment key={h}>
                <div className="border-b border-r px-3 py-2 text-right text-[11px] text-muted-foreground">
                  {h.toString().padStart(2, "0")}:00
                </div>
                <div
                  onDragOver={onCellDragOver}
                  onDrop={onCellDrop(slot)}
                  onClick={() => onSlotClick(slot)}
                  className="relative min-h-[48px] cursor-pointer border-b p-1"
                >
                  {slotEvents.map((e) => (
                    <EventChip
                      key={e.id}
                      event={e}
                      onDragStart={onEventDragStart(e.id)}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      expanded
                    />
                  ))}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Event chip ─────────────────────────────────────────────────────────────

function EventChip({
  event,
  onDragStart,
  onClick,
  expanded,
}: {
  event: CalendarEvent;
  onDragStart: (ev: React.DragEvent<HTMLDivElement>) => void;
  onClick: (ev: React.MouseEvent<HTMLDivElement>) => void;
  expanded?: boolean;
}) {
  const meta = targetTypeMeta(event.primaryTargetType);
  const time = event.date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      className={cn(
        "cursor-grab rounded px-1.5 py-1 text-[11px] leading-tight active:cursor-grabbing",
        meta.className,
        expanded && "py-1.5",
      )}
      title={`${time} — ${event.body}`}
    >
      <div className="flex items-center gap-1 truncate">
        <span className="font-medium tabular-nums">{time}</span>
        <span className="truncate">{event.body}</span>
      </div>
    </div>
  );
}

// ─── Mapper ─────────────────────────────────────────────────────────────────

function toCalendarEvent(item: SabwaScheduled): CalendarEvent {
  const date = new Date(item.scheduledFor);
  const firstTarget = item.targets?.[0];
  const primaryTargetType: SabwaScheduledTargetType =
    firstTarget?.type ?? "individual";
  return {
    id: String(item._id),
    date,
    body: item.payload?.body || item.payload?.caption || "(no preview)",
    primaryTargetType,
    raw: {
      scheduledId: String(item._id),
      sessionId: String(item.sessionId),
      targets: item.targets,
      body: item.payload?.body,
      mediaSabFileId: item.payload?.mediaSabFileId,
      scheduledFor: date,
      timezone: item.timezone,
      recurrence: item.kind === "recurring" ? "custom" : "none",
      cron: item.cron,
    },
  };
}
