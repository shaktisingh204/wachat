/**
 * SabFlow — minimal cron parser & next-fire computer.
 *
 * Supports the classic 5-field format: "minute hour day-of-month month day-of-week".
 *   • `*`              → any value within the field range
 *   • `*\/N` (step)    → every N units starting from the field minimum
 *   • `A-B` (range)    → inclusive range
 *   • `A,B,C` (list)   → explicit list of values
 *   • A combination of the above, joined by `,`
 *
 * Deliberately dependency-free — the project cannot rely on `node-cron`
 * or `cron-parser` being installed on every worker.
 */

/* ── Field ranges ──────────────────────────────────────────────────────────── */

type CronField = {
  min: number;
  max: number;
};

const FIELDS: readonly CronField[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month (1-indexed, January = 1)
  { min: 0, max: 6 },  // day of week (0 = Sunday ... 6 = Saturday)
];

/* ── Public types ──────────────────────────────────────────────────────────── */

/** Parsed cron expression — each field holds the set of allowed numeric values. */
export type CronSpec = {
  /** Allowed minute values (0-59). */
  minute: number[];
  /** Allowed hour values (0-23). */
  hour: number[];
  /** Allowed day-of-month values (1-31). */
  dayOfMonth: number[];
  /** Allowed month values (1-12). */
  month: number[];
  /** Allowed day-of-week values (0-6, Sunday = 0). */
  dayOfWeek: number[];
  /** The original, trimmed expression string. */
  raw: string;
};

export type CronParseError = { error: string };

/* ── Internal helpers ──────────────────────────────────────────────────────── */

function parseFieldPart(
  part: string,
  field: CronField,
): number[] | CronParseError {
  // Step syntax: "<range-or-star>/N"
  let step = 1;
  let rangePart = part;
  if (part.includes('/')) {
    const [left, right] = part.split('/');
    if (right === undefined || right === '') {
      return { error: `Invalid step expression: "${part}"` };
    }
    const stepNum = Number(right);
    if (!Number.isInteger(stepNum) || stepNum <= 0) {
      return { error: `Step must be a positive integer in "${part}"` };
    }
    step = stepNum;
    rangePart = left || '*';
  }

  // Range / wildcard
  let start: number;
  let end: number;

  if (rangePart === '*') {
    start = field.min;
    end = field.max;
  } else if (rangePart.includes('-')) {
    const [a, b] = rangePart.split('-');
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isInteger(na) || !Number.isInteger(nb)) {
      return { error: `Invalid range: "${rangePart}"` };
    }
    start = na;
    end = nb;
  } else {
    const n = Number(rangePart);
    if (!Number.isInteger(n)) {
      return { error: `Invalid value: "${rangePart}"` };
    }
    start = n;
    end = n;
  }

  if (start < field.min || end > field.max || start > end) {
    return { error: `Value out of range ${field.min}-${field.max}: "${part}"` };
  }

  const values: number[] = [];
  for (let v = start; v <= end; v += step) {
    values.push(v);
  }
  return values;
}

function parseField(raw: string, field: CronField): number[] | CronParseError {
  const parts = raw.split(',');
  const set = new Set<number>();
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      return { error: 'Empty list element' };
    }
    const result = parseFieldPart(trimmed, field);
    if ('error' in result) return result;
    for (const v of result) set.add(v);
  }
  return [...set].sort((a, b) => a - b);
}

/* ── parseCron ─────────────────────────────────────────────────────────────── */

/**
 * Parses a 5-field cron expression into a CronSpec.
 *
 * Returns `{ error: string }` when the expression is malformed.
 */
export function parseCron(expr: string): CronSpec | CronParseError {
  if (typeof expr !== 'string') {
    return { error: 'Cron expression must be a string' };
  }
  const trimmed = expr.trim();
  if (!trimmed) {
    return { error: 'Cron expression is empty' };
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length !== 5) {
    return {
      error: `Cron must have 5 fields (minute hour day month weekday), got ${tokens.length}`,
    };
  }

  const parsedFields: number[][] = [];
  for (let i = 0; i < 5; i++) {
    const result = parseField(tokens[i], FIELDS[i]);
    if ('error' in result) {
      return { error: `Field ${i + 1} ("${tokens[i]}"): ${result.error}` };
    }
    parsedFields.push(result);
  }

  return {
    minute: parsedFields[0],
    hour: parsedFields[1],
    dayOfMonth: parsedFields[2],
    month: parsedFields[3],
    dayOfWeek: parsedFields[4],
    raw: trimmed,
  };
}

/* ── Timezone handling ─────────────────────────────────────────────────────── */

/**
 * Returns the wall-clock components (year/month/day/hour/minute/dayOfWeek) of
 * `instant` rendered in `tz` (IANA zone name).  Uses Intl.DateTimeFormat so it
 * works across any zone supported by the runtime.
 *
 * Falls back to UTC components when `tz` is invalid.
 */
function getZonedParts(instant: Date, tz: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
} {
  let parts: Intl.DateTimeFormatPart[];
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    parts = fmt.formatToParts(instant);
  } catch {
    return {
      year: instant.getUTCFullYear(),
      month: instant.getUTCMonth() + 1,
      day: instant.getUTCDate(),
      hour: instant.getUTCHours(),
      minute: instant.getUTCMinutes(),
      dayOfWeek: instant.getUTCDay(),
    };
  }

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  // Intl sometimes returns hour as "24" at midnight — normalise to 0.
  const hourRaw = Number(map.hour);
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    dayOfWeek: weekdayMap[map.weekday] ?? 0,
  };
}

/**
 * True when the cron spec matches the zoned wall-clock parts.
 *
 * Implements the standard Vixie-cron OR-semantics for day-of-month vs.
 * day-of-week when either field is restricted: if both are restricted, either
 * match is sufficient; otherwise, the non-wildcard field must match.
 */
function matchesSpec(
  spec: CronSpec,
  parts: { month: number; day: number; dayOfWeek: number; hour: number; minute: number },
): boolean {
  if (!spec.minute.includes(parts.minute)) return false;
  if (!spec.hour.includes(parts.hour)) return false;
  if (!spec.month.includes(parts.month)) return false;

  const domAll = spec.dayOfMonth.length === 31;
  const dowAll = spec.dayOfWeek.length === 7;

  const domMatch = spec.dayOfMonth.includes(parts.day);
  const dowMatch = spec.dayOfWeek.includes(parts.dayOfWeek);

  if (domAll && dowAll) return true;
  if (!domAll && !dowAll) return domMatch || dowMatch;
  if (!domAll) return domMatch;
  return dowMatch;
}

/* ── getNextFireTimes ──────────────────────────────────────────────────────── */

const MAX_MINUTES_SEARCHED = 60 * 24 * 366 * 5; // 5 years — ample upper bound

/**
 * Returns the next `count` UTC Date instances at which `spec` will fire,
 * strictly *after* `from`.  Search is bounded to a safe horizon so a
 * malformed spec can never hang the server.
 *
 * When `tz` is omitted, UTC is used.
 */
export function getNextFireTimes(
  spec: CronSpec,
  from: Date,
  count: number,
  tz: string = 'UTC',
): Date[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  const results: Date[] = [];

  // Start at the next whole minute after `from` (cron has minute resolution).
  const start = new Date(from.getTime());
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);

  let cursor = start.getTime();
  const limit = cursor + MAX_MINUTES_SEARCHED * 60_000;

  while (cursor <= limit && results.length < count) {
    const at = new Date(cursor);
    const parts = getZonedParts(at, tz);
    if (matchesSpec(spec, parts)) {
      results.push(at);
    }
    cursor += 60_000;
  }

  return results;
}

/* ── describeCron ──────────────────────────────────────────────────────────── */

/**
 * Human-readable, best-effort description for a cron expression.
 * Returns the raw expression when it cannot be described.
 */
export function describeCron(expr: string): string {
  const parsed = parseCron(expr);
  if ('error' in parsed) return expr;

  const { minute, hour, dayOfMonth, month, dayOfWeek } = parsed;
  const everyMinute = minute.length === 60;
  const everyHour = hour.length === 24;
  const everyDom = dayOfMonth.length === 31;
  const everyMonth = month.length === 12;
  const everyDow = dayOfWeek.length === 7;

  if (everyMinute && everyHour && everyDom && everyMonth && everyDow) {
    return 'Every minute';
  }
  if (minute.length === 1 && everyHour && everyDom && everyMonth && everyDow) {
    return `Every hour at minute ${minute[0]}`;
  }
  if (
    minute.length === 1 &&
    hour.length === 1 &&
    everyDom &&
    everyMonth &&
    everyDow
  ) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `Every day at ${pad(hour[0])}:${pad(minute[0])}`;
  }

  return expr;
}
