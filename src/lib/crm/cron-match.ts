/**
 * Tiny 5-field cron matcher used by the CRM reports scheduler.
 *
 * Lives outside the `'use server'` actions file because Server Action
 * modules may only export async functions — this is a pure synchronous
 * helper.
 *
 * Only the subset SabNode's hourly Vercel cron needs is supported:
 *   `*`, `n`, `n,m,…`, `n-m`, `* /k` (step)
 * Minute precision is intentionally ignored — Vercel cron ticks hourly.
 */

export function cronMatchesHour(cron: string, when: Date): boolean {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return false;
    const [, hourF, domF, monthF, dowF] = parts;

    const hour = when.getUTCHours();
    const dom = when.getUTCDate();
    const month = when.getUTCMonth() + 1;
    const dow = when.getUTCDay();

    return (
        cronFieldMatches(hourF, hour, 0, 23) &&
        cronFieldMatches(domF, dom, 1, 31) &&
        cronFieldMatches(monthF, month, 1, 12) &&
        cronFieldMatches(dowF, dow, 0, 6)
    );
}

function cronFieldMatches(
    field: string,
    value: number,
    min: number,
    max: number,
): boolean {
    if (!field || field === '*') return true;
    for (const token of field.split(',')) {
        const stepMatch = token.match(/^(.+)\/(\d+)$/);
        if (stepMatch) {
            const step = Number(stepMatch[2]);
            if (!step) continue;
            const base = stepMatch[1] === '*' ? `${min}-${max}` : stepMatch[1];
            const rangeMatch = base.match(/^(\d+)-(\d+)$/);
            if (rangeMatch) {
                const lo = Number(rangeMatch[1]);
                const hi = Number(rangeMatch[2]);
                if (value >= lo && value <= hi && (value - lo) % step === 0) return true;
            } else {
                const start = Number(base);
                if (
                    Number.isFinite(start) &&
                    value >= start &&
                    (value - start) % step === 0
                )
                    return true;
            }
            continue;
        }
        const rangeMatch = token.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const lo = Number(rangeMatch[1]);
            const hi = Number(rangeMatch[2]);
            if (value >= lo && value <= hi) return true;
            continue;
        }
        const exact = Number(token);
        if (Number.isFinite(exact) && exact === value) return true;
    }
    return false;
}
