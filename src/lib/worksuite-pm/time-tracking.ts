/**
 * Time tracking — timer start/stop, idle detection, billable accounting.
 *
 * Idle policy: any continuous gap of >=30 minutes between a heartbeat
 * and the previous one is treated as idle and deducted from the entry
 * duration. The entry retains the deduction in `idleMinutes` so it can
 * be audited.
 */
import type { ID, TimeEntry } from './types';

export const IDLE_THRESHOLD_MINUTES = 30;

export interface StartTimerInput {
  userId: ID;
  projectId: ID;
  taskId?: ID;
  memberId: ID;
  billable?: boolean;
  hourlyRate?: number;
  notes?: string;
  startedAt?: string;
}

const newId = (): ID =>
  'te_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function startTimer(input: StartTimerInput): TimeEntry {
  const now = input.startedAt ?? new Date().toISOString();
  return {
    id: newId(),
    userId: input.userId,
    projectId: input.projectId,
    taskId: input.taskId,
    memberId: input.memberId,
    startedAt: now,
    billable: input.billable ?? true,
    hourlyRate: input.hourlyRate,
    notes: input.notes,
    source: 'timer',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Stop a running timer. `heartbeats` is an optional ordered list of ISO
 * timestamps reported by the client — used to detect idle gaps.
 */
export function stopTimer(
  entry: TimeEntry,
  endedAt: string = new Date().toISOString(),
  heartbeats: string[] = [],
): TimeEntry {
  if (entry.endedAt) return entry;
  const start = Date.parse(entry.startedAt);
  const end = Date.parse(endedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    throw new Error('stopTimer: invalid time range');
  }
  const totalMinutes = (end - start) / 60000;
  const idle = computeIdleMinutes([entry.startedAt, ...heartbeats, endedAt]);
  const duration = Math.max(0, Math.round(totalMinutes - idle));
  return {
    ...entry,
    endedAt,
    durationMinutes: duration,
    idleMinutes: Math.round(idle),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sum gaps between successive timestamps that exceed the idle
 * threshold. Returns total *idle* minutes.
 */
export function computeIdleMinutes(
  timestamps: string[],
  thresholdMinutes = IDLE_THRESHOLD_MINUTES,
): number {
  let idle = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const a = Date.parse(timestamps[i - 1]);
    const b = Date.parse(timestamps[i]);
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    const gap = (b - a) / 60000;
    if (gap >= thresholdMinutes) idle += gap;
  }
  return idle;
}

export interface BillableSummary {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  amount: number;
  currency?: string;
}

export function summarise(
  entries: TimeEntry[],
  fallbackHourlyRate?: number,
  currency?: string,
): BillableSummary {
  let total = 0;
  let billable = 0;
  let amount = 0;
  for (const e of entries) {
    const m = e.durationMinutes ?? 0;
    total += m;
    if (e.billable) {
      billable += m;
      const rate = e.hourlyRate ?? fallbackHourlyRate ?? 0;
      amount += (m / 60) * rate;
    }
  }
  return {
    totalMinutes: total,
    billableMinutes: billable,
    nonBillableMinutes: total - billable,
    amount: Math.round(amount * 100) / 100,
    currency,
  };
}

/** Convenience: hours from a TimeEntry (null if still running). */
export function entryHours(entry: TimeEntry): number | null {
  if (entry.durationMinutes == null) return null;
  return entry.durationMinutes / 60;
}
