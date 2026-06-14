/**
 * RecordSurface calendar / map / timeline — pure bucketing helpers.
 *
 * NO React, NO DOM, NO CSS, NO `@/app` imports — only `@/lib/sabcrm/types`
 * (types) — so the bucketing logic is unit-testable under the plain node test
 * runner (`npx tsx --test`). The view components in this folder
 * (`record-calendar-view.tsx`, `record-map-view.tsx`,
 * `record-timeline-view.tsx`) are the only React consumers.
 *
 * The three view types each need exactly one piece of pure logic:
 *
 *   - calendar  → {@link buildMonthGrid}: a 6×7 month grid whose cells carry
 *                 the records whose date field falls on that day.
 *   - timeline  → {@link sortChronological}: records ordered by a date field,
 *                 newest first (or oldest first), undated records bucketed out.
 *   - map       → {@link groupByLocation}: records grouped by a derived
 *                 location key from an ADDRESS field (city/region), buckets
 *                 sorted by size then name, undated/location-less bucketed out.
 *
 * Each view also needs to PICK its driving field from the object's field
 * metadata ({@link pickDateField} / {@link pickLocationField}); a `null`
 * result means the host must degrade to the table view.
 */

import type { CrmRecord, FieldMetadata, FieldType } from '@/lib/sabcrm/types';

/* ========================================================================= */
/* Field selection                                                           */
/* ========================================================================= */

/** Field types a calendar/timeline can bucket by. */
const DATE_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'DATE',
  'DATE_TIME',
]);

/** Field types a map view can derive a location from. */
const LOCATION_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'ADDRESS',
]);

/** Conventional date keys preferred (in order) when several DATE fields exist. */
const PREFERRED_DATE_KEYS: readonly string[] = [
  'date',
  'dueDate',
  'due',
  'startDate',
  'start',
  'scheduledAt',
  'closeDate',
  'eventDate',
  'createdAt',
  'updatedAt',
];

/**
 * Pick the date field a calendar / timeline should bucket by.
 *
 * `preferredKey` (e.g. the active group-by, or a user choice) wins when it is
 * a date field. Otherwise the first field whose key is in
 * {@link PREFERRED_DATE_KEYS} wins, then the first date field in metadata
 * order. Returns `null` when the object has no date field (host → table).
 */
export function pickDateField(
  fields: readonly FieldMetadata[],
  preferredKey?: string | null,
): FieldMetadata | null {
  const dateFields = fields.filter((f) => DATE_FIELD_TYPES.has(f.type));
  if (dateFields.length === 0) return null;

  if (preferredKey) {
    const exact = dateFields.find((f) => f.key === preferredKey);
    if (exact) return exact;
  }

  for (const key of PREFERRED_DATE_KEYS) {
    const hit = dateFields.find((f) => f.key === key);
    if (hit) return hit;
  }

  return dateFields[0] ?? null;
}

/**
 * Pick the location (ADDRESS) field a map view should group by. `preferredKey`
 * wins when it is an ADDRESS field; otherwise the first ADDRESS field in
 * metadata order. Returns `null` when the object has no address field
 * (host → table).
 */
export function pickLocationField(
  fields: readonly FieldMetadata[],
  preferredKey?: string | null,
): FieldMetadata | null {
  const locFields = fields.filter((f) => LOCATION_FIELD_TYPES.has(f.type));
  if (locFields.length === 0) return null;

  if (preferredKey) {
    const exact = locFields.find((f) => f.key === preferredKey);
    if (exact) return exact;
  }

  return locFields[0] ?? null;
}

/* ========================================================================= */
/* Date parsing                                                              */
/* ========================================================================= */

/**
 * Parse an unknown cell into a `Date`, or `null` when it is not a date.
 * Tolerates `Date` instances, epoch numbers, and parseable strings (the
 * shapes a SabCRM date cell can hold — see fields/shared `toDate`).
 */
export function toDateValue(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Local `yyyy-mm-dd` key for a date (no TZ shifting via toISOString). */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ========================================================================= */
/* Calendar — month grid                                                     */
/* ========================================================================= */

/** One day cell in a month grid. */
export interface MonthCell {
  /** Local `yyyy-mm-dd` key for the cell's day. */
  key: string;
  /** Day-of-month (1–31). */
  day: number;
  /** True when the cell belongs to the displayed month (vs. the pad days). */
  inMonth: boolean;
  /** True when the cell is "today" (relative to `now`). */
  isToday: boolean;
  /** Records whose date field falls on this day (incoming order preserved). */
  records: CrmRecord[];
}

/** A 6×7 month grid plus its anchor metadata. */
export interface MonthGrid {
  /** Year of the displayed month. */
  year: number;
  /** Zero-based month index of the displayed month (0 = Jan). */
  month: number;
  /** Exactly 42 cells (6 weeks × 7 days), Sunday-first. */
  cells: MonthCell[];
  /** Records whose date field could not be parsed (no cell). */
  undated: CrmRecord[];
  /** Total records that landed on an in-month cell. */
  placedInMonth: number;
}

/**
 * Build a Sunday-first 6×7 month grid for `{year, month}` (zero-based month),
 * bucketing `records` onto their day cell via `dateKey`. Records outside the
 * displayed month still bucket onto their pad cell when that day is shown;
 * records whose date is unparseable land in `undated`.
 *
 * Always 42 cells so the grid never reflows between months.
 */
export function buildMonthGrid(
  records: readonly CrmRecord[],
  dateKey: string,
  year: number,
  month: number,
  now: Date = new Date(),
): MonthGrid {
  // Bucket every record by its local day key (or to `undated`).
  const byDay = new Map<string, CrmRecord[]>();
  const undated: CrmRecord[] = [];
  for (const record of records) {
    const d = toDateValue(record.data[dateKey]);
    if (!d) {
      undated.push(record);
      continue;
    }
    const k = dayKey(d);
    const bucket = byDay.get(k);
    if (bucket) bucket.push(record);
    else byDay.set(k, [record]);
  }

  const first = new Date(year, month, 1);
  // Sunday-first: back up to the Sunday on/before the 1st.
  const gridStart = new Date(year, month, 1 - first.getDay());
  const todayKey = dayKey(now);

  const cells: MonthCell[] = [];
  let placedInMonth = 0;
  for (let i = 0; i < 42; i += 1) {
    const cellDate = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    );
    const key = dayKey(cellDate);
    const inMonth = cellDate.getMonth() === month && cellDate.getFullYear() === year;
    const cellRecords = byDay.get(key) ?? [];
    if (inMonth) placedInMonth += cellRecords.length;
    cells.push({
      key,
      day: cellDate.getDate(),
      inMonth,
      isToday: key === todayKey,
      records: cellRecords,
    });
  }

  return { year, month, cells, undated, placedInMonth };
}

/**
 * The month a freshly-opened calendar should anchor on: the month of the
 * earliest *upcoming* dated record, else the month of the most recent dated
 * record, else `now`'s month. Keeps the first paint showing data.
 */
export function defaultCalendarMonth(
  records: readonly CrmRecord[],
  dateKey: string,
  now: Date = new Date(),
): { year: number; month: number } {
  let earliestUpcoming: Date | null = null;
  let latest: Date | null = null;
  const nowMs = now.getTime();
  for (const record of records) {
    const d = toDateValue(record.data[dateKey]);
    if (!d) continue;
    if (d.getTime() >= nowMs) {
      if (!earliestUpcoming || d.getTime() < earliestUpcoming.getTime()) {
        earliestUpcoming = d;
      }
    }
    if (!latest || d.getTime() > latest.getTime()) latest = d;
  }
  const anchor = earliestUpcoming ?? latest ?? now;
  return { year: anchor.getFullYear(), month: anchor.getMonth() };
}

/* ========================================================================= */
/* Timeline — chronological order                                            */
/* ========================================================================= */

/** One dated entry in a timeline (record + its parsed date). */
export interface TimelineEntry {
  record: CrmRecord;
  date: Date;
}

/** A timeline split into dated entries (sorted) + undated records. */
export interface TimelineBuckets {
  entries: TimelineEntry[];
  undated: CrmRecord[];
}

/**
 * Sort `records` chronologically by `dateKey`. `dir` `'desc'` (default) is
 * newest-first; `'asc'` is oldest-first. Records whose date is unparseable
 * land in `undated` (incoming order preserved). The sort is stable for equal
 * dates.
 */
export function sortChronological(
  records: readonly CrmRecord[],
  dateKey: string,
  dir: 'asc' | 'desc' = 'desc',
): TimelineBuckets {
  const entries: TimelineEntry[] = [];
  const undated: CrmRecord[] = [];
  for (const record of records) {
    const d = toDateValue(record.data[dateKey]);
    if (d) entries.push({ record, date: d });
    else undated.push(record);
  }
  const sign = dir === 'asc' ? 1 : -1;
  // Stable sort: decorate with the incoming index to break date ties.
  entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const diff = a.e.date.getTime() - b.e.date.getTime();
      if (diff !== 0) return sign * diff;
      return a.i - b.i;
    })
    .forEach((x, idx) => {
      entries[idx] = x.e;
    });
  return { entries, undated };
}

/**
 * Group a chronologically-sorted timeline into period headers
 * ("Today", "Yesterday", "This week", "This month", "Earlier", or a
 * `Month Year` label for older / future entries) preserving entry order.
 * Returned groups follow the entry order, so a `desc` timeline yields
 * newest-period-first headers.
 */
export interface TimelinePeriod {
  /** Stable key (e.g. `today`, `2026-05`). */
  key: string;
  label: string;
  entries: TimelineEntry[];
}

export function groupTimelinePeriods(
  entries: readonly TimelineEntry[],
  now: Date = new Date(),
): TimelinePeriod[] {
  const startOfDay = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOfDay(now);
  const DAY = 86_400_000;
  const yesterdayStart = todayStart - DAY;
  const weekStart = todayStart - 6 * DAY;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const periodOf = (date: Date): { key: string; label: string } => {
    const t = date.getTime();
    if (t >= todayStart && t < todayStart + DAY) {
      return { key: 'today', label: 'Today' };
    }
    if (t >= yesterdayStart && t < todayStart) {
      return { key: 'yesterday', label: 'Yesterday' };
    }
    if (t >= weekStart && t < yesterdayStart) {
      return { key: 'week', label: 'This week' };
    }
    if (t >= monthStart && t < weekStart) {
      return { key: 'month', label: 'This month' };
    }
    // Older or future entries collapse to a Month-Year bucket.
    const y = date.getFullYear();
    const m = date.getMonth();
    const label = date.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    return { key: `${y}-${String(m + 1).padStart(2, '0')}`, label };
  };

  const groups: TimelinePeriod[] = [];
  const index = new Map<string, TimelinePeriod>();
  for (const entry of entries) {
    const { key, label } = periodOf(entry.date);
    let group = index.get(key);
    if (!group) {
      group = { key, label, entries: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

/* ========================================================================= */
/* Map — group by location                                                   */
/* ========================================================================= */

/** The editable parts a location key is derived from (subset of ADDRESS). */
interface AddressLike {
  city: string;
  state: string;
  country: string;
}

/** First non-empty string among the candidates. */
function firstStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

/**
 * Derive the location parts (city / state / country) from an ADDRESS cell.
 * Tolerates the multiple stored shapes SabCRM produces: a `{ city, state,
 * country }` object, Twenty's `address*` keys, or a bare string (treated as a
 * single-locale label). Mirrors fields/shared `parseAddressParts` but kept
 * local so this module stays React/DOM-free.
 */
export function parseLocationParts(raw: unknown): AddressLike {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    return {
      city: firstStr(rec.city, rec.addressCity),
      state: firstStr(rec.state, rec.addressState, rec.region),
      country: firstStr(rec.country, rec.addressCountry),
    };
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    return { city: raw.trim(), state: '', country: '' };
  }
  return { city: '', state: '', country: '' };
}

/**
 * Human label for a location bucket from its parts ("City, State", "City,
 * Country", "Country", or ""). Empty when no part is present.
 */
export function locationLabel(parts: AddressLike): string {
  const { city, state, country } = parts;
  if (city && state) return `${city}, ${state}`;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (state && country) return `${state}, ${country}`;
  if (state) return state;
  if (country) return country;
  return '';
}

/** One location bucket of records. */
export interface LocationGroup {
  /** Stable case-insensitive key (the lowercased label). */
  key: string;
  label: string;
  records: CrmRecord[];
}

/** Records grouped by derived location + the location-less remainder. */
export interface LocationBuckets {
  groups: LocationGroup[];
  /** Records whose ADDRESS cell yielded no location parts. */
  noLocation: CrmRecord[];
}

/**
 * Group `records` by the location derived from their `locationKey` ADDRESS
 * cell. Buckets are sorted by record count (desc) then label (asc, locale).
 * Records with no derivable location land in `noLocation` (incoming order).
 */
export function groupByLocation(
  records: readonly CrmRecord[],
  locationKey: string,
): LocationBuckets {
  const index = new Map<string, LocationGroup>();
  const noLocation: CrmRecord[] = [];

  for (const record of records) {
    const parts = parseLocationParts(record.data[locationKey]);
    const label = locationLabel(parts);
    if (!label) {
      noLocation.push(record);
      continue;
    }
    const key = label.toLowerCase();
    const group = index.get(key);
    if (group) group.records.push(record);
    else index.set(key, { key, label, records: [record] });
  }

  const groups = Array.from(index.values()).sort((a, b) => {
    if (b.records.length !== a.records.length) {
      return b.records.length - a.records.length;
    }
    return a.label.localeCompare(b.label);
  });

  return { groups, noLocation };
}
