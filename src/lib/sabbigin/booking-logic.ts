/**
 * Pure SabBigin decision logic — no DB, no server-only imports — so it is
 * unit/e2e testable in isolation. The server actions import these helpers so
 * the tested logic is the shipped logic.
 */

export interface AvailabilityWindowLite {
  dow: number;
  start: string; // "HH:MM"
  end: string;
}

export interface BookingPageLite {
  durationMin: number;
  bufferMin: number;
  dateRangeDays: number;
  weeklyAvailability: AvailabilityWindowLite[];
}

export interface GeneratedSlot {
  startISO: string;
  label: string;
}
export interface GeneratedDay {
  dateISO: string;
  label: string;
  slots: GeneratedSlot[];
}

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Generate bookable slots for `page`, starting from `now`, excluding instants
 * present in `taken` (a set of ISO strings). Deterministic given its inputs.
 */
export function generateBookingDays(
  page: BookingPageLite,
  now: Date,
  taken: Set<string>,
): GeneratedDay[] {
  const days: GeneratedDay[] = [];
  const step = page.durationMin + page.bufferMin;
  if (step <= 0) return days;

  for (let d = 0; d < page.dateRangeDays; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    day.setHours(0, 0, 0, 0);
    const dow = day.getDay();
    const windows = page.weeklyAvailability.filter((w) => w.dow === dow);
    if (windows.length === 0) continue;

    const slots: GeneratedSlot[] = [];
    for (const w of windows) {
      const startM = hhmmToMinutes(w.start);
      const endM = hhmmToMinutes(w.end);
      for (let m = startM; m + page.durationMin <= endM; m += step) {
        const slot = new Date(day);
        slot.setMinutes(m);
        if (slot.getTime() <= now.getTime()) continue;
        const iso = slot.toISOString();
        if (taken.has(iso)) continue;
        slots.push({
          startISO: iso,
          label: slot.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      }
    }
    if (slots.length) {
      days.push({
        dateISO: day.toISOString(),
        label: day.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
        slots,
      });
    }
  }
  return days;
}

/* ─── Stage-gate logic ─────────────────────────────────────────────── */

export function isBlankValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'number') return v === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Given a deal record, the required field keys for the target stage, and an
 * optional patch the user is supplying, return the keys still blank.
 */
export function missingRequiredFields(
  deal: Record<string, unknown>,
  requiredFields: string[] | undefined,
  patch?: Record<string, unknown>,
): string[] {
  if (!requiredFields?.length) return [];
  return requiredFields.filter((key) => {
    const provided = patch?.[key];
    if (provided !== undefined) return isBlankValue(provided);
    return isBlankValue(deal[key]);
  });
}

/* ─── Connected-pipeline event mapping ─────────────────────────────── */

export type StageEvent = 'enter' | 'won' | 'lost';

export function isWonStageName(stage?: string | null): boolean {
  return /(won|closed won|deal done|complete)/i.test(stage ?? '');
}
export function isLostStageName(stage?: string | null): boolean {
  return /(lost|dead|not serviceable|cancel|closed lost)/i.test(stage ?? '');
}

export function eventForStage(stage: string): StageEvent {
  if (isWonStageName(stage)) return 'won';
  if (isLostStageName(stage)) return 'lost';
  return 'enter';
}

export interface ConnectionLite {
  fromStage: string;
  event: StageEvent;
  active?: boolean;
}

/** Which connections fire when a deal enters `toStage`. */
export function matchingConnections<T extends ConnectionLite>(
  connections: T[],
  toStage: string,
): T[] {
  const event = eventForStage(toStage);
  return connections.filter((c) => {
    if (c.active === false) return false;
    if (c.event !== event) return false;
    if (c.fromStage && c.fromStage !== toStage) return false;
    return true;
  });
}
