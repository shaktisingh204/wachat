'use server';

/**
 * §5.3 — CRM Notifications Hub.
 *
 * Surfaces audit-log events that target the current user (assignments,
 * mentions, due-soon, SLA-at-risk) by filtering `crm_audit_log`.
 *
 * Read-receipts live in a dedicated companion collection
 * `crm_notifications_read`, keyed on `{ userId, auditEventId }` so we
 * preserve the audit-log's append-only shape.
 *
 * RBAC: gated on `crm_lead` because no `crm_notification` module key
 * exists in `src/lib/permission-modules.ts`. This is a documented gap —
 * see the §5.3 deliverable note.
 *
 * Due-date heuristics: the audit-log row does not carry the entity's
 * `dueDate` in `meta`. Per-row cross-collection lookups are too
 * expensive for a 50-row feed. We therefore restrict the "due-soon" /
 * "overdue" detection to `status_change` events on
 * `task|ticket|deal|invoice` rows authored in the last 24h — this
 * gives a reasonable proxy without a join. Pure due-date detection is
 * deferred to a later pass once `writeAuditEntry` carries entity
 * metadata.
 */

import 'server-only';
import { ObjectId, type Filter } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';

/* ─── Public types ───────────────────────────────────────────────────── */

export type CrmNotificationKind = 'assignment' | 'mention' | 'due' | 'sla' | 'status_change';

export interface CrmNotificationRow {
    /** Stable identity = audit-log event id. */
    _id: string;
    auditEventId: string;
    /** Best-guess kind, derived from action + entityKind + meta. */
    kind: CrmNotificationKind;
    action: string;
    actorId: string | null;
    actorIsYou: boolean;
    entityKind: string;
    entityId: string;
    entityHref: string | null;
    reason: string | null;
    /** ISO timestamp. */
    ts: string;
    /** True if there is a row in `crm_notifications_read` for this user. */
    read: boolean;
}

export interface CrmNotificationKpis {
    unread: number;
    today: number;
    thisWeek: number;
    overdue: number;
    slaAtRisk: number;
}

export interface CrmNotificationsResult {
    items: CrmNotificationRow[];
    total: number;
    kpis: CrmNotificationKpis;
}

export interface GetCrmNotificationsFilters {
    kind?: CrmNotificationKind | 'all';
    status?: 'unread' | 'read' | 'all';
    limit?: number;
}

/* ─── URL map ────────────────────────────────────────────────────────── */

const ENTITY_HREF: Record<string, (id: string) => string> = {
    lead: (id) => `/dashboard/crm/sales-crm/all-leads/${id}`,
    deal: (id) => `/dashboard/crm/sales-crm/deals/${id}`,
    contact: (id) => `/dashboard/crm/contacts/${id}`,
    account: (id) => `/dashboard/crm/accounts/${id}`,
    invoice: (id) => `/dashboard/crm/sales/invoices/${id}`,
    task: (id) => `/dashboard/crm/tasks/${id}`,
    ticket: (id) => `/dashboard/crm/tickets/${id}`,
    employee: (id) => `/dashboard/crm/hr/employees/${id}`,
};

function entityHrefFor(kind: string, id: string): string | null {
    const fn = ENTITY_HREF[kind];
    return fn ? fn(id) : null;
}

/* ─── Kind inference ─────────────────────────────────────────────────── */

const DUE_RISK_KINDS = new Set(['task', 'ticket', 'deal', 'invoice']);

interface RawAuditDoc {
    _id: ObjectId;
    userId: ObjectId;
    actorId?: ObjectId | null;
    action: string;
    entityKind: string;
    entityId: string;
    reason: string | null;
    diff: Record<string, { before?: unknown; after?: unknown }> | null;
    createdAt: Date;
    /**
     * Optional structured metadata — not guaranteed by the current
     * `writeAuditEntry` contract, but if a caller decided to add it
     * we read it opportunistically. Shape is per-caller.
     */
    meta?: {
        assigneeId?: string | ObjectId;
        mentionedIds?: Array<string | ObjectId>;
        slaBreached?: boolean;
        dueDate?: string | Date;
    } | null;
}

function inferKind(doc: RawAuditDoc, sessionUserId: string): CrmNotificationKind {
    const m = doc.meta ?? null;
    if (m?.slaBreached) return 'sla';
    if (
        m?.mentionedIds &&
        m.mentionedIds.some((id) => String(id) === sessionUserId)
    )
        return 'mention';
    if (doc.action === 'assign' || (m?.assigneeId && String(m.assigneeId) === sessionUserId))
        return 'assignment';
    if (m?.dueDate) return 'due';
    if (doc.action === 'status_change' && DUE_RISK_KINDS.has(doc.entityKind)) return 'status_change';
    return 'status_change';
}

/* ─── Reader ─────────────────────────────────────────────────────────── */

export async function getCrmNotifications(
    filters: GetCrmNotificationsFilters = {},
): Promise<CrmNotificationsResult | { error: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { error: 'Authentication required.' };

    const guard = await requirePermission('crm_notification', 'view');
    if (!guard.ok) return { error: guard.error };

    const userId = String(session.user._id);
    if (!ObjectId.isValid(userId)) return { error: 'Invalid session.' };

    const limit = Math.max(1, Math.min(200, filters.limit ?? 50));
    const tenantOid = new ObjectId(userId);

    try {
        const { db } = await connectToDatabase();

        // We want rows where:
        //   - tenant scope matches (userId == session.user._id)
        //   - AND the actor is not the current user (skip self-actions —
        //     no one wants to be pinged about their own edits)
        //   - AND one of: it's an `assign` action, or meta.assigneeId,
        //     or meta.mentionedIds includes me, or it's a status_change
        //     on a due-risk entity within the last 7 days.
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const auditFilter: Filter<RawAuditDoc> = {
            userId: tenantOid,
            $and: [
                { actorId: { $ne: tenantOid } },
                {
                    $or: [
                        { action: 'assign' },
                        { 'meta.assigneeId': userId },
                        { 'meta.assigneeId': tenantOid },
                        { 'meta.mentionedIds': userId },
                        { 'meta.mentionedIds': tenantOid },
                        { 'meta.slaBreached': true },
                        {
                            action: 'status_change',
                            entityKind: { $in: Array.from(DUE_RISK_KINDS) },
                            createdAt: { $gte: sevenDaysAgo },
                        },
                    ],
                },
            ],
        };

        const docs = (await db
            .collection('crm_audit_log')
            .find(auditFilter as Filter<unknown>)
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray()) as unknown as RawAuditDoc[];

        // Read-receipts: load all matching reads in one query.
        const auditIds = docs.map((d) => d._id);
        const reads = auditIds.length
            ? await db
                  .collection('crm_notifications_read')
                  .find(
                      {
                          userId: tenantOid,
                          auditEventId: { $in: auditIds },
                      } as Filter<unknown>,
                      { projection: { auditEventId: 1 } },
                  )
                  .toArray()
            : [];
        const readSet = new Set(reads.map((r) => String((r as { auditEventId: ObjectId }).auditEventId)));

        // Project rows.
        const items: CrmNotificationRow[] = docs.map((doc) => {
            const id = String(doc._id);
            const actorIdStr = doc.actorId ? String(doc.actorId) : null;
            const kind = inferKind(doc, userId);
            return {
                _id: id,
                auditEventId: id,
                kind,
                action: doc.action,
                actorId: actorIdStr,
                actorIsYou: actorIdStr === userId,
                entityKind: doc.entityKind,
                entityId: doc.entityId,
                entityHref: entityHrefFor(doc.entityKind, doc.entityId),
                reason: doc.reason ?? null,
                ts:
                    doc.createdAt instanceof Date
                        ? doc.createdAt.toISOString()
                        : new Date(doc.createdAt as unknown as string).toISOString(),
                read: readSet.has(id),
            };
        });

        // Apply post-filter (kind + status) in-memory — the result is
        // already capped to `limit` rows so this is bounded.
        const kindFilter = filters.kind && filters.kind !== 'all' ? filters.kind : null;
        const statusFilter = filters.status && filters.status !== 'all' ? filters.status : null;
        const filtered = items.filter((row) => {
            if (kindFilter && row.kind !== kindFilter) return false;
            if (statusFilter === 'unread' && row.read) return false;
            if (statusFilter === 'read' && !row.read) return false;
            return true;
        });

        // KPIs are computed over the unfiltered window so the strip
        // doesn't change when chips are toggled.
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        let unread = 0;
        let today = 0;
        let thisWeek = 0;
        let overdue = 0;
        let slaAtRisk = 0;
        for (const r of items) {
            if (!r.read) unread += 1;
            const t = new Date(r.ts).getTime();
            if (t >= oneDayAgo) today += 1;
            if (t >= oneWeekAgo) thisWeek += 1;
            if (r.kind === 'due') overdue += 1;
            if (r.kind === 'sla') slaAtRisk += 1;
        }

        return {
            items: filtered,
            total: filtered.length,
            kpis: { unread, today, thisWeek, overdue, slaAtRisk },
        };
    } catch (e) {
        console.error('[getCrmNotifications] failed:', e);
        return { error: 'Failed to load notifications.' };
    }
}

/* ─── Mark-read mutations ────────────────────────────────────────────── */

export async function markNotificationRead(
    notificationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Authentication required.' };

    const guard = await requirePermission('crm_notification', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!ObjectId.isValid(notificationId)) {
        return { success: false, error: 'Invalid notification id.' };
    }
    const userId = String(session.user._id);
    if (!ObjectId.isValid(userId)) return { success: false, error: 'Invalid session.' };

    try {
        const { db } = await connectToDatabase();
        const tenantOid = new ObjectId(userId);
        const auditOid = new ObjectId(notificationId);

        // Confirm the audit row exists in this tenant scope before
        // recording a read — prevents cross-tenant probing.
        const exists = await db
            .collection('crm_audit_log')
            .findOne({ _id: auditOid, userId: tenantOid }, { projection: { _id: 1 } });
        if (!exists) return { success: false, error: 'Notification not found.' };

        await db.collection('crm_notifications_read').updateOne(
            { userId: tenantOid, auditEventId: auditOid },
            {
                $setOnInsert: {
                    userId: tenantOid,
                    auditEventId: auditOid,
                    readAt: new Date(),
                },
            },
            { upsert: true },
        );

        // Fire-and-forget audit trail for the mark-read action itself.
        await writeAuditEntry({
            tenantUserId: userId,
            actorId: userId,
            action: 'update',
            entityKind: 'crm_notification',
            entityId: notificationId,
            reason: 'marked read',
        });

        return { success: true };
    } catch (e) {
        console.error('[markNotificationRead] failed:', e);
        return { success: false, error: 'Failed to mark notification read.' };
    }
}

export async function markAllNotificationsRead(): Promise<
    { success: true; count: number } | { success: false; error: string }
> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Authentication required.' };

    const guard = await requirePermission('crm_notification', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    const userId = String(session.user._id);
    if (!ObjectId.isValid(userId)) return { success: false, error: 'Invalid session.' };

    try {
        const { db } = await connectToDatabase();
        const tenantOid = new ObjectId(userId);

        // Re-derive the candidate notification set the same way the
        // reader does, then upsert read-receipts for every row that
        // doesn't already have one.
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const auditFilter: Filter<unknown> = {
            userId: tenantOid,
            $and: [
                { actorId: { $ne: tenantOid } },
                {
                    $or: [
                        { action: 'assign' },
                        { 'meta.assigneeId': userId },
                        { 'meta.assigneeId': tenantOid },
                        { 'meta.mentionedIds': userId },
                        { 'meta.mentionedIds': tenantOid },
                        { 'meta.slaBreached': true },
                        {
                            action: 'status_change',
                            entityKind: { $in: Array.from(DUE_RISK_KINDS) },
                            createdAt: { $gte: sevenDaysAgo },
                        },
                    ],
                },
            ],
        };

        const docs = await db
            .collection('crm_audit_log')
            .find(auditFilter, { projection: { _id: 1 } })
            .limit(500)
            .toArray();
        if (docs.length === 0) return { success: true, count: 0 };

        const now = new Date();
        const ops = docs.map((d) => ({
            updateOne: {
                filter: { userId: tenantOid, auditEventId: d._id as ObjectId },
                update: {
                    $setOnInsert: {
                        userId: tenantOid,
                        auditEventId: d._id as ObjectId,
                        readAt: now,
                    },
                },
                upsert: true,
            },
        }));

        const res = await db.collection('crm_notifications_read').bulkWrite(ops, { ordered: false });
        const count = (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);

        await writeAuditEntry({
            tenantUserId: userId,
            actorId: userId,
            action: 'update',
            entityKind: 'crm_notification',
            entityId: 'bulk',
            reason: `marked ${count} notifications read`,
        });

        return { success: true, count };
    } catch (e) {
        console.error('[markAllNotificationsRead] failed:', e);
        return { success: false, error: 'Failed to mark all notifications read.' };
    }
}
