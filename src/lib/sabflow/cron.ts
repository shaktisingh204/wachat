
/**
 * Lightweight schedule matcher for SabFlow.
 *
 * Supports two input formats:
 *  1. **Interval strings**: `30s`, `5m`, `1h`, `2d` — fires every N units.
 *     Tracked via `lastRunAt` — due if `now - lastRunAt >= interval`.
 *  2. **5-field cron expressions**: `minute hour day-of-month month day-of-week`
 *     with `*`, `N`, `N,M`, `N-M`, and step syntax `*\/N`.
 *
 * No month-name or weekday-name aliases (keep it tiny).
 */

export type ScheduleSpec =
    | { kind: 'interval'; ms: number }
    | { kind: 'cron'; fields: number[][] };

/* ──────────────────────── Interval parsing ──────────────────────── */

const INTERVAL_RE = /^(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days)$/i;

function parseInterval(input: string): ScheduleSpec | null {
    const m = input.trim().match(INTERVAL_RE);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = m[2].toLowerCase();
    let ms: number;
    if (unit.startsWith('s')) ms = n * 1000;
    else if (unit.startsWith('m') && unit !== 'mo') ms = n * 60_000;
    else if (unit.startsWith('h')) ms = n * 3_600_000;
    else if (unit.startsWith('d')) ms = n * 86_400_000;
    else return null;
    return { kind: 'interval', ms };
}

/* ──────────────────────── Cron parsing ──────────────────────── */

const FIELD_RANGES: [number, number][] = [
    [0, 59],  // minute
    [0, 23],  // hour
    [1, 31],  // day-of-month
    [1, 12],  // month
    [0, 6],   // day-of-week (0 = Sunday)
];

function expandField(field: string, [min, max]: [number, number]): number[] {
    const values = new Set<number>();
    for (const part of field.split(',')) {
        // Step syntax: */N or a-b/N
        let stepMatch = part.match(/^(\*|(\d+)(?:-(\d+))?)\/(\d+)$/);
        if (stepMatch) {
            const step = Number(stepMatch[4]);
            if (!Number.isFinite(step) || step <= 0) throw new Error(`Invalid step "${part}"`);
            const lo = stepMatch[1] === '*' ? min : Number(stepMatch[2]);
            const hi = stepMatch[3] ? Number(stepMatch[3]) : max;
            for (let v = lo; v <= hi; v += step) values.add(v);
            continue;
        }
        if (part === '*') {
            for (let v = min; v <= max; v++) values.add(v);
            continue;
        }
        const rangeMatch = part.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const lo = Number(rangeMatch[1]);
            const hi = Number(rangeMatch[2]);
            for (let v = lo; v <= hi; v++) values.add(v);
            continue;
        }
        if (/^\d+$/.test(part)) {
            values.add(Number(part));
            continue;
        }
        throw new Error(`Invalid cron field segment "${part}"`);
    }
    const arr = Array.from(values).filter(v => v >= min && v <= max).sort((a, b) => a - b);
    if (arr.length === 0) throw new Error(`Empty cron field after parsing`);
    return arr;
}

function parseCron(input: string): ScheduleSpec | null {
    const parts = input.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    try {
        const fields = parts.map((p, i) => expandField(p, FIELD_RANGES[i]));
        return { kind: 'cron', fields };
    } catch {
        return null;
    }
}

/* ──────────────────────── Public API ──────────────────────── */

export function parseSchedule(input: string): ScheduleSpec | null {
    if (typeof input !== 'string' || !input.trim()) return null;
    return parseInterval(input) ?? parseCron(input);
}

/**
 * True if `now` is a time the cron expression fires on (minute-precision).
 * For interval specs, returns `true` iff `now - (lastRunAt ?? 0) >= ms`.
 */
export function isDue(spec: ScheduleSpec, now: Date, lastRunAt?: Date | null): boolean {
    if (spec.kind === 'interval') {
        const lastMs = lastRunAt ? new Date(lastRunAt).getTime() : 0;
        return now.getTime() - lastMs >= spec.ms;
    }
    // Cron: match against current minute
    const [minutes, hours, dom, months, dows] = spec.fields;
    const minute = now.getUTCMinutes();
    const hour = now.getUTCHours();
    const dayOfMonth = now.getUTCDate();
    const month = now.getUTCMonth() + 1;
    const dayOfWeek = now.getUTCDay();

    // Avoid firing twice in the same minute: require lastRunAt to be in a prior minute
    if (lastRunAt) {
        const last = new Date(lastRunAt);
        if (
            last.getUTCFullYear() === now.getUTCFullYear() &&
            last.getUTCMonth() === now.getUTCMonth() &&
            last.getUTCDate() === now.getUTCDate() &&
            last.getUTCHours() === now.getUTCHours() &&
            last.getUTCMinutes() === now.getUTCMinutes()
        ) {
            return false;
        }
    }

    return (
        minutes.includes(minute) &&
        hours.includes(hour) &&
        dom.includes(dayOfMonth) &&
        months.includes(month) &&
        dows.includes(dayOfWeek)
    );
}
