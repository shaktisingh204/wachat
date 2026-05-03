/**
 * Append-only, hash-chained audit log.
 *
 * Each entry stores `prev_hash` plus its own SHA-256.  The chain forms
 * a Merkle-style ledger so any tampering with a historical entry can
 * be detected by re-walking the chain (`verifyChain`).
 *
 * Events are written to the Mongo `audit_events` collection which is
 * lazily created as a *capped* collection (1 GB) so even pathological
 * write rates cannot exhaust disk.
 */

import { createHash, randomUUID } from 'node:crypto';

import type {
    AuditEvent,
    AuditQueryFilter,
    AuditQueryPage,
} from './types';

/* ── Constants ──────────────────────────────────────────────────────── */

const COLLECTION = 'audit_events';
const CAP_BYTES = 1024 * 1024 * 1024; // 1 GiB
const GENESIS_HASH =
    '0000000000000000000000000000000000000000000000000000000000000000';

/* ── Helpers ────────────────────────────────────────────────────────── */

/**
 * Produce a stable JSON encoding suitable for hashing.  Keys are
 * sorted recursively so the same logical document always hashes to
 * the same value regardless of insertion order.
 */
export function canonicalize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map(canonicalize).join(',') + ']';
    }
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const parts = keys.map((k) => {
        const v = (value as Record<string, unknown>)[k];
        return JSON.stringify(k) + ':' + canonicalize(v);
    });
    return '{' + parts.join(',') + '}';
}

/** Compute the SHA-256 hash for an audit entry given its prev_hash. */
export function hashEvent(
    prev_hash: string,
    payload: Omit<AuditEvent, 'hash' | 'prev_hash'>,
): string {
    const h = createHash('sha256');
    h.update(prev_hash);
    h.update('|');
    h.update(canonicalize(payload));
    return h.digest('hex');
}

/**
 * Verify a sequence of audit events forms an unbroken chain.  Returns
 * the index of the first tampered entry, or `-1` if the chain is
 * intact.  An empty array is trivially intact.
 */
export function verifyChain(
    events: AuditEvent[],
    genesis: string = GENESIS_HASH,
): number {
    let prev = genesis;
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.prev_hash !== prev) return i;
        const { hash: _h, prev_hash: _p, ...payload } = e;
        const expected = hashEvent(prev, payload);
        if (expected !== e.hash) return i;
        prev = e.hash;
    }
    return -1;
}

/* ── Mongo plumbing ─────────────────────────────────────────────────── */

/**
 * The Mongo client we depend on is the project-wide singleton.  Tests
 * that don't have a live database should avoid touching `audit()` /
 * `queryAuditLog()` directly and use the pure helpers above.
 */
async function getCollection() {
    // Dynamic import keeps `audit-log.ts` usable from edge / test
    // contexts that never call into Mongo.
    const mod: typeof import('../mongodb') = await import('../mongodb');
    const { db } = await mod.connectToDatabase();

    // Ensure the capped collection exists (idempotent).  The Mongo
    // driver throws `NamespaceExists` if we recreate it — we swallow
    // that specific error.
    try {
        const existing = await db
            .listCollections({ name: COLLECTION })
            .toArray();
        if (existing.length === 0) {
            await db.createCollection(COLLECTION, {
                capped: true,
                size: CAP_BYTES,
            });
        }
    } catch (err) {
        const code = (err as { codeName?: string }).codeName;
        if (code !== 'NamespaceExists') throw err;
    }

    const coll = db.collection<AuditEvent>(COLLECTION);
    // Indexes are sparse-friendly on a capped collection.
    await Promise.all([
        coll.createIndex({ tenantId: 1, ts: -1 }).catch(() => undefined),
        coll
            .createIndex({ tenantId: 1, action: 1, ts: -1 })
            .catch(() => undefined),
        coll
            .createIndex({ tenantId: 1, resource: 1, ts: -1 })
            .catch(() => undefined),
    ]);
    return coll;
}

/** Look up the most-recent hash for a tenant — the next entry's prev. */
async function getTenantHead(
    coll: Awaited<ReturnType<typeof getCollection>>,
    tenantId: string,
): Promise<string> {
    const last = await coll.findOne(
        { tenantId },
        { sort: { ts: -1 }, projection: { hash: 1 } },
    );
    return last?.hash ?? GENESIS_HASH;
}

/* ── Public API ─────────────────────────────────────────────────────── */

export interface AuditInput {
    tenantId: string;
    actor: string;
    action: string;
    resource: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

/**
 * Append a single event to the audit log and return the persisted row
 * (including its `hash` and `prev_hash`).  Failures are *not* swallowed
 * — callers decide whether an audit miss should fail the transaction.
 */
export async function audit(input: AuditInput): Promise<AuditEvent> {
    const coll = await getCollection();
    const prev = await getTenantHead(coll, input.tenantId);

    const payload: Omit<AuditEvent, 'hash' | 'prev_hash'> = {
        id: randomUUID(),
        ts: new Date().toISOString(),
        tenantId: input.tenantId,
        actor: input.actor,
        action: input.action,
        resource: input.resource,
        before: input.before,
        after: input.after,
        metadata: input.metadata,
    };

    const event: AuditEvent = {
        ...payload,
        prev_hash: prev,
        hash: hashEvent(prev, payload),
    };

    await coll.insertOne(event);
    return event;
}

/**
 * Cursor-paginated read.  The cursor is the ISO timestamp of the last
 * returned row — simple, idempotent and portable across replicas.
 */
export async function queryAuditLog(
    filter: AuditQueryFilter,
): Promise<AuditQueryPage> {
    const coll = await getCollection();
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 1000);

    const q: Record<string, unknown> = { tenantId: filter.tenantId };
    if (filter.actor) q.actor = filter.actor;
    if (filter.action) q.action = filter.action;
    if (filter.resource) q.resource = filter.resource;

    const tsFilter: Record<string, string> = {};
    if (filter.from) tsFilter.$gte = filter.from;
    if (filter.to) tsFilter.$lte = filter.to;
    if (filter.cursor) tsFilter.$lt = filter.cursor;
    if (Object.keys(tsFilter).length) q.ts = tsFilter;

    const items = await coll
        .find(q)
        .sort({ ts: -1 })
        .limit(limit + 1)
        .toArray();

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].ts : null;

    return { items: page, nextCursor };
}

/** Exposed for tests / admin tooling. */
export const __internals = {
    GENESIS_HASH,
    CAP_BYTES,
    COLLECTION,
    canonicalize,
    hashEvent,
    verifyChain,
};
