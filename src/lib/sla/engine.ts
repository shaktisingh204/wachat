/**
 * SLA engine — pure functions (no I/O) for computing first-response /
 * resolution due-by timestamps and detecting breaches.
 *
 * Design notes
 * ─────────────────────────────────────────────────────────────────
 * The CRM Tickets module (§6.4 of CRM_REBUILD_PLAN.md) tracks two SLA
 * clocks against every ticket:
 *
 *   • `firstResponseDueBy`  — when the first agent reply has to land
 *   • `resolutionDueBy`     — when the ticket has to reach `resolved`
 *
 * Both clocks start from `ticket.createdAt`. Some tenants run 24×7
 * SLAs (e.g. critical infrastructure) while most run "business hours
 * only", which skips weekends, non-work hours, and holiday calendars.
 *
 * `addBusinessHours()` is the workhorse: given a starting timestamp
 * and a number of minutes of work-time, it walks forward chunk by
 * chunk, jumping over non-work intervals, and returns the absolute
 * wall-clock instant when the budget runs out.
 *
 * All functions are deterministic, side-effect free, and accept an
 * explicit `now` for ease of testing.
 */

export type SlaPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SlaSeverity = 'minor' | 'major' | 'critical';
export type SlaBreachType = 'first_response' | 'resolution';

export interface SlaRule {
    /** Optional id — present when loaded from `crm_slas`. */
    _id?: string;
    /** Human-readable label — for audit/messaging only. */
    name?: string;
    priority: SlaPriority;
    severity?: SlaSeverity;
    channel?: string;
    firstResponseMinutes: number;
    resolutionMinutes: number;
    businessHoursOnly: boolean;
    /** Escalation matrix — who/what gets pinged on breach. */
    escalateTo?: string;
    escalateAfterMinutes?: number;
    escalationGroupId?: string;
}

export interface BusinessHours {
    /** IANA tz, e.g. 'Asia/Kolkata'. Defaults to UTC if absent. */
    timezone: string;
    /** Day-of-week numbers in tenant local tz. 0=Sun … 6=Sat. */
    workDays: number[];
    /** Local hour-of-day the workday starts (inclusive). */
    startHour: number;
    /** Local hour-of-day the workday ends (exclusive). */
    endHour: number;
    /** Holidays as `YYYY-MM-DD` strings in the tenant tz. */
    holidays: string[];
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
    timezone: 'Asia/Kolkata',
    workDays: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 18,
    holidays: [],
};

/* ── Ticket adapter ──────────────────────────────────────────────
 *
 * We accept a narrow `SlaTicket` shape rather than the full DTO so
 * the engine can be reused by the cron, the live badge action, and
 * tests without dragging in Mongo/Rust types.
 */

export interface SlaTicket {
    _id?: string;
    createdAt?: string | Date;
    firstResponseAt?: string | Date;
    resolvedAt?: string | Date;
    status?: string;
    priority?: string;
    severity?: string;
    channel?: string;
    /** Already-set escalation marker — used by the cron for idempotency. */
    escalatedAt?: string | Date;
    /** Last cron sweep timestamp — used for the 5-min dedup window. */
    lastSlaBreachCheckAt?: string | Date;
    /** Operator-acknowledged breach — clears the auto-escalation flag. */
    acknowledgedAt?: string | Date;
}

/* ── Helpers ─────────────────────────────────────────────────────
 *
 * Timezone-aware day/hour extraction.  We round-trip through
 * `Intl.DateTimeFormat` rather than mutating Date because the JS
 * Date object is tz-naive once you go past the local offset.
 */

interface LocalParts {
    year: number;
    month: number; // 1-12
    day: number; // 1-31
    hour: number; // 0-23
    minute: number; // 0-59
    second: number; // 0-59
    weekday: number; // 0-6 (Sun..Sat)
}

const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

function getLocalParts(date: Date, tz: string): LocalParts {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
        hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    // `Intl` emits hour=24 at midnight on some platforms.
    const hour = Number(map.hour) % 24;
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour,
        minute: Number(map.minute),
        second: Number(map.second),
        weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
    };
}

function isoDateInTz(date: Date, tz: string): string {
    const p = getLocalParts(date, tz);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function isHolidayOrOffDay(date: Date, bh: BusinessHours): boolean {
    const p = getLocalParts(date, bh.timezone);
    if (!bh.workDays.includes(p.weekday)) return true;
    const iso = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    return bh.holidays.includes(iso);
}

/**
 * Returns the wall-clock instant corresponding to `hour:00:00` on the
 * same local-tz day as `date`. Used to jump the cursor to a work
 * boundary.
 *
 * Implementation note: we approximate by computing the offset between
 * tz-local time and UTC for `date`, then adjusting. This is exact for
 * tz that are constant-offset over the day window we care about (i.e.
 * no DST flip mid-day) which is the practical case for all supported
 * business-hour locales.
 */
function setLocalHour(date: Date, hour: number, tz: string): Date {
    const p = getLocalParts(date, tz);
    // Construct the desired local moment as if it were UTC, then back
    // out the tz offset so the resulting Date represents the right
    // absolute instant.
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, hour, 0, 0, 0);
    const probe = new Date(asUtc);
    const probeLocal = getLocalParts(probe, tz);
    // Difference between the probe's local hour and the hour we wanted
    // is the tz offset (in minutes).
    const localUtcMs = Date.UTC(
        probeLocal.year,
        probeLocal.month - 1,
        probeLocal.day,
        probeLocal.hour,
        probeLocal.minute,
        probeLocal.second,
    );
    const offsetMs = localUtcMs - probe.getTime();
    return new Date(asUtc - offsetMs);
}

function startOfNextDay(date: Date, tz: string): Date {
    // Move at least 24h forward, then re-anchor to midnight local.
    const advanced = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    return setLocalHour(advanced, 0, tz);
}

/**
 * Add `minutes` of working time to `start`, respecting `bh`.
 *
 * Algorithm:
 *   1. If `start` lands outside a workday/work-window, fast-forward
 *      to the next valid work-window start.
 *   2. Within the active window, eat as many minutes as fit before
 *      the window ends.
 *   3. If budget is exhausted, return; otherwise jump to the next
 *      window's start and loop.
 */
export function addBusinessHours(
    start: Date,
    minutes: number,
    bh: BusinessHours,
): Date {
    if (minutes <= 0) return new Date(start);
    if (!Number.isFinite(start.getTime())) return new Date(start);

    let cursor = new Date(start);
    let remaining = Math.ceil(minutes);

    // Hard cap on loop iterations — defensive, prevents runaway loops
    // if config is pathological (e.g. workDays = []).
    let safety = 0;
    while (remaining > 0 && safety++ < 5000) {
        if (isHolidayOrOffDay(cursor, bh)) {
            cursor = setLocalHour(startOfNextDay(cursor, bh.timezone), bh.startHour, bh.timezone);
            continue;
        }
        const parts = getLocalParts(cursor, bh.timezone);
        const cursorMinutes = parts.hour * 60 + parts.minute;
        const startMinutes = bh.startHour * 60;
        const endMinutes = bh.endHour * 60;

        if (cursorMinutes < startMinutes) {
            // Before the workday — jump to start.
            cursor = setLocalHour(cursor, bh.startHour, bh.timezone);
            continue;
        }
        if (cursorMinutes >= endMinutes) {
            // After the workday — jump to next day's start.
            cursor = setLocalHour(startOfNextDay(cursor, bh.timezone), bh.startHour, bh.timezone);
            continue;
        }

        const minutesLeftInWindow = endMinutes - cursorMinutes;
        if (remaining <= minutesLeftInWindow) {
            return new Date(cursor.getTime() + remaining * 60_000);
        }
        // Consume the rest of the window and roll.
        remaining -= minutesLeftInWindow;
        cursor = setLocalHour(startOfNextDay(cursor, bh.timezone), bh.startHour, bh.timezone);
    }

    return cursor;
}

/* ── Public API ─────────────────────────────────────────────────── */

function ticketStart(ticket: SlaTicket): Date {
    if (ticket.createdAt) {
        const d = new Date(ticket.createdAt);
        if (Number.isFinite(d.getTime())) return d;
    }
    return new Date();
}

export function computeFirstResponseDueBy(
    ticket: SlaTicket,
    rule: SlaRule,
    bh: BusinessHours = DEFAULT_BUSINESS_HOURS,
): Date {
    const start = ticketStart(ticket);
    if (!rule.businessHoursOnly) {
        return new Date(start.getTime() + rule.firstResponseMinutes * 60_000);
    }
    return addBusinessHours(start, rule.firstResponseMinutes, bh);
}

export function computeResolutionDueBy(
    ticket: SlaTicket,
    rule: SlaRule,
    bh: BusinessHours = DEFAULT_BUSINESS_HOURS,
): Date {
    const start = ticketStart(ticket);
    if (!rule.businessHoursOnly) {
        return new Date(start.getTime() + rule.resolutionMinutes * 60_000);
    }
    return addBusinessHours(start, rule.resolutionMinutes, bh);
}

/**
 * Decide whether a ticket has breached its SLA.
 *
 * Order of checks:
 *   1. Resolution breach (more severe) wins over first-response.
 *   2. If the ticket has already responded (`firstResponseAt`) we
 *      skip the first-response check.
 *   3. If the ticket has already been resolved/closed we report no
 *      breach — the cron should have filtered these out anyway, but
 *      we double-guard here so the function stays safe to call from
 *      the live badge as well.
 */
export function isBreached(
    ticket: SlaTicket,
    rule: SlaRule,
    bh: BusinessHours = DEFAULT_BUSINESS_HOURS,
    now: Date = new Date(),
): { breached: boolean; type: SlaBreachType | null; minutesOverdue: number } {
    const status = String(ticket.status ?? '').toLowerCase();
    if (status === 'resolved' || status === 'closed') {
        return { breached: false, type: null, minutesOverdue: 0 };
    }

    // Resolution clock.
    if (!ticket.resolvedAt) {
        const resDue = computeResolutionDueBy(ticket, rule, bh);
        if (now.getTime() > resDue.getTime()) {
            return {
                breached: true,
                type: 'resolution',
                minutesOverdue: Math.floor((now.getTime() - resDue.getTime()) / 60_000),
            };
        }
    }

    // First-response clock.
    if (!ticket.firstResponseAt) {
        const frDue = computeFirstResponseDueBy(ticket, rule, bh);
        if (now.getTime() > frDue.getTime()) {
            return {
                breached: true,
                type: 'first_response',
                minutesOverdue: Math.floor((now.getTime() - frDue.getTime()) / 60_000),
            };
        }
    }

    return { breached: false, type: null, minutesOverdue: 0 };
}

/* ── Breach-state evaluation ─────────────────────────────────────
 *
 * `isBreached()` above is a single boolean verdict — handy for the
 * cron, but the live badge + cron want to distinguish three states
 * per clock:
 *
 *   • ok        — plenty of budget remaining
 *   • at_risk   — within the last 25% of the budget (per §6.4)
 *   • breached  — past due
 *
 * `evaluateBreachState()` returns both clocks independently so a
 * caller can react to first-response and resolution separately
 * without re-computing the due-by anchors twice. Pure — accepts an
 * explicit `now` for testability.
 */

export type SlaClockState = 'ok' | 'at_risk' | 'breached';

export interface BreachState {
    firstResponse: SlaClockState;
    resolution: SlaClockState;
    firstResponseDueBy: Date | null;
    resolutionDueBy: Date | null;
}

function classifyClock(
    dueBy: Date,
    totalMinutes: number,
    now: Date,
): SlaClockState {
    const delta = dueBy.getTime() - now.getTime();
    if (delta <= 0) return 'breached';
    // At-risk threshold: within the last 25% of the SLA budget.
    if (totalMinutes > 0 && delta <= totalMinutes * 60_000 * 0.25) {
        return 'at_risk';
    }
    return 'ok';
}

export function evaluateBreachState(
    ticket: SlaTicket,
    rule: SlaRule,
    bh: BusinessHours = DEFAULT_BUSINESS_HOURS,
    now: Date = new Date(),
): BreachState {
    const status = String(ticket.status ?? '').toLowerCase();
    const terminal = status === 'resolved' || status === 'closed' || status === 'archived';

    // Resolved/closed tickets are always 'ok' — the clocks are frozen.
    if (terminal) {
        return {
            firstResponse: 'ok',
            resolution: 'ok',
            firstResponseDueBy: null,
            resolutionDueBy: null,
        };
    }

    const firstResponseDueBy = ticket.firstResponseAt
        ? null
        : computeFirstResponseDueBy(ticket, rule, bh);
    const resolutionDueBy = ticket.resolvedAt
        ? null
        : computeResolutionDueBy(ticket, rule, bh);

    return {
        firstResponse: firstResponseDueBy
            ? classifyClock(firstResponseDueBy, rule.firstResponseMinutes, now)
            : 'ok',
        resolution: resolutionDueBy
            ? classifyClock(resolutionDueBy, rule.resolutionMinutes, now)
            : 'ok',
        firstResponseDueBy,
        resolutionDueBy,
    };
}

/**
 * Convenience wrapper exposing the two due-by anchors as a single
 * object — matches the cron's contract more cleanly than two scalar
 * calls. Pure.
 */
export function computeDueBy(
    ticket: SlaTicket,
    rule: SlaRule,
    bh: BusinessHours = DEFAULT_BUSINESS_HOURS,
): { firstResponseDueAt: Date | null; resolutionDueAt: Date | null } {
    const status = String(ticket.status ?? '').toLowerCase();
    if (status === 'resolved' || status === 'closed' || status === 'archived') {
        return { firstResponseDueAt: null, resolutionDueAt: null };
    }
    return {
        firstResponseDueAt: ticket.firstResponseAt
            ? null
            : computeFirstResponseDueBy(ticket, rule, bh),
        resolutionDueAt: ticket.resolvedAt
            ? null
            : computeResolutionDueBy(ticket, rule, bh),
    };
}

/**
 * Pick the best-matching SLA rule for a ticket.
 *
 * Match priority (specificity-first):
 *   1. priority + severity + channel
 *   2. priority + severity
 *   3. priority + channel
 *   4. priority only
 *   5. any rule flagged with `priority === 'all'` / no priority
 *
 * Returns `null` if nothing fits — the cron falls back to no-op.
 */
export function findApplicableSlaRule(
    ticket: SlaTicket,
    rules: SlaRule[],
): SlaRule | null {
    if (!rules?.length) return null;
    const tPriority = String(ticket.priority ?? '').toLowerCase();
    const tSeverity = String(ticket.severity ?? '').toLowerCase();
    const tChannel = String(ticket.channel ?? '').toLowerCase();

    const score = (r: SlaRule): number => {
        const rP = String(r.priority ?? '').toLowerCase();
        const rS = String(r.severity ?? '').toLowerCase();
        const rC = String(r.channel ?? '').toLowerCase();
        let s = 0;
        if (rP && rP === tPriority) s += 8;
        else if (rP === 'all' || !rP) s += 1;
        else return -1;
        if (rS && rS === tSeverity) s += 4;
        else if (rS) return -1;
        if (rC && rC === tChannel) s += 2;
        else if (rC) return -1;
        return s;
    };

    let best: SlaRule | null = null;
    let bestScore = -1;
    for (const r of rules) {
        const s = score(r);
        if (s > bestScore) {
            best = r;
            bestScore = s;
        }
    }
    return bestScore >= 0 ? best : null;
}
