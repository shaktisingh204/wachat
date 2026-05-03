/**
 * Resource scheduling — allocations, conflict detection, weekly capacity.
 *
 * Slots are half-open ranges `[start, end)`. Two allocations conflict
 * when they overlap *and* their summed `hoursPerDay` exceeds the
 * resource's daily capacity (default 8h). Capacity utilisation is
 * computed on an ISO-week granularity.
 */
import type { ID, ResourceAllocation } from './types';

export const DEFAULT_DAILY_CAPACITY_HOURS = 8;
export const DEFAULT_WEEKLY_CAPACITY_HOURS = 40;

export interface AllocationSlot {
  start: string;
  end: string;
  hoursPerDay: number;
  projectId?: ID;
  taskId?: ID;
  notes?: string;
}

export interface AllocationResult {
  ok: boolean;
  allocation?: ResourceAllocation;
  conflicts: ResourceAllocation[];
}

const newId = (): ID =>
  'alc_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export interface AllocateOptions {
  userId: ID;
  /** Existing allocations for the same resource. */
  existing: ResourceAllocation[];
  /** Daily capacity ceiling for the resource. */
  dailyCapacityHours?: number;
  /** When true, allocate even with conflicts (returns `ok=false`). */
  force?: boolean;
}

export function allocate(
  resourceId: ID,
  slot: AllocationSlot,
  opts: AllocateOptions,
): AllocationResult {
  validateSlot(slot);
  const cap = opts.dailyCapacityHours ?? DEFAULT_DAILY_CAPACITY_HOURS;
  const overlapping = opts.existing.filter(
    (a) => a.resourceId === resourceId && rangesOverlap(a, slot),
  );
  const conflicts: ResourceAllocation[] = [];
  for (const a of overlapping) {
    if (a.hoursPerDay + slot.hoursPerDay > cap) conflicts.push(a);
  }
  if (conflicts.length && !opts.force) {
    return { ok: false, conflicts };
  }
  const allocation: ResourceAllocation = {
    id: newId(),
    userId: opts.userId,
    resourceId,
    projectId: slot.projectId,
    taskId: slot.taskId,
    start: slot.start,
    end: slot.end,
    hoursPerDay: slot.hoursPerDay,
    notes: slot.notes,
    createdAt: new Date().toISOString(),
  };
  return { ok: conflicts.length === 0, allocation, conflicts };
}

export function detectConflicts(
  allocations: ResourceAllocation[],
  dailyCapacityHours = DEFAULT_DAILY_CAPACITY_HOURS,
): Array<{ a: ResourceAllocation; b: ResourceAllocation }> {
  const out: Array<{ a: ResourceAllocation; b: ResourceAllocation }> = [];
  // Group by resource for efficiency.
  const byRes = new Map<ID, ResourceAllocation[]>();
  for (const a of allocations) {
    const list = byRes.get(a.resourceId) ?? [];
    list.push(a);
    byRes.set(a.resourceId, list);
  }
  for (const list of byRes.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (
          rangesOverlap(list[i], list[j]) &&
          list[i].hoursPerDay + list[j].hoursPerDay > dailyCapacityHours
        ) {
          out.push({ a: list[i], b: list[j] });
        }
      }
    }
  }
  return out;
}

export interface WeeklyUtilisation {
  /** ISO week key, e.g. `2026-W17`. */
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  hoursAllocated: number;
  capacityHours: number;
  utilisationPct: number;
}

export function utilisationByWeek(
  allocations: ResourceAllocation[],
  resourceId: ID,
  range: { start: string; end: string },
  weeklyCapacityHours = DEFAULT_WEEKLY_CAPACITY_HOURS,
): WeeklyUtilisation[] {
  const out: WeeklyUtilisation[] = [];
  const weeks = enumerateWeeks(range.start, range.end);
  const mine = allocations.filter((a) => a.resourceId === resourceId);
  for (const w of weeks) {
    let hours = 0;
    for (const a of mine) {
      const overlapDays = workingDayOverlap(a, w.weekStart, w.weekEnd);
      hours += overlapDays * a.hoursPerDay;
    }
    out.push({
      weekKey: w.weekKey,
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      hoursAllocated: round2(hours),
      capacityHours: weeklyCapacityHours,
      utilisationPct:
        weeklyCapacityHours > 0
          ? round2((hours / weeklyCapacityHours) * 100)
          : 0,
    });
  }
  return out;
}

/* ───────────── helpers ───────────── */

interface Range {
  start: string;
  end: string;
}

function validateSlot(slot: AllocationSlot): void {
  if (
    Number.isNaN(Date.parse(slot.start)) ||
    Number.isNaN(Date.parse(slot.end)) ||
    Date.parse(slot.end) <= Date.parse(slot.start)
  ) {
    throw new Error('allocate: invalid slot range');
  }
  if (slot.hoursPerDay <= 0) {
    throw new Error('allocate: hoursPerDay must be > 0');
  }
}

function rangesOverlap(a: Range, b: Range): boolean {
  const aS = Date.parse(a.start);
  const aE = Date.parse(a.end);
  const bS = Date.parse(b.start);
  const bE = Date.parse(b.end);
  return aS < bE && bS < aE;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function workingDayOverlap(
  alloc: Range,
  weekStart: string,
  weekEnd: string,
): number {
  const aS = Date.parse(alloc.start);
  const aE = Date.parse(alloc.end);
  const wS = Date.parse(weekStart);
  const wE = Date.parse(weekEnd);
  const overlapStart = Math.max(aS, wS);
  const overlapEnd = Math.min(aE, wE);
  if (overlapEnd <= overlapStart) return 0;
  // Count Mon-Fri days within overlap window.
  let days = 0;
  for (let t = overlapStart; t < overlapEnd; t += MS_PER_DAY) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

function enumerateWeeks(
  start: string,
  end: string,
): Array<{ weekKey: string; weekStart: string; weekEnd: string }> {
  const out: Array<{ weekKey: string; weekStart: string; weekEnd: string }> =
    [];
  let cursor = mondayUTC(new Date(start));
  const endMs = Date.parse(end);
  while (cursor.getTime() < endMs) {
    const ws = new Date(cursor);
    const we = new Date(cursor.getTime() + 7 * MS_PER_DAY);
    out.push({
      weekKey: isoWeekKey(ws),
      weekStart: ws.toISOString(),
      weekEnd: we.toISOString(),
    });
    cursor = we;
  }
  return out;
}

function mondayUTC(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // 0 = Monday
  const m = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff),
  );
  return m;
}

function isoWeekKey(d: Date): string {
  // ISO week algorithm.
  const tmp = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7,
  );
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
