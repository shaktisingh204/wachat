/**
 * Pure helpers + shared types for the scheduled-sends page.
 *
 * Lives in its own module (no `"use server"`) so:
 *  • `actions.ts` can re-export the types it operates on,
 *  • The unit test in `__tests__/scheduled.test.ts` can load these
 *    helpers without dragging Mongo into the boot graph,
 *  • Client components can import the type definitions directly.
 */

export type ScheduledKind = "campaign" | "drip" | "test";

export interface ScheduledSend {
  id: string;
  workspaceId: string;
  kind: ScheduledKind;
  name: string;
  /** ISO timestamp — when the send fires. */
  sendAt: string;
  /** Recipient timezone, IANA. Drives the per-recipient TZ badge. */
  recipientTz?: string;
  /** Recipient country (ISO-3166 alpha-2 or region). */
  country?: string;
  templateId?: string;
  campaignId?: string;
  senderId: string;
  recipientCount: number;
  status: "scheduled" | "queued" | "cancelled";
  /** Optional 5-field cron expression — only present for recurring. */
  cron?: string;
  /** Optional quiet-hours [startHour, endHour) in 24h, recipient TZ. */
  quietHours?: { start: number; end: number };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HolidayEntry {
  date: string; // YYYY-MM-DD
  region: "US" | "IN" | "EU" | "UK";
  label: string;
}

/**
 * Render a 5-field cron expression as English. Handles the common cases
 * used by SabSMS schedules — daily, weekday-only, weekly, monthly.
 * Falls back to the raw expression for everything else (kept honest
 * rather than mis-translating exotic patterns).
 */
export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  // Only render English when min + hour are plain integers — anything
  // exotic (steps, ranges, lists) gets passed through verbatim to keep
  // us honest.
  if (!/^[0-9]+$/.test(min) || !/^[0-9]+$/.test(hour)) return cron;
  const time = formatHHMM(hour, min);

  const dowMap = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  if (dom === "*" && mon === "*" && dow === "*") {
    return `Every day at ${time}`;
  }
  if (dom === "*" && mon === "*" && dow === "1-5") {
    return `Every weekday at ${time}`;
  }
  if (dom === "*" && mon === "*" && /^[0-6]$/.test(dow)) {
    return `Every ${dowMap[Number(dow)]} at ${time}`;
  }
  if (/^[0-9]+$/.test(dom) && mon === "*" && dow === "*") {
    return `On the ${ordinal(Number(dom))} of every month at ${time}`;
  }
  if (dom === "*" && /^[0-9]+$/.test(mon) && dow === "*") {
    return `Every ${monthName(Number(mon))} at ${time}`;
  }
  return cron;
}

function formatHHMM(hour: string, min: string): string {
  if (!/^[0-9]+$/.test(hour) || !/^[0-9]+$/.test(min)) {
    return `${hour}:${min}`;
  }
  const h = Number(hour);
  const m = Number(min);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${h12}${suffix}`
    : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function monthName(m: number): string {
  return (
    [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ][m - 1] ?? `month-${m}`
  );
}

/**
 * Detect sends scheduled inside the recipient's quiet hours. Quiet hours
 * are expressed as a half-open window `[start, end)` in the recipient's
 * local timezone, e.g. {start:21,end:8} ⇒ 9pm through 8am. We approximate
 * the local hour via the IANA tz string when present; absent that, we
 * trust the UTC timestamp as a fallback.
 */
export function detectQuietHourConflicts(
  sends: ScheduledSend[],
): Array<{ sendId: string; recipientHour: number }> {
  const out: Array<{ sendId: string; recipientHour: number }> = [];
  for (const s of sends) {
    if (!s.quietHours) continue;
    const hourLocal = approxRecipientHour(s.sendAt, s.recipientTz);
    const { start, end } = s.quietHours;
    const inWindow =
      start === end
        ? false
        : start < end
          ? hourLocal >= start && hourLocal < end
          : hourLocal >= start || hourLocal < end; // wraps midnight
    if (inWindow) out.push({ sendId: s.id, recipientHour: hourLocal });
  }
  return out;
}

export function approxRecipientHour(iso: string, tz?: string): number {
  const d = new Date(iso);
  if (!tz) return d.getUTCHours();
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    });
    return Number(fmt.format(d));
  } catch {
    return d.getUTCHours();
  }
}

/**
 * Detect cross-campaign conflicts — two scheduled sends from the same
 * sender within the same hour bucket. Returns pairs (a, b…) of send IDs.
 */
export function detectCrossCampaignConflicts(
  sends: ScheduledSend[],
): Array<{ a: string; b: string; sender: string; hourBucket: string }> {
  const byKey = new Map<string, ScheduledSend[]>();
  for (const s of sends) {
    const d = new Date(s.sendAt);
    const bucket = `${d.toISOString().slice(0, 13)}::${s.senderId}`;
    const list = byKey.get(bucket);
    if (list) list.push(s);
    else byKey.set(bucket, [s]);
  }
  const conflicts: Array<{
    a: string;
    b: string;
    sender: string;
    hourBucket: string;
  }> = [];
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    for (let i = 1; i < list.length; i++) {
      conflicts.push({
        a: list[0].id,
        b: list[i].id,
        sender: list[0].senderId,
        hourBucket: key,
      });
    }
  }
  return conflicts;
}

/**
 * Slot capacity per sender per hour bucket. Returns the message count
 * already scheduled — the UI uses this to warn when the bucket is
 * close to the sender's TPS × 3600 ceiling.
 */
export function computeSlotCapacity(
  sends: ScheduledSend[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sends) {
    const bucket = `${s.senderId}::${s.sendAt.slice(0, 13)}`;
    map.set(bucket, (map.get(bucket) ?? 0) + s.recipientCount);
  }
  return map;
}

/**
 * Holiday calendar source — static array. Phase-1 stub.
 * TODO: swap for a workspace-configurable list once the settings page
 * exposes a "Holiday overlay" editor.
 */
export const HOLIDAYS: HolidayEntry[] = [
  { date: "2026-01-01", region: "US", label: "New Year's Day" },
  { date: "2026-01-26", region: "IN", label: "Republic Day" },
  { date: "2026-05-25", region: "US", label: "Memorial Day" },
  { date: "2026-07-04", region: "US", label: "Independence Day" },
  { date: "2026-08-15", region: "IN", label: "Independence Day" },
  { date: "2026-10-02", region: "IN", label: "Gandhi Jayanti" },
  { date: "2026-11-26", region: "US", label: "Thanksgiving" },
  { date: "2026-12-25", region: "EU", label: "Christmas Day" },
  { date: "2026-12-25", region: "UK", label: "Christmas Day" },
  { date: "2026-12-25", region: "US", label: "Christmas Day" },
  { date: "2026-12-26", region: "UK", label: "Boxing Day" },
];

/**
 * Build the day cells for the calendar grid view. Returns 6 rows × 7
 * columns (= 42 cells), starting on the Sunday on/before the 1st of
 * the month. Cells include the sends that land on that local date.
 */
export interface MonthCell {
  date: Date;
  iso: string; // YYYY-MM-DD
  inMonth: boolean;
  sends: ScheduledSend[];
  holiday?: HolidayEntry;
}

export function buildMonthGrid(
  year: number,
  monthIndex: number,
  sends: ScheduledSend[],
  holidays: HolidayEntry[] = HOLIDAYS,
): MonthCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startWeekday = first.getUTCDay();
  const grid: MonthCell[] = [];
  // Date of the Sunday on/before the 1st.
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - startWeekday);

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const sendsForDay = sends.filter((s) => s.sendAt.slice(0, 10) === iso);
    const holiday = holidays.find((h) => h.date === iso);
    grid.push({
      date: d,
      iso,
      inMonth: d.getUTCMonth() === monthIndex,
      sends: sendsForDay,
      holiday,
    });
  }
  return grid;
}

/**
 * Per-country quiet-hour heatmap — for each (country, hour) bucket,
 * count how many sends land there. Used by feature #17 (the quiet-hour
 * heatmap overlay).
 */
export function buildCountryHourHeatmap(
  sends: ScheduledSend[],
): Map<string, Map<number, number>> {
  const out = new Map<string, Map<number, number>>();
  for (const s of sends) {
    const country = s.country ?? "??";
    const hour = approxRecipientHour(s.sendAt, s.recipientTz);
    const row = out.get(country) ?? new Map<number, number>();
    row.set(hour, (row.get(hour) ?? 0) + 1);
    out.set(country, row);
  }
  return out;
}
