/**
 * In-process pub/sub for audit events.
 *
 * Downstream consumers (SIEM forwarder, real-time dashboards, anomaly
 * detection) subscribe via {@link subscribeToAudit}.  The audit
 * wrappers in {@link ./with-audit} call {@link publishAudit} after each
 * successful (or failed) action so subscribers can mirror events to
 * Splunk / Datadog / Elastic without coupling the producer.
 *
 * The bus is intentionally tiny — no transport, no persistence, no
 * retries.  Subscribers that need durability should drain into their
 * own queue.
 */
import type { AuditEvent } from './types';

/* ── Types ──────────────────────────────────────────────────────────── */

/** A subscriber callback. May return a promise — failures are isolated. */
export type AuditSubscriber = (event: AuditEvent) => void | Promise<void>;

/** Returned by {@link subscribeToAudit} — call to detach. */
export type Unsubscribe = () => void;

/* ── State ──────────────────────────────────────────────────────────── */

const subscribers = new Set<AuditSubscriber>();

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Register a subscriber.  Returns a function that detaches the
 * listener — pass to React `useEffect` cleanup or your shutdown hook.
 *
 * @example
 *   const unsub = subscribeToAudit((evt) => splunkClient.send(evt));
 *   process.on('SIGTERM', unsub);
 */
export function subscribeToAudit(handler: AuditSubscriber): Unsubscribe {
    subscribers.add(handler);
    return () => {
        subscribers.delete(handler);
    };
}

/**
 * Broadcast an audit event to every subscriber.  Subscriber errors are
 * swallowed (and logged via `console.error`) so a noisy SIEM client
 * cannot break the audit pipeline.
 *
 * The function returns immediately — async subscribers run in the
 * background using `void`.  Callers that need back-pressure should use
 * {@link publishAuditAndWait} instead.
 */
export function publishAudit(event: AuditEvent): void {
    for (const fn of subscribers) {
        try {
            const r = fn(event);
            if (r && typeof (r as Promise<void>).then === 'function') {
                (r as Promise<void>).catch((err) => {
                    // eslint-disable-next-line no-console
                    console.error('[audit-feed] subscriber error', err);
                });
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[audit-feed] subscriber threw', err);
        }
    }
}

/**
 * Same as {@link publishAudit} but awaits every subscriber.  Useful in
 * tests where you want deterministic ordering.
 */
export async function publishAuditAndWait(event: AuditEvent): Promise<void> {
    await Promise.allSettled(
        Array.from(subscribers).map(async (fn) => fn(event)),
    );
}

/** Subscriber count — exposed for diagnostics / tests. */
export function auditSubscriberCount(): number {
    return subscribers.size;
}

/** Drop every subscriber.  Test utility; do not use in production. */
export function __resetAuditFeed(): void {
    subscribers.clear();
}
