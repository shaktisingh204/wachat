"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { GripVertical, LoaderCircle } from "lucide-react";

import { Badge, Card, cn, useToast } from "@/components/sabcrm/20ui";
import { handleReschedulePost } from "@/app/actions/facebook.actions";

/**
 * Drag-to-reschedule strip for the Meta Suite calendar.
 *
 * Renders the next 7 days as droppable columns; scheduled posts are draggable
 * chips. Dropping a chip on a day calls `handleReschedulePost` (keeping the
 * original time-of-day). Posts scheduled outside the visible week sit in an
 * "Other" bucket and can be dragged into the week.
 */

export interface ScheduledItem {
  id: string;
  message?: string;
  date: Date;
}

function Chip({ item }: { item: ScheduledItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className="flex items-start gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2"
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab text-[var(--st-text-tertiary)] active:cursor-grabbing"
        {...listeners}
        {...attributes}
        aria-label="Drag to reschedule"
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[11.5px] leading-snug text-[var(--st-text)]">
          {item.message || "Media post"}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--st-text-tertiary)]">{format(item.date, "p")}</p>
      </div>
    </div>
  );
}

function DayColumn({
  id,
  label,
  sub,
  items,
}: {
  id: string;
  label: string;
  sub: string;
  items: ScheduledItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="min-w-[140px] flex-1">
      <div
        className={cn(
          "flex h-full min-h-[150px] flex-col gap-1.5 rounded-[var(--st-radius)] border p-2 transition-colors",
          isOver
            ? "border-[var(--st-accent)] bg-[var(--st-accent-subtle,rgba(43,110,242,0.06))]"
            : "border-[var(--st-border)] bg-[var(--st-bg-secondary)]",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] text-[var(--st-text)]">{label}</span>
          <span className="text-[10px] text-[var(--st-text-tertiary)]">{sub}</span>
        </div>
        {items.map((it) => (
          <Chip key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}

export function RescheduleStrip({
  projectId,
  items,
  onChanged,
}: {
  projectId: string;
  items: ScheduledItem[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => startOfDay(addDays(new Date(), i))),
    [],
  );

  const buckets = useMemo(() => {
    const map = new Map<string, ScheduledItem[]>();
    const other: ScheduledItem[] = [];
    days.forEach((d, i) => map.set(`day-${i}`, []));
    for (const it of items) {
      const idx = days.findIndex((d) => isSameDay(d, it.date));
      if (idx >= 0) map.get(`day-${idx}`)!.push(it);
      else other.push(it);
    }
    return { map, other };
  }, [items, days]);

  const onDragEnd = async (e: DragEndEvent) => {
    const overId = e.over?.id;
    if (typeof overId !== "string" || !overId.startsWith("day-")) return;
    const id = String(e.active.id);
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const dayIdx = Number(overId.slice(4));
    const target = days[dayIdx];
    if (!target || isSameDay(target, item.date)) return;

    const newDate = new Date(target);
    newDate.setHours(item.date.getHours(), item.date.getMinutes(), 0, 0);
    if (newDate.getTime() <= Date.now() + 60_000) {
      toast({ title: "Pick a future time", description: "Scheduled time must be in the future.", variant: "destructive" });
      return;
    }

    setBusy(true);
    const res = await handleReschedulePost(projectId, id, Math.floor(newDate.getTime() / 1000));
    setBusy(false);
    if (res.error) {
      toast({ title: "Could not reschedule", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Rescheduled", description: `Moved to ${format(newDate, "MMM d, p")}.` });
    onChanged();
  };

  if (items.length === 0) return null;

  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-[var(--st-text)]">Drag to reschedule</span>
        <Badge variant="secondary">{items.length} scheduled</Badge>
        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[var(--st-text-tertiary)]" /> : null}
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d, i) => (
            <DayColumn
              key={i}
              id={`day-${i}`}
              label={i === 0 ? "Today" : format(d, "EEE")}
              sub={format(d, "MMM d")}
              items={buckets.map.get(`day-${i}`) ?? []}
            />
          ))}
        </div>
        {buckets.other.length > 0 ? (
          <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-2">
            <p className="mb-1.5 text-[10.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
              Outside this week. Drag into a day above
            </p>
            <div className="flex flex-wrap gap-2">
              {buckets.other.map((it) => (
                <div key={it.id} className="w-[160px]">
                  <Chip item={it} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </DndContext>
    </Card>
  );
}
