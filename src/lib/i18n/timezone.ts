/**
 * DST-aware timezone helpers backed by Luxon.
 *
 * Luxon understands IANA zones and DST transitions out of the box. This
 * wrapper gives us a small, stable API surface so the rest of the codebase
 * doesn't import Luxon directly (and we can swap implementations later if
 * needed).
 */

import { DateTime, IANAZone } from 'luxon';

import type { TimezoneAware } from './types';

/** Returns true if the IANA timezone string is valid. */
export function isValidTimezone(zone: string): boolean {
    return IANAZone.isValidZone(zone);
}

/** Convert an instant to wall-clock time in `zone`. */
export function toZonedISO(instant: Date | string | number, zone: string): string {
    const dt = toDateTime(instant).setZone(zone);
    if (!dt.isValid) throw new Error(`Invalid zone: ${zone}`);
    return dt.toISO()!;
}

/** Convert a zoned wall-clock value (`isoLocal`, e.g. `2025-03-30T02:30`) into a UTC instant. */
export function fromZonedISO(isoLocal: string, zone: string): Date {
    const dt = DateTime.fromISO(isoLocal, { zone });
    if (!dt.isValid) {
        // Could be a DST-skipped time — coerce forward.
        const fallback = DateTime.fromISO(isoLocal, { zone, setZone: true });
        if (!fallback.isValid) throw new Error(`Invalid wall-clock for ${zone}: ${isoLocal}`);
        return fallback.toUTC().toJSDate();
    }
    return dt.toUTC().toJSDate();
}

/** Returns the offset (minutes from UTC) of `zone` at the given instant. */
export function offsetMinutes(zone: string, at: Date | string | number = new Date()): number {
    const dt = toDateTime(at).setZone(zone);
    return dt.offset;
}

/** Returns true if `zone` is in DST at the given instant. */
export function isDst(zone: string, at: Date | string | number = new Date()): boolean {
    const dt = toDateTime(at).setZone(zone);
    return dt.isInDST;
}

export interface ScheduleOptions {
    /** Wall-clock time `HH:mm` to fire (e.g. `09:00`). */
    timeOfDay: string;
    /** IANA zone the user expects the schedule in. */
    zone: string;
    /** Anchor day (defaults to today in the target zone). */
    anchor?: Date | string;
    /** Days to skip forward (defaults to 0). */
    daysAhead?: number;
}

/**
 * Compute the next UTC instant a schedule should fire at, honouring DST.
 *
 * Example: a daily 09:00 New_York schedule will yield 13:00 UTC in winter
 * and 13:00 UTC in summer — note that Luxon resolves DST automatically so
 * the wall-clock time stays at 09:00 local.
 */
export function nextScheduledInstant(opts: ScheduleOptions): Date {
    const { timeOfDay, zone, anchor, daysAhead = 0 } = opts;
    const [hh, mm] = timeOfDay.split(':').map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
        throw new Error(`Invalid timeOfDay: ${timeOfDay}`);
    }
    const base = anchor ? toDateTime(anchor).setZone(zone) : DateTime.now().setZone(zone);
    let candidate = base.set({ hour: hh, minute: mm, second: 0, millisecond: 0 }).plus({ days: daysAhead });
    if (candidate <= DateTime.now().setZone(zone)) {
        candidate = candidate.plus({ days: 1 });
    }
    return candidate.toUTC().toJSDate();
}

/** Format an instant in a target zone using Luxon tokens. */
export function formatInZone(
    instant: Date | string | number,
    zone: string,
    fmt = 'yyyy-LL-dd HH:mm ZZZZ',
    locale = 'en',
): string {
    return toDateTime(instant).setZone(zone).setLocale(locale).toFormat(fmt);
}

/** Returns a `TimezoneAware` snapshot for now in the given zone. */
export function nowInZone(zone: string): TimezoneAware {
    const dt = DateTime.now().setZone(zone);
    return { timezone: zone, at: dt.toISO()! };
}

/** Convert a `TimezoneAware` value to a JavaScript `Date` (UTC). */
export function toUtcDate(value: TimezoneAware): Date {
    const dt = DateTime.fromISO(value.at, { zone: value.timezone });
    if (!dt.isValid) throw new Error(`Invalid timezone-aware value: ${JSON.stringify(value)}`);
    return dt.toUTC().toJSDate();
}

function toDateTime(value: Date | string | number): DateTime {
    if (value instanceof Date) return DateTime.fromJSDate(value);
    if (typeof value === 'number') return DateTime.fromMillis(value);
    return DateTime.fromISO(value);
}
