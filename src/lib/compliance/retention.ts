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

/* ─── Audit-log retention sweep (consumed by /api/cron/audit-retention) ── */

const AUDIT_COLLECTION = 'crm_audit_log';
const DEFAULT_AUDIT_RETENTION_DAYS = 90;

export interface PurgeAuditLogResult {
    tenantUserId: string;
    retentionDays: number;
    /** Count of rows that would be deleted (dry-run) or were eligible. */
    wouldDelete: number;
    /** Count of rows actually deleted; 0 in dry-run mode. */
    deleted: number;
    /** ISO timestamp — rows older than this are eligible. */
    cutoff: string;
}

/**
 * Enforce the configured audit-log retention window for a single
 * tenant. Tombstoned by the cron handler at `/api/cron/audit-retention`.
 *
 * `dryRun` (default `true`) counts eligible rows without deleting them
 * so operators can eyeball the report before flipping the switch.
 */
export async function purgeAuditLogForTenant(
    tenantUserId: string,
    opts: { dryRun?: boolean } = {},
): Promise<PurgeAuditLogResult> {
    const dryRun = opts.dryRun ?? true;

    const mod: typeof import('../mongodb') = await import('../mongodb');
    const { db } = await mod.connectToDatabase();

    // Per-tenant override lives on the user doc; fall back to platform
    // default if nothing is set.
    const { ObjectId } = await import('mongodb');
    let retentionDays = DEFAULT_AUDIT_RETENTION_DAYS;
    if (ObjectId.isValid(tenantUserId)) {
        const userDoc = await db
            .collection('users')
            .findOne(
                { _id: new ObjectId(tenantUserId) },
                { projection: { crmAuditLogRetentionDays: 1 } },
            );
        const override = (userDoc as any)?.crmAuditLogRetentionDays;
        if (typeof override === 'number' && override > 0) {
            retentionDays = override;
        }
    }

    const cutoffDate = new Date(Date.now() - retentionDays * 86_400_000);
    const cutoff = cutoffDate.toISOString();

    const userIdFilter: any = ObjectId.isValid(tenantUserId)
        ? new ObjectId(tenantUserId)
        : tenantUserId;

    const filter = {
        userId: userIdFilter,
        createdAt: { $lt: cutoffDate },
    } as Record<string, unknown>;

    const wouldDelete = await db
        .collection(AUDIT_COLLECTION)
        .countDocuments(filter as any);

    let deleted = 0;
    if (!dryRun && wouldDelete > 0) {
        const res = await db
            .collection(AUDIT_COLLECTION)
            .deleteMany(filter as any);
        deleted = res.deletedCount ?? 0;
    }

    return {
        tenantUserId,
        retentionDays,
        wouldDelete,
        deleted,
        cutoff,
    };
}
