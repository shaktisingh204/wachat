import 'server-only';

/**
 * Counter + alert helper for dual-impl actions that fell back from Rust →
 * legacy Mongo.
 *
 * Two layers:
 *   1. Structured JSON to stderr — Vercel ingests this for search-based
 *      alerting (rule: `event:rust_fallback`).
 *   2. In-memory rolling-window detector — fires `onAlert(stats)` when the
 *      fallback rate exceeds `RUST_FALLBACK_ALERT_THRESHOLD` (default 0.5%)
 *      over a `RUST_FALLBACK_WINDOW_MS` rolling window (default 10 min).
 *      Production wires `setRustFallbackAlertHandler(fn)` to forward to
 *      PagerDuty / Slack. Default handler logs a single line per fire.
 *
 * Callers invoke `recordRustFallback({ entity, op, errorCode })` inside the
 * catch block AFTER `console.error('[entity] rust path failed; falling back', e)`
 * so the structured log lands AFTER the human-readable one.
 *
 * Production should ALSO call `recordRustSuccess(entity, op)` on every
 * successful Rust path so the rate (success ÷ total) is correct. If success
 * is never reported, the detector falls back to a raw-count threshold via
 * `RUST_FALLBACK_RAW_THRESHOLD` (default 50).
 */

export interface RustFallbackEvent {
    entity: string;        // 'invoice', 'lead', etc.
    op: 'list' | 'get' | 'create' | 'update' | 'delete' | 'other';
    errorCode?: string;    // RustApiError.code when available
    status?: number;       // RustApiError.status when available
}

export interface RustFallbackStats {
    /** ISO timestamps of the failures inside the current window. */
    failuresInWindow: number;
    /** Successes seen in the same window (0 if recordRustSuccess isn't wired). */
    successesInWindow: number;
    /** Fallback rate ∈ [0, 1]. Always 1 when successes=0 and failures>0. */
    rate: number;
    /** Window size in ms used to compute the stats. */
    windowMs: number;
    /** The most recent failure that tripped the alert. */
    triggerEvent: RustFallbackEvent;
}

type RustFallbackAlertHandler = (stats: RustFallbackStats) => void;

const WINDOW_MS = Number(process.env.RUST_FALLBACK_WINDOW_MS ?? 10 * 60 * 1000); // 10 min
const RATE_THRESHOLD = Number(process.env.RUST_FALLBACK_ALERT_THRESHOLD ?? 0.005); // 0.5 %
const RAW_THRESHOLD = Number(process.env.RUST_FALLBACK_RAW_THRESHOLD ?? 50);
const COOLDOWN_MS = Number(process.env.RUST_FALLBACK_COOLDOWN_MS ?? 5 * 60 * 1000); // 5 min

// Per-process state. Resets on a cold start.
const failureTimes: number[] = [];
const successTimes: number[] = [];
let lastAlertAt = 0;

function defaultAlertHandler(stats: RustFallbackStats): void {
    // One log line. Vercel's search-rule still works, but this is now a
    // dedicated `event:rust_fallback_alert` row so the alert query is
    // separate from the per-event count.
    try {
        console.error(
            JSON.stringify({
                event: 'rust_fallback_alert',
                timestamp: new Date().toISOString(),
                ...stats,
            }),
        );
    } catch {
        // never throw from telemetry
    }
}

let handler: RustFallbackAlertHandler = defaultAlertHandler;

export function setRustFallbackAlertHandler(fn: RustFallbackAlertHandler): void {
    handler = fn;
}

function trimWindow(times: number[], cutoff: number): void {
    while (times.length > 0 && times[0]! < cutoff) times.shift();
}

function maybeFireAlert(now: number, triggerEvent: RustFallbackEvent): void {
    if (now - lastAlertAt < COOLDOWN_MS) return;

    const failuresInWindow = failureTimes.length;
    const successesInWindow = successTimes.length;
    const total = failuresInWindow + successesInWindow;
    const rate = total === 0 ? 0 : failuresInWindow / total;

    const rateBreach = total > 0 && rate >= RATE_THRESHOLD;
    const rawBreach = failuresInWindow >= RAW_THRESHOLD;
    if (!rateBreach && !rawBreach) return;

    lastAlertAt = now;
    try {
        handler({
            failuresInWindow,
            successesInWindow,
            rate,
            windowMs: WINDOW_MS,
            triggerEvent,
        });
    } catch {
        // never throw from telemetry
    }
}

export function recordRustFallback(event: RustFallbackEvent): void {
    try {
        const now = Date.now();
        console.warn(
            JSON.stringify({
                event: 'rust_fallback',
                timestamp: new Date(now).toISOString(),
                ...event,
            }),
        );
        const cutoff = now - WINDOW_MS;
        trimWindow(failureTimes, cutoff);
        trimWindow(successTimes, cutoff);
        failureTimes.push(now);
        maybeFireAlert(now, event);
    } catch {
        // never throw from telemetry
    }
}

/**
 * Optional: report successful Rust calls so the alert detector knows the
 * denominator. Without this the alert falls back to the raw-count threshold.
 */
export function recordRustSuccess(_entity?: string, _op?: string): void {
    try {
        const now = Date.now();
        const cutoff = now - WINDOW_MS;
        trimWindow(successTimes, cutoff);
        trimWindow(failureTimes, cutoff);
        successTimes.push(now);
    } catch {
        // never throw from telemetry
    }
}

/** Test/debug helper. Not for production code paths. */
export function _resetRustFallbackState(): void {
    failureTimes.length = 0;
    successTimes.length = 0;
    lastAlertAt = 0;
}

/** Test/debug helper. Returns a snapshot of the current rolling window. */
export function _getRustFallbackSnapshot(): {
    failuresInWindow: number;
    successesInWindow: number;
    windowMs: number;
} {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    trimWindow(failureTimes, cutoff);
    trimWindow(successTimes, cutoff);
    return {
        failuresInWindow: failureTimes.length,
        successesInWindow: successTimes.length,
        windowMs: WINDOW_MS,
    };
}
