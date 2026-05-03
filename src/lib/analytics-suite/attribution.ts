/**
 * Revenue attribution across an ordered list of touchpoints.
 *
 * All five canonical models are supported. The output is a map
 * channel -> attributed revenue, summing to (approximately) the input
 * revenue (modulo float precision).
 */

import type {
    AttributionModelKind,
    AttributionTouchpoint,
} from './types';

export interface AttributionOptions {
    /** Half-life in hours; default 168 (7 days). Only used by `time-decay`. */
    halfLifeHours?: number;
}

function toMillis(ts: number | Date | string): number {
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    return new Date(ts).getTime();
}

function sortByTs(
    touchpoints: AttributionTouchpoint[],
): AttributionTouchpoint[] {
    return [...touchpoints].sort((a, b) => toMillis(a.ts) - toMillis(b.ts));
}

function emptyResult(): Record<string, number> {
    return {};
}

function add(
    out: Record<string, number>,
    channel: string,
    amount: number,
): void {
    out[channel] = (out[channel] ?? 0) + amount;
}

export function attributeRevenue(
    touchpoints: AttributionTouchpoint[],
    revenue: number,
    model: AttributionModelKind,
    opts: AttributionOptions = {},
): Record<string, number> {
    if (!Array.isArray(touchpoints) || touchpoints.length === 0) {
        return emptyResult();
    }
    if (typeof revenue !== 'number' || !isFinite(revenue) || revenue === 0) {
        return emptyResult();
    }

    const sorted = sortByTs(touchpoints);
    const out: Record<string, number> = {};

    if (model === 'first-touch') {
        add(out, sorted[0].channel, revenue);
        return out;
    }
    if (model === 'last-touch') {
        add(out, sorted[sorted.length - 1].channel, revenue);
        return out;
    }
    if (model === 'linear') {
        const totalWeight = sorted.reduce((s, t) => s + (t.weight ?? 1), 0);
        for (const t of sorted) {
            add(out, t.channel, revenue * ((t.weight ?? 1) / totalWeight));
        }
        return out;
    }
    if (model === 'time-decay') {
        const halfLifeMs = (opts.halfLifeHours ?? 168) * 60 * 60 * 1000;
        const lastTs = toMillis(sorted[sorted.length - 1].ts);
        const weights = sorted.map((t) => {
            const dt = lastTs - toMillis(t.ts);
            return (t.weight ?? 1) * Math.pow(0.5, dt / halfLifeMs);
        });
        const total = weights.reduce((s, w) => s + w, 0);
        sorted.forEach((t, i) => {
            add(out, t.channel, revenue * (weights[i] / total));
        });
        return out;
    }
    if (model === 'u-shape') {
        // 40% first, 40% last, 20% spread among the middle. Single-touch
        // edge cases collapse cleanly.
        if (sorted.length === 1) {
            add(out, sorted[0].channel, revenue);
            return out;
        }
        if (sorted.length === 2) {
            add(out, sorted[0].channel, revenue * 0.5);
            add(out, sorted[1].channel, revenue * 0.5);
            return out;
        }
        add(out, sorted[0].channel, revenue * 0.4);
        add(out, sorted[sorted.length - 1].channel, revenue * 0.4);
        const middle = sorted.slice(1, -1);
        const each = (revenue * 0.2) / middle.length;
        for (const t of middle) add(out, t.channel, each);
        return out;
    }

    // Unknown model — degrade gracefully to last-touch.
    add(out, sorted[sorted.length - 1].channel, revenue);
    return out;
}
