/**
 * Legal-hold management.
 *
 * A legal hold freezes a set of records — preventing both retention
 * purges and DSR erasure — until the hold is explicitly released.
 * Holds are persisted in the `legal_holds` collection and consulted
 * by `retention.ts` and `dsr.ts`.
 */

import { randomUUID } from 'node:crypto';

import type { LegalHold } from './types';

const HOLDS_COLLECTION = 'legal_holds';

export interface ApplyHoldInput {
    tenantId: string;
    scope: Record<string, unknown>;
    reason: string;
    createdBy: string;
}

/** Open a new legal hold. */
export async function applyHold(input: ApplyHoldInput): Promise<LegalHold> {
    const mod: typeof import('../mongodb') = await import('../mongodb');
    const { db } = await mod.connectToDatabase();

    const hold: LegalHold = {
        id: randomUUID(),
        tenantId: input.tenantId,
        scope: input.scope,
        reason: input.reason,
        createdAt: new Date().toISOString(),
        createdBy: input.createdBy,
    };

    await db.collection<LegalHold>(HOLDS_COLLECTION).insertOne(hold);
    return hold;
}

/**
 * Release an existing hold by id.  Returns the updated row, or null
 * if no matching hold was found / the hold was already released.
 */
export async function releaseHold(
    holdId: string,
    releasedBy: string,
): Promise<LegalHold | null> {
    const mod: typeof import('../mongodb') = await import('../mongodb');
    const { db } = await mod.connectToDatabase();

    const releasedAt = new Date().toISOString();
    const res = await db
        .collection<LegalHold>(HOLDS_COLLECTION)
        .findOneAndUpdate(
            { id: holdId, releasedAt: { $exists: false } },
            { $set: { releasedAt, releasedBy } },
            { returnDocument: 'after' },
        );

    return (res as unknown as LegalHold | null) ?? null;
}

/**
 * Returns true if `record` is covered by any *active* hold for
 * `tenantId`.  Pure helper — useful for defensive checks ahead of an
 * irreversible operation.
 */
export function isHeld(
    record: Record<string, unknown>,
    holds: LegalHold[],
): boolean {
    for (const h of holds) {
        if (h.releasedAt) continue;
        let matches = true;
        for (const [k, v] of Object.entries(h.scope)) {
            if (k === 'collection') continue; // collection match is handled by caller
            if (v === '*') continue;
            if (record[k] !== v) {
                matches = false;
                break;
            }
        }
        if (matches) return true;
    }
    return false;
}

/** Exposed for tests / admin tooling. */
export const __internals = { HOLDS_COLLECTION };
