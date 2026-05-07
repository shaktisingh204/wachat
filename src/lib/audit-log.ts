/**
 * Cross-cutting audit-log writer.
 *
 * Server actions call `writeAuditEntry({...})` to drop a row into
 * `crm_audit_log`. The §12.21 audit-log page reads back from the same
 * collection. The shape mirrors the Rust `crm_extras_types::AuditEntry`
 * DTO (`actorId` rather than `userId` for the actor, since the
 * tenant-root `userId` already lives at the row's tenant scope).
 *
 * Best-effort by design: a failure here MUST NOT unwind the primary
 * action it's tracing — caller code expects this to be fire-and-forget.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

/**
 * Domain of the entry. Aligned with the §13.5 chain plus a few
 * cross-cutting verbs. Free-form `string` so adding a new verb is a
 * one-line change at the call site — no enum maintenance required.
 */
export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'archive'
    | 'restore'
    | 'status_change'
    | 'assign'
    | 'convert'
    | 'send'
    | 'sign'
    | 'pay'
    | 'void'
    | 'refund'
    | string;

export interface AuditEntryInput {
    /** The tenant root — usually `session.user._id`. */
    tenantUserId: string;
    /** The actor performing the action — same as tenant in single-user tenants. */
    actorId?: string;
    /** What was done. */
    action: AuditAction;
    /** What entity was acted on (`'invoice'`, `'ticket'`, `'employee'`, …). */
    entityKind: string;
    /** Mongo `_id` of the entity, as a hex string. */
    entityId: string;
    /** Optional one-line reason / context (e.g. `'PR #1234'`, `'reverse charge update'`). */
    reason?: string;
    /** Optional structured before/after diff. Shape is per-caller. */
    diff?: Record<string, { before?: unknown; after?: unknown }>;
}

/**
 * Insert one audit row. Returns silently on any failure — callers
 * should never observe this in their main control flow.
 */
export async function writeAuditEntry(entry: AuditEntryInput): Promise<void> {
    if (!entry.tenantUserId || !ObjectId.isValid(entry.tenantUserId)) return;
    if (!entry.action || !entry.entityKind || !entry.entityId) return;

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_audit_log').insertOne({
            userId: new ObjectId(entry.tenantUserId),
            actorId:
                entry.actorId && ObjectId.isValid(entry.actorId)
                    ? new ObjectId(entry.actorId)
                    : new ObjectId(entry.tenantUserId),
            action: entry.action,
            entityKind: entry.entityKind,
            entityId: entry.entityId,
            reason: entry.reason ?? null,
            diff: entry.diff ?? null,
            createdAt: new Date(),
        });
    } catch (e) {
        // Audit log is non-blocking by contract.
        console.error('[writeAuditEntry] insert failed:', e);
    }
}
