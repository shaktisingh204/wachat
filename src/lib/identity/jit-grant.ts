/**
 * Just-In-Time access grants.
 *
 * - `requestJitGrant` creates a pending grant.
 * - `approveGrant` flips it to approved (or denied) and stamps the approver.
 * - `expireDueGrants` is a sweeper that revokes anything past TTL.
 *
 * Persistence is delegated through the `JitGrantStore` interface — the
 * default Mongo-backed store lives below and lazily imports `connectToDatabase`
 * so that pure callers (tests, route handlers in the Edge runtime) don't pay
 * the import cost.
 */

import { randomUUID } from 'crypto';
import type { AclAction, Actor, JustInTimeGrant } from './types';

export type JitGrantStore = {
    insert(grant: JustInTimeGrant): Promise<void>;
    findById(id: string): Promise<JustInTimeGrant | null>;
    update(id: string, patch: Partial<JustInTimeGrant>): Promise<JustInTimeGrant | null>;
    listForActor(userId: string, opts?: { activeOnly?: boolean }): Promise<JustInTimeGrant[]>;
    expirePast(now: Date): Promise<number>;
};

export type RequestJitGrantInput = {
    actor: Actor;
    resource: { type: string; id: string };
    actions: AclAction[];
    /** TTL in milliseconds. Required — JIT grants are short-lived by design. */
    ttl: number;
    reason?: string;
};

export async function requestJitGrant(
    input: RequestJitGrantInput,
    store: JitGrantStore,
    now: Date = new Date(),
): Promise<JustInTimeGrant> {
    if (!Number.isFinite(input.ttl) || input.ttl <= 0) {
        throw new Error('JIT grant TTL must be a positive number of milliseconds');
    }
    if (input.ttl > 7 * 24 * 60 * 60 * 1000) {
        throw new Error('JIT grant TTL cannot exceed 7 days');
    }
    const grant: JustInTimeGrant = {
        id: randomUUID(),
        actor: input.actor,
        resource: input.resource,
        actions: input.actions,
        reason: input.reason,
        expiresAt: new Date(now.getTime() + input.ttl).toISOString(),
        requestedAt: now.toISOString(),
        status: 'pending',
    };
    await store.insert(grant);
    return grant;
}

export async function approveGrant(
    grantId: string,
    approver: { userId: string },
    store: JitGrantStore,
    now: Date = new Date(),
): Promise<JustInTimeGrant | null> {
    const existing = await store.findById(grantId);
    if (!existing) return null;
    if (existing.status !== 'pending') {
        throw new Error(`JIT grant ${grantId} is not pending (status=${existing.status})`);
    }
    if (new Date(existing.expiresAt).getTime() < now.getTime()) {
        await store.update(grantId, { status: 'expired' });
        return null;
    }
    return store.update(grantId, {
        status: 'approved',
        approver: { userId: approver.userId, at: now.toISOString() },
    });
}

export async function denyGrant(
    grantId: string,
    approver: { userId: string },
    store: JitGrantStore,
    now: Date = new Date(),
): Promise<JustInTimeGrant | null> {
    const existing = await store.findById(grantId);
    if (!existing) return null;
    if (existing.status !== 'pending') return existing;
    return store.update(grantId, {
        status: 'denied',
        approver: { userId: approver.userId, at: now.toISOString() },
    });
}

export async function revokeGrant(
    grantId: string,
    store: JitGrantStore,
): Promise<JustInTimeGrant | null> {
    return store.update(grantId, { status: 'revoked' });
}

export async function expireDueGrants(
    store: JitGrantStore,
    now: Date = new Date(),
): Promise<number> {
    return store.expirePast(now);
}

/* ── Mongo-backed store (server only) ─────────────────────────────── */

const COLLECTION = 'jit_grants';

export function createMongoJitGrantStore(): JitGrantStore {
    return {
        async insert(grant) {
            const { db } = await loadDb();
            await db.collection(COLLECTION).insertOne({ ...grant });
        },
        async findById(id) {
            const { db } = await loadDb();
            const row = await db.collection(COLLECTION).findOne({ id });
            return (row as JustInTimeGrant | null) ?? null;
        },
        async update(id, patch) {
            const { db } = await loadDb();
            const row = await db
                .collection(COLLECTION)
                .findOneAndUpdate({ id }, { $set: patch }, { returnDocument: 'after' });
            return (row?.value as JustInTimeGrant | null) ?? null;
        },
        async listForActor(userId, opts) {
            const { db } = await loadDb();
            const filter: Record<string, unknown> = { 'actor.userId': userId };
            if (opts?.activeOnly) filter.status = 'approved';
            const rows = await db.collection(COLLECTION).find(filter).toArray();
            return rows as unknown as JustInTimeGrant[];
        },
        async expirePast(now) {
            const { db } = await loadDb();
            const res = await db.collection(COLLECTION).updateMany(
                { status: { $in: ['pending', 'approved'] }, expiresAt: { $lt: now.toISOString() } },
                { $set: { status: 'expired' } },
            );
            return res.modifiedCount ?? 0;
        },
    };
}

async function loadDb() {
    const mod = await import('@/lib/mongodb');
    return mod.connectToDatabase();
}
