/**
 * Session listing + revocation, backed by the Mongo `user_sessions`
 * collection. Pure helpers for tests sit on top of an injectable store.
 */

import 'server-only';
import { randomUUID } from 'crypto';
import type { Session } from './types';

const COLLECTION = 'user_sessions';

export type SessionStore = {
    insert(s: Session): Promise<void>;
    listForUser(userId: string, opts?: { includeRevoked?: boolean }): Promise<Session[]>;
    findById(id: string): Promise<Session | null>;
    revoke(id: string, now?: Date): Promise<Session | null>;
    revokeAllForUser(userId: string, opts?: { exceptId?: string; now?: Date }): Promise<number>;
    touch(id: string, now?: Date): Promise<void>;
};

export function createMongoSessionStore(): SessionStore {
    return {
        async insert(s) {
            const { db } = await loadDb();
            await db.collection(COLLECTION).insertOne({ ...s });
        },
        async listForUser(userId, opts) {
            const { db } = await loadDb();
            const filter: Record<string, unknown> = { userId };
            if (!opts?.includeRevoked) filter.revokedAt = { $exists: false };
            const rows = await db.collection(COLLECTION).find(filter).sort({ lastSeenAt: -1 }).toArray();
            return rows as unknown as Session[];
        },
        async findById(id) {
            const { db } = await loadDb();
            const row = await db.collection(COLLECTION).findOne({ id });
            return (row as Session | null) ?? null;
        },
        async revoke(id, now = new Date()) {
            const { db } = await loadDb();
            const row = await db
                .collection(COLLECTION)
                .findOneAndUpdate(
                    { id },
                    { $set: { revokedAt: now.toISOString() } },
                    { returnDocument: 'after' },
                );
            return (row?.value as Session | null) ?? null;
        },
        async revokeAllForUser(userId, opts) {
            const { db } = await loadDb();
            const now = (opts?.now ?? new Date()).toISOString();
            const filter: Record<string, unknown> = { userId, revokedAt: { $exists: false } };
            if (opts?.exceptId) filter.id = { $ne: opts.exceptId };
            const res = await db.collection(COLLECTION).updateMany(filter, { $set: { revokedAt: now } });
            return res.modifiedCount ?? 0;
        },
        async touch(id, now = new Date()) {
            const { db } = await loadDb();
            await db
                .collection(COLLECTION)
                .updateOne({ id }, { $set: { lastSeenAt: now.toISOString() } });
        },
    };
}

export type CreateSessionInput = {
    userId: string;
    orgId?: string;
    /** Default 7 days (in ms). */
    ttl?: number;
    userAgent?: string;
    ip?: string;
    kind?: Session['kind'];
    mfaPassed?: boolean;
};

export function buildSession(input: CreateSessionInput, now: Date = new Date()): Session {
    const ttl = input.ttl ?? 7 * 24 * 60 * 60 * 1000;
    return {
        id: randomUUID(),
        userId: input.userId,
        orgId: input.orgId,
        createdAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttl).toISOString(),
        userAgent: input.userAgent?.slice(0, 256),
        ip: input.ip,
        mfaPassed: input.mfaPassed,
        kind: input.kind ?? 'web',
    };
}

/** Convenience helpers wrapping the Mongo store. */
export async function listSessions(userId: string, store: SessionStore = createMongoSessionStore()) {
    return store.listForUser(userId);
}

export async function revokeSession(id: string, store: SessionStore = createMongoSessionStore()) {
    return store.revoke(id);
}

export async function revokeAllSessions(
    userId: string,
    opts: { exceptId?: string } = {},
    store: SessionStore = createMongoSessionStore(),
) {
    return store.revokeAllForUser(userId, opts);
}

async function loadDb() {
    const mod = await import('@/lib/mongodb');
    return mod.connectToDatabase();
}
