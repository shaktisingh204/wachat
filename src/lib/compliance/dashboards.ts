/**
 * Aggregations over the compliance audit log used by the
 * admin dashboard.  Pure data layer — no React, no Next caching
 * primitives — so the helpers can be reused by background workers and
 * server components alike.
 *
 * The dashboard intentionally aggregates *in memory* using the
 * existing {@link queryAuditLog} cursor.  A capped audit collection
 * tops out at 1 GiB so a tenant's full history is bounded; if/when we
 * migrate to a non-capped store we can swap in a Mongo `$facet`
 * aggregation behind the same signature.
 */
import { queryAuditLog } from './audit-log';
import type { AuditEvent } from './types';

/* ── Public types ───────────────────────────────────────────────────── */

/** Half-open ISO range used by every dashboard query. */
export interface DateRange {
    /** ISO-8601 — inclusive lower bound. */
    from: string;
    /** ISO-8601 — inclusive upper bound. */
    to: string;
}

/** A single bucket in an actor / resource / action histogram. */
export interface AuditBucket {
    /** Bucket key — actor id, resource path or action verb. */
    key: string;
    count: number;
    /** Number of failed events (subset of `count`). */
    failures: number;
}

/** Output shape returned by {@link auditSummaryFor}. */
export interface AuditSummary {
    tenantId: string;
    range: DateRange;
    /** Total events in range. */
    total: number;
    /** Total failed events (`metadata.outcome === 'error'`). */
    failures: number;
    actionsByActor: AuditBucket[];
    actionsByResource: AuditBucket[];
    actionsByAction: AuditBucket[];
    /** Most recent N events for the table preview (N = 50). */
    recent: AuditEvent[];
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function isFailure(e: AuditEvent): boolean {
    const meta = e.metadata as Record<string, unknown> | undefined;
    return meta?.outcome === 'error';
}

function bucket(events: AuditEvent[], key: keyof AuditEvent): AuditBucket[] {
    const counts = new Map<string, { count: number; failures: number }>();
    for (const evt of events) {
        const k = String(evt[key] ?? 'unknown');
        const cur = counts.get(k) ?? { count: 0, failures: 0 };
        cur.count += 1;
        if (isFailure(evt)) cur.failures += 1;
        counts.set(k, cur);
    }
    return Array.from(counts.entries())
        .map(([k, v]) => ({ key: k, count: v.count, failures: v.failures }))
        .sort((a, b) => b.count - a.count);
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Build a dashboard summary for a tenant in a half-open date range.
 *
 * Walks the audit cursor up to a hard ceiling of 10k events so the
 * call returns predictable latency.  The page count is exposed via
 * `summary.total` — callers that need precise counts beyond the
 * ceiling should prefer Mongo aggregation directly.
 */
export async function auditSummaryFor(
    tenantId: string,
    range: DateRange,
    opts: { maxEvents?: number; recentLimit?: number } = {},
): Promise<AuditSummary> {
    const ceiling = Math.max(opts.maxEvents ?? 10_000, 100);
    const recentLimit = Math.max(opts.recentLimit ?? 50, 1);

    const collected: AuditEvent[] = [];
    let cursor: string | null | undefined;

    /* eslint-disable no-await-in-loop */
    while (collected.length < ceiling) {
        const page = await queryAuditLog({
            tenantId,
            from: range.from,
            to: range.to,
            cursor: cursor ?? undefined,
            limit: 1000,
        });
        collected.push(...page.items);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
    }
    /* eslint-enable no-await-in-loop */

    const failures = collected.reduce(
        (acc, e) => acc + (isFailure(e) ? 1 : 0),
        0,
    );

    return {
        tenantId,
        range,
        total: collected.length,
        failures,
        actionsByActor: bucket(collected, 'actor'),
        actionsByResource: bucket(collected, 'resource'),
        actionsByAction: bucket(collected, 'action'),
        recent: collected.slice(0, recentLimit),
    };
}

/**
 * Tiny utility for the admin UI — produces an ISO range covering the
 * last `days` days, in UTC.
 */
export function lastNDays(days: number): DateRange {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
}
