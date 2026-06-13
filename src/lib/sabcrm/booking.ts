/**
 * SabCRM — Calendly-class booking links — PURE slot-computation helpers.
 *
 * The structural twin of `./scoring.ts`: a `'server-only'`- and I/O-free
 * module so the unit tests (`tsx --test`) AND the `'use client'` public
 * booking surface can import the types + the deterministic slot math
 * directly. The Mongo CRUD + Google-Calendar busy-time side effects live in
 * `./booking.server.ts`, which re-exports everything here.
 *
 * ## Model
 *
 * A booking link declares a {@link WeeklyAvailability} (per-weekday open
 * windows, e.g. Mon 09:00–17:00) and a meeting `durationMins`. Given a
 * concrete {@link DateRange} (a span of calendar days) and a list of
 * {@link BusyInterval}s (the owner's existing engagements, optionally pulled
 * from Google Calendar), {@link computeSlots} expands the weekly recurrence
 * over each day in the range into back-to-back candidate slots of
 * `durationMins`, then drops any slot that overlaps a busy interval or has
 * already started.
 *
 * Everything is computed in the link's IANA `tz` so a visitor in another
 * timezone still books the owner's real local hours. We avoid any external
 * date library by deriving the timezone's UTC offset for a given day via
 * `Intl.DateTimeFormat` (see {@link tzOffsetMinutes}) — no RRULE engine, just
 * a flat weekly expansion. Pure + deterministic given its inputs.
 */

/** A half-open busy interval `[start, end)` in epoch milliseconds. */
export interface BusyInterval {
  /** ISO-8601 datetime (or anything `Date` parses) — interval start. */
  start: string;
  /** ISO-8601 datetime — interval end. */
  end: string;
}

/**
 * One open window on a weekday, as local wall-clock `HH:mm` strings in the
 * link's timezone. `start` < `end`, both within `00:00`–`24:00`.
 */
export interface AvailabilityWindow {
  /** Local start time, `HH:mm` (24h). */
  start: string;
  /** Local end time, `HH:mm` (24h). */
  end: string;
}

/**
 * Per-weekday availability. Keys are `0` (Sunday) … `6` (Saturday) to match
 * `Date.getUTCDay()`; each value is the list of open windows that day. A
 * missing / empty weekday means "closed".
 */
export type WeeklyAvailability = Partial<Record<number, AvailabilityWindow[]>>;

/** An inclusive span of calendar days the link is bookable over. */
export interface DateRange {
  /** First bookable day, `YYYY-MM-DD`. */
  from: string;
  /** Last bookable day (inclusive), `YYYY-MM-DD`. */
  to: string;
}

/** Inputs to {@link computeSlots}. */
export interface ComputeSlotsInput {
  weeklyAvailability: WeeklyAvailability;
  /** Meeting length in minutes (must be > 0). */
  durationMins: number;
  dateRange: DateRange;
  /** Pre-existing engagements to exclude. Defaults to none. */
  busy?: BusyInterval[];
  /** IANA timezone the availability windows are expressed in, e.g. `Asia/Kolkata`. */
  tz: string;
  /**
   * "Now" as epoch ms — slots that have already started are dropped. Defaults
   * to `Date.now()`. Exposed so tests are deterministic.
   */
  now?: number;
  /**
   * Gap (minutes) between candidate slots. Defaults to `durationMins`
   * (back-to-back). Use a larger step to space meetings out.
   */
  stepMins?: number;
  /** Safety cap on the number of slots returned. Defaults to 500. */
  maxSlots?: number;
}

/** A bookable slot — the canonical ISO instant a meeting would start at. */
export interface BookingSlot {
  /** Slot start as an ISO-8601 UTC instant (`…Z`). */
  startIso: string;
  /** Slot end as an ISO-8601 UTC instant (`…Z`). */
  endIso: string;
}

const MS_PER_MIN = 60_000;
const DEFAULT_MAX_SLOTS = 500;

/* -------------------------------------------------------------------------- */
/* Parsing / coercion helpers                                                  */
/* -------------------------------------------------------------------------- */

/** Parse `HH:mm` → minutes since midnight, or null when malformed. */
export function parseHHmm(value: string): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  const total = h * 60 + min;
  return total > 24 * 60 ? null : total;
}

/** Parse `YYYY-MM-DD` → `{ y, m, d }` (1-based month), or null. */
function parseYmd(value: string): { y: number; m: number; d: number } | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** A `YYYY-MM-DD` day key from a UTC-midnight epoch. */
function ymdKey(utcMidnight: number): string {
  const dt = new Date(utcMidnight);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* -------------------------------------------------------------------------- */
/* Timezone math (Intl-only, no external libs)                                 */
/* -------------------------------------------------------------------------- */

/**
 * The UTC offset (in minutes, EAST-positive) of `tz` at the given UTC instant.
 * E.g. `Asia/Kolkata` → `330`, `America/New_York` in winter → `-300`.
 *
 * Derived by formatting the instant in `tz` and reading back the wall-clock
 * components, then differencing against the same components read in UTC. Falls
 * back to `0` (treat windows as UTC) when `tz` is invalid, so a bad tz never
 * throws — it just yields UTC-relative slots.
 */
export function tzOffsetMinutes(tz: string, atUtcMs: number): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(new Date(atUtcMs));
    const get = (t: string): number =>
      Number(parts.find((p) => p.type === t)?.value ?? '0');
    let hour = get('hour');
    // Intl can emit "24" for midnight under hour12:false — normalise to 0.
    if (hour === 24) hour = 0;
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      hour,
      get('minute'),
      get('second'),
    );
    return Math.round((asUtc - atUtcMs) / MS_PER_MIN);
  } catch {
    return 0;
  }
}

/**
 * Resolve a local wall-clock time (`YYYY-MM-DD` + minutes-since-midnight in
 * `tz`) to the UTC epoch ms it corresponds to. Because the offset itself
 * depends on the instant (DST), we compute it twice: an initial guess using
 * the day's offset, then a correction using the offset AT that guessed instant.
 */
function localWallToUtc(
  ymd: { y: number; m: number; d: number },
  minutesIntoDay: number,
  tz: string,
): number {
  // Treat the wall-clock as if it were UTC, then subtract the zone offset.
  const naiveUtc =
    Date.UTC(ymd.y, ymd.m - 1, ymd.d) + minutesIntoDay * MS_PER_MIN;
  const guessOffset = tzOffsetMinutes(tz, naiveUtc);
  const firstPass = naiveUtc - guessOffset * MS_PER_MIN;
  // Re-evaluate the offset at the candidate instant (handles DST boundaries).
  const corrected = tzOffsetMinutes(tz, firstPass);
  if (corrected === guessOffset) return firstPass;
  return naiveUtc - corrected * MS_PER_MIN;
}

/* -------------------------------------------------------------------------- */
/* Overlap                                                                     */
/* -------------------------------------------------------------------------- */

interface NumericInterval {
  start: number;
  end: number;
}

/** Normalise + sort busy intervals to numeric `[start, end)` epoch ms. */
export function normaliseBusy(busy: BusyInterval[] | undefined): NumericInterval[] {
  if (!Array.isArray(busy)) return [];
  const out: NumericInterval[] = [];
  for (const b of busy) {
    const s = Date.parse(b?.start ?? '');
    const e = Date.parse(b?.end ?? '');
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    out.push({ start: s, end: e });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/** True when `[start, end)` overlaps any busy interval (half-open). */
function overlapsBusy(
  start: number,
  end: number,
  busy: NumericInterval[],
): boolean {
  for (const b of busy) {
    if (b.start >= end) break; // sorted — no later interval can overlap
    if (start < b.end && b.start < end) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Slot expansion                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Compute the bookable slots for a link. Pure + deterministic given its
 * inputs. Expands the weekly availability over every day in `dateRange`,
 * carves each open window into `durationMins` slots stepped by `stepMins`,
 * and excludes slots that overlap a busy interval or have already started
 * (relative to `now`). Returns slots ascending by start, capped at `maxSlots`.
 */
export function computeSlots(input: ComputeSlotsInput): BookingSlot[] {
  const {
    weeklyAvailability,
    durationMins,
    dateRange,
    busy,
    tz,
    now = Date.now(),
    maxSlots = DEFAULT_MAX_SLOTS,
  } = input;

  const slots: BookingSlot[] = [];
  if (!Number.isFinite(durationMins) || durationMins <= 0) return slots;
  if (!weeklyAvailability || typeof weeklyAvailability !== 'object') return slots;

  const from = parseYmd(dateRange?.from);
  const to = parseYmd(dateRange?.to);
  if (!from || !to) return slots;

  const step =
    Number.isFinite(input.stepMins) && (input.stepMins as number) > 0
      ? (input.stepMins as number)
      : durationMins;

  const busyNum = normaliseBusy(busy);

  const fromMidnight = Date.UTC(from.y, from.m - 1, from.d);
  const toMidnight = Date.UTC(to.y, to.m - 1, to.d);
  // Guard against an inverted / absurd range (cap at ~370 iterations).
  if (toMidnight < fromMidnight) return slots;
  const maxDays = 370;

  let cursor = fromMidnight;
  let dayCount = 0;
  while (cursor <= toMidnight && dayCount < maxDays) {
    const dayKey = ymdKey(cursor);
    const ymd = parseYmd(dayKey)!;
    const weekday = new Date(cursor).getUTCDay();
    const windows = weeklyAvailability[weekday] ?? [];

    for (const win of windows) {
      const winStart = parseHHmm(win?.start ?? '');
      const winEnd = parseHHmm(win?.end ?? '');
      if (winStart === null || winEnd === null || winEnd <= winStart) continue;

      // Carve [winStart, winEnd) into duration slots stepped by `step`.
      for (
        let m = winStart;
        m + durationMins <= winEnd;
        m += step
      ) {
        const startMs = localWallToUtc(ymd, m, tz);
        const endMs = startMs + durationMins * MS_PER_MIN;
        if (startMs < now) continue; // already started
        if (overlapsBusy(startMs, endMs, busyNum)) continue;
        slots.push({
          startIso: new Date(startMs).toISOString(),
          endIso: new Date(endMs).toISOString(),
        });
        if (slots.length >= maxSlots) {
          slots.sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso));
          return slots;
        }
      }
    }

    cursor += 24 * 60 * MS_PER_MIN;
    dayCount += 1;
  }

  slots.sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso));
  return slots;
}

/**
 * Validate that `slotIso` is a real bookable slot for the link (defends the
 * public `createBooking` path against a forged time). Recomputes the slots for
 * the slot's own day and checks for an exact start match. Returns the matched
 * slot or null.
 */
export function findSlot(
  slotIso: string,
  cfg: {
    weeklyAvailability: WeeklyAvailability;
    durationMins: number;
    tz: string;
    stepMins?: number;
  },
  busy?: BusyInterval[],
  now = Date.now(),
): BookingSlot | null {
  const t = Date.parse(slotIso);
  if (!Number.isFinite(t)) return null;
  // Expand the slot's calendar day in the link tz (±1 day to cover tz wrap).
  const dayMs = Date.parse(`${slotIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(dayMs)) return null;
  const fromKey = ymdKey(dayMs - 24 * 60 * MS_PER_MIN);
  const toKey = ymdKey(dayMs + 24 * 60 * MS_PER_MIN);
  const slots = computeSlots({
    weeklyAvailability: cfg.weeklyAvailability,
    durationMins: cfg.durationMins,
    dateRange: { from: fromKey, to: toKey },
    busy,
    tz: cfg.tz,
    now,
    stepMins: cfg.stepMins,
  });
  return slots.find((s) => Date.parse(s.startIso) === t) ?? null;
}

/** Default Mon–Fri 09:00–17:00 availability used when a link omits its own. */
export function defaultWeeklyAvailability(): WeeklyAvailability {
  const win: AvailabilityWindow[] = [{ start: '09:00', end: '17:00' }];
  return { 1: win, 2: win, 3: win, 4: win, 5: win };
}

/** A slug-safe lowercase token (a–z, 0–9, hyphen), capped at 64 chars. */
export function slugify(input: string): string {
  return String(input ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
