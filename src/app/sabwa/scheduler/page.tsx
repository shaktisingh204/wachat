"use client";

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  EmptyState,
  Skeleton,
  Tooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  cn,
} from '@/components/sabcrm/20ui/compat';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
  Repeat,
  Smartphone,
  } from "lucide-react";

/**
 * SabWa — Scheduler Calendar (`/sabwa/scheduler`).
 *
 * Hand-rolled month/week/day calendar — no external calendar lib. Events
 * are draggable between cells; dropping fires `updateScheduledMessage`
 * with the new `scheduledFor`. Clicking an event opens the shared
 * `ScheduleDialog` in edit mode; the "New schedule" button opens it in
 * create mode.
 *
 * Data is fetched via `listScheduledMessages` which returns
 * `{ items: [] }` when the engine has no schedules for the session. When
 * empty, we render the calendar shell with an inline empty state — never
 * placeholder/sample data.
 *
 * Rebuilt on ZoruUI primitives. The month/week/day view picker is rendered
 * as a segmented Button group (no tab UI per the ZoruUI design rules).
 */

import * as React from "react";
import Link from "next/link";

import {
  listScheduledMessages,
  updateScheduledMessage,
} from "@/app/actions/sabwa.actions";
import { useSabwaSession } from "@/lib/sabwa/session-context";
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
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? "";

  const [view, setView] = React.useState<ViewMode>("month");
  const [cursor, setCursor] = React.useState<Date>(() => new Date());
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = React.useState(false);

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
    if (!sessionId) return;
    setLoaded(false);
    try {
      const res = await listScheduledMessages(sessionId);
      if (res.ok && Array.isArray(res.items)) {
        const mapped: CalendarEvent[] = res.items.map(toCalendarEvent);
        setEvents(mapped);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoaded(true);
    }
  }, [sessionId]);

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

  const onCellDrop = (target: Date, dropType: "date" | "time-slot" = "date") =>
    async (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      const id = ev.dataTransfer.getData("text/plain");
      if (!id) return;
      const existing = events.find((e) => e.id === id);
      if (!existing) return;
      const next = new Date(target);
      
      if (dropType === "time-slot") {
        const rect = ev.currentTarget.getBoundingClientRect();
        const offsetY = Math.max(0, ev.clientY - rect.top);
        const height = rect.height || 1;
        let minutes = Math.floor((offsetY / height) * 60);
        minutes = Math.round(minutes / 15) * 15;
        if (minutes >= 60) minutes = 45;
        next.setHours(target.getHours(), minutes, 0, 0);
      } else {
        next.setHours(
          existing.date.getHours(),
          existing.date.getMinutes(),
          0,
          0,
        );
      }

      // Optimistic update
      setEvents((curr) =>
        curr.map((e) => (e.id === id ? { ...e, date: next } : e)),
      );
      try {
        await updateScheduledMessage(id, { scheduledFor: next });
      } catch {
        // Roll back: pull a fresh list.
        void refresh();
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

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview before scheduling messages."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <ZoruTooltipProvider delayDuration={150}>
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        {/* ─── Breadcrumb ──────────────────────────────────────────── */}
        <Breadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Scheduler</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </Breadcrumb>

        {/* ─── Toolbar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zoru-ink">
                Scheduler — Calendar
              </h1>
              <p className="text-sm text-zoru-ink-muted mt-1">
                Drag events to reschedule. Click an event to edit; click a
                day to add.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented view picker — no tab UI per ZoruUI rules */}
            <div
              role="group"
              aria-label="Calendar view"
              className="inline-flex rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-0.5"
            >
              {(["month", "week", "day"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={view === m ? "default" : "ghost"}
                  onClick={() => setView(m)}
                  className="h-7 px-3 text-xs capitalize"
                  aria-pressed={view === m}
                >
                  {m}
                </Button>
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
          className="text-sm font-medium text-zoru-ink-muted"
        >
          {headerLabel}
        </p>

        {/* ─── Body ────────────────────────────────────────────────── */}
        {!loaded && events.length === 0 && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={`scheduler-skeleton-${i}`}
                className="h-[64px] rounded-[var(--zoru-radius-lg)]"
              />
            ))}
          </div>
        )}
        {loaded && view === "month" && (
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
        {loaded && view === "week" && (
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
        {loaded && view === "day" && (
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

        {loaded && events.length === 0 && (
          <EmptyState
            icon={<CalendarClock />}
            title="Calendar is empty"
            description="Schedules you create will appear here. No scheduled messages yet — use the 'New schedule' button to add one."
            action={
              <Button size="md" onClick={() => openCreate(cursor)}>
                <Plus className="mr-1.5 h-4 w-4" />
                New schedule
              </Button>
            }
          />
        )}
      </div>

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initial={dialogInitial}
        defaultDate={defaultDate}
        sessionId={sessionId}
        onSaved={() => void refresh()}
      />
    </ZoruTooltipProvider>
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
    dropType: "date" | "time-slot",
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
    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg overflow-hidden">
      <div className="grid grid-cols-7 border-b border-zoru-line bg-zoru-surface text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
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
              <ZoruTooltipTrigger asChild>
                <div
                  onDragOver={onCellDragOver}
                  onDrop={onCellDrop(d, "date")}
                  onClick={() => onCellClick(d)}
                  className={cn(
                    "group relative min-h-[96px] cursor-pointer border-b border-r border-zoru-line p-1.5 text-xs",
                    !inMonth && "bg-zoru-surface text-zoru-ink-subtle",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium",
                        today &&
                          "bg-zoru-primary text-zoru-primary-foreground",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add schedule on ${d.toDateString()}`}
                      className="rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-zoru-surface-2"
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
                      <div className="text-[10px] text-zoru-ink-muted">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              </ZoruTooltipTrigger>
              {dayEvents.length > 0 && (
                <ZoruTooltipContent side="top">
                  {dayEvents.length} scheduled item
                  {dayEvents.length === 1 ? "" : "s"}
                </ZoruTooltipContent>
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
    dropType: "date" | "time-slot",
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
    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zoru-line bg-zoru-surface text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="px-2 py-1.5 text-center">
            <div>{DAY_LABELS[d.getDay()]}</div>
            <div
              className={cn(
                "mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px]",
                sameDay(d, new Date()) &&
                  "bg-zoru-primary text-zoru-primary-foreground",
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
              <div className="border-b border-r border-zoru-line px-2 py-1 text-right text-[10px] text-zoru-ink-muted">
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
                    onDrop={onCellDrop(slot, "time-slot")}
                    onClick={() => onSlotClick(slot)}
                    className="relative min-h-[40px] cursor-pointer border-b border-r border-zoru-line p-0.5"
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
    dropType: "date" | "time-slot",
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
    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg overflow-hidden">
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
        <div className="grid grid-cols-[80px_1fr]">
          {HOURS.map((h) => {
            const slot = new Date(day);
            slot.setHours(h, 0, 0, 0);
            const slotEvents = events.filter((e) => e.date.getHours() === h);
            return (
              <React.Fragment key={h}>
                <div className="border-b border-r border-zoru-line px-3 py-2 text-right text-[11px] text-zoru-ink-muted">
                  {h.toString().padStart(2, "0")}:00
                </div>
                <div
                  onDragOver={onCellDragOver}
                  onDrop={onCellDrop(slot, "time-slot")}
                  onClick={() => onSlotClick(slot)}
                  className="relative min-h-[48px] cursor-pointer border-b border-zoru-line p-1"
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
  
  const isRecurring = event.raw.recurrence !== "none";
  const tzStr = event.raw.timezone ? ` ${event.raw.timezone.split('/').pop()?.replace(/_/g, ' ')}` : "";

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
        "cursor-grab rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-1.5 py-1 text-[11px] leading-tight text-zoru-ink active:cursor-grabbing hover:bg-zoru-surface-2 transition-colors flex flex-col",
        expanded && "py-1.5",
      )}
      title={`${time}${tzStr} — ${event.body} (${meta.label})`}
    >
      <div className="flex items-center gap-1 w-full overflow-hidden">
        {isRecurring && <Repeat className="h-3 w-3 shrink-0 text-zoru-ink-muted" />}
        <span className="font-medium tabular-nums shrink-0">{time}</span>
        {(!expanded || !event.raw.timezone) && tzStr && (
          <span className="text-zoru-ink-muted shrink-0 text-[10px]">{tzStr}</span>
        )}
        <span className="truncate">{event.body}</span>
      </div>
      {expanded && event.raw.timezone && (
        <div className="text-[10px] text-zoru-ink-subtle mt-0.5 truncate w-full">
          {event.raw.timezone}
        </div>
      )}
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
