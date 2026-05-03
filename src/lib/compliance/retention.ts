/**
 * Retention sweeper.
 *
 * Records that have been *tombstoned* (`deletedAt` set) past their
 * configured TTL are physically purged.  Records under an active
 * legal hold are skipped if the policy opts in.
 *
 * The sweep is idempotent and tenant-scoped — callers may invoke it
 * on a cron without worrying about double-deletion.
 */

import type { LegalHold, RetentionPolicy } from './types';

/** Outcome of a single retention sweep. */
export interface RetentionSweepReport {
    tenantId: string;
    /** Per-collection counts of records purged. */
    purged: Record<string, number>;
    /** Per-collection counts of records skipped due to legal hold. */
    skipped: Record<string, number>;
    startedAt: string;
    finishedAt: string;
}

const POLICIES_COLLECTION = 'retention_policies';
const HOLDS_COLLECTION = 'legal_holds';

/**
 * Apply every retention policy registered for `tenantId`.  Returns a
 * structured report so callers can audit the run.
 */
export async function applyRetention(
    tenantId: string,
): Promise<RetentionSweepReport> {
    const startedAt = new Date().toISOString();
    const purged: Record<string, number> = {};
    const skipped: Record<string, number> = {};

    const mod: typeof import('../mongodb') = await import('../mongodb');
    const { db } = await mod.connectToDatabase();

    const policies = await db
        .collection<RetentionPolicy>(POLICIES_COLLECTION)
        .find({ tenantId })
        .toArray();

    const activeHolds = await db
        .collection<LegalHold>(HOLDS_COLLECTION)
        .find({ tenantId, releasedAt: { $exists: false } })
        .toArray();

    for (const policy of policies) {
        const cutoff = new Date(
            Date.now() - policy.ttlDays * 86_400_000,
        ).toISOString();

        const baseFilter: Record<string, unknown> = {
            tenantId,
            deletedAt: { $exists: true, $lte: cutoff },
        };

        if (policy.respectLegalHold) {
            // Skip anything matched by an active hold scope for this
            // collection.  The simplest, safe approach is to OR the
            // hold filters and exclude their union.
            const holdsForCollection = activeHolds.filter((h) => {
                const c = h.scope.collection;
                return c === '*' || c === policy.collection;
            });

            if (holdsForCollection.length > 0) {
                const orFilters = holdsForCollection.map((h) => {
                    const { collection: _c, ...rest } = h.scope as {
                        collection?: unknown;
                    } & Record<string, unknown>;
                    return { ...rest };
                });
                const skipFilter = {
                    ...baseFilter,
                    $or: orFilters.length ? orFilters : [{ _impossible: true }],
                };
                const skippedCount = await db
                    .collection(policy.collection)
                    .countDocuments(skipFilter);
                skipped[policy.collection] =
                    (skipped[policy.collection] ?? 0) + skippedCount;

                (baseFilter as Record<string, unknown>).$nor = orFilters;
            }
        }

        const res = await db
            .collection(policy.collection)
            .deleteMany(baseFilter);
        purged[policy.collection] =
            (purged[policy.collection] ?? 0) + (res.deletedCount ?? 0);
    }

    return {
        tenantId,
        purged,
        skipped,
        startedAt,
        finishedAt: new Date().toISOString(),
    };
}

/** Exposed for tests / admin tooling. */
export const __internals = {
    POLICIES_COLLECTION,
    HOLDS_COLLECTION,
};
