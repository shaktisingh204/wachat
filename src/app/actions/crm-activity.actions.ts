'use server';

/**
 * CRM tenant-wide activity feed — read-side server actions for the
 * `/dashboard/crm/activity` page (per CRM_REBUILD_PLAN.md §5.4).
 *
 * The write side is `src/lib/audit-log.ts::writeAuditEntry`, which drops
 * rows into `crm_audit_log` from every mutating CRM server action. This
 * file is the matching read side: tenant-scoped, filterable, paginated.
 *
 * Cursor pagination by `createdAt` timestamp: each page returns
 * `nextCursor` = ISO string of the oldest row in the page. To fetch the
 * next page, pass that back as `filters.cursor`.
 *
 * RBAC gap: no `crm_audit_log` module key exists in
 * `src/lib/permission-modules.ts` today. As an interim gate we require
 * `crm_lead` 'view' — every CRM-using role has it as a baseline and a
 * user without it has no reason to see audit rows. Filed for follow-up:
 * add `crm_audit_log` to permission-modules.ts before GA.
 */

import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface CrmActivityFeedFilters {
    /** e.g. 'invoice', 'lead', 'ticket'. */
    entityKind?: string;
    /** Hex `_id` of an employee/user actor. */
    actorId?: string;
    /** Inclusive lower bound on `createdAt`. */
    from?: Date | string;
    /** Inclusive upper bound on `createdAt`. */
    to?: Date | string;
    /** ISO string from the previous page's `nextCursor`. */
    cursor?: string;
    /** Defaults to 50, clamped to [1, 200]. */
    limit?: number;
}

export interface CrmActivityRow {
    _id: string;
    createdAt: string;
    actorId: string;
    action: string;
    entityKind: string;
    entityId: string;
    reason: string | null;
    diff: Record<string, { before?: unknown; after?: unknown }> | null;
}

export interface CrmActivityFeedKpis {
    /** Events with `createdAt >= startOfDay(now)`. */
    eventsToday: number;
    /** Events within the trailing 7 days. */
    eventsThisWeek: number;
    /** Actor id with the most events in the trailing 7 days (or null). */
    topActorId: string | null;
    /** Entity kind with the most events in the trailing 7 days (or null). */
    topEntityKind: string | null;
}

export interface CrmActivityFeedResult {
    items: CrmActivityRow[];
    /** ISO `createdAt` of the oldest row in this page, or null if no more. */
    nextCursor: string | null;
    kpis: CrmActivityFeedKpis;
    /** Set when the call failed; `items` will be empty. */
    error?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function clampLimit(n: number | undefined): number {
    if (!Number.isFinite(n)) return DEFAULT_LIMIT;
    const v = Math.floor(n as number);
    if (v <= 0) return DEFAULT_LIMIT;
    return Math.min(MAX_LIMIT, v);
}

function parseDate(d: Date | string | undefined): Date | null {
    if (!d) return null;
    const x = d instanceof Date ? d : new Date(d);
    return Number.isNaN(x.getTime()) ? null : x;
}

function startOfTodayUtc(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function sevenDaysAgo(): Date {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function emptyKpis(): CrmActivityFeedKpis {
    return {
        eventsToday: 0,
        eventsThisWeek: 0,
        topActorId: null,
        topEntityKind: null,
    };
}

function emptyResult(error?: string): CrmActivityFeedResult {
    return { items: [], nextCursor: null, kpis: emptyKpis(), error };
}

/* ─── Main read API ──────────────────────────────────────────────────── */

/**
 * Fetch a page of tenant-wide audit rows + KPIs for the activity feed.
 *
 * Cursor convention: pass `nextCursor` from the previous result back as
 * `filters.cursor` to fetch the next page. The first call leaves
 * `filters.cursor` unset.
 */
export async function getCrmActivityFeed(
    filters: CrmActivityFeedFilters = {},
): Promise<CrmActivityFeedResult> {
    try {
        const session = await getSession();
        if (!session?.user?._id) {
            return emptyResult('Authentication required.');
        }
        const userId = String(session.user._id);
        if (!ObjectId.isValid(userId)) {
            return emptyResult('Invalid session.');
        }

        // RBAC gate (gap doc'd above — baseline on crm_lead view).
        const guard = await requirePermission('crm_lead', 'view');
        if (!guard.ok) return emptyResult(guard.error);

        const limit = clampLimit(filters.limit);
        const from = parseDate(filters.from);
        const to = parseDate(filters.to);
        const cursorDate = parseDate(filters.cursor);

        // Build the page query. The tenant scope key in `crm_audit_log`
        // is `userId` (see `writeAuditEntry`). `actorId` is the actor.
        const pageQuery: Record<string, unknown> = {
            userId: new ObjectId(userId),
        };
        if (filters.entityKind) pageQuery.entityKind = filters.entityKind;
        if (filters.actorId && ObjectId.isValid(filters.actorId)) {
            pageQuery.actorId = new ObjectId(filters.actorId);
        }
        const createdAt: Record<string, Date> = {};
        if (from) createdAt.$gte = from;
        if (to) createdAt.$lte = to;
        if (cursorDate) {
            // Strict `$lt` so the cursor row isn't repeated on the next page.
            createdAt.$lt = cursorDate;
        }
        if (Object.keys(createdAt).length > 0) {
            pageQuery.createdAt = createdAt;
        }

        const { db } = await connectToDatabase();
        const coll = db.collection('crm_audit_log');

        // Page rows + KPI windows in parallel — independent reads.
        const todayStart = startOfTodayUtc();
        const weekStart = sevenDaysAgo();

        const [docsRaw, eventsTodayCount, weekAggRaw] = await Promise.all([
            coll
                .find(pageQuery as any)
                .sort({ createdAt: -1 })
                .limit(limit + 1) // +1 sentinel to know whether more rows exist
                .toArray(),
            coll.countDocuments({
                userId: new ObjectId(userId),
                createdAt: { $gte: todayStart },
            }),
            coll
                .aggregate([
                    {
                        $match: {
                            userId: new ObjectId(userId),
                            createdAt: { $gte: weekStart },
                        },
                    },
                    {
                        $facet: {
                            total: [{ $count: 'n' }],
                            topActor: [
                                { $group: { _id: '$actorId', n: { $sum: 1 } } },
                                { $sort: { n: -1 } },
                                { $limit: 1 },
                            ],
                            topEntity: [
                                { $group: { _id: '$entityKind', n: { $sum: 1 } } },
                                { $sort: { n: -1 } },
                                { $limit: 1 },
                            ],
                        },
                    },
                ])
                .toArray(),
        ]);

        // Trim the sentinel row off the page payload and compute nextCursor.
        const hasMore = docsRaw.length > limit;
        const pageDocs = hasMore ? docsRaw.slice(0, limit) : docsRaw;
        const items = JSON.parse(JSON.stringify(pageDocs)) as CrmActivityRow[];
        const nextCursor =
            hasMore && pageDocs.length > 0
                ? new Date(
                      (pageDocs[pageDocs.length - 1] as { createdAt: Date | string })
                          .createdAt,
                  ).toISOString()
                : null;

        // Unpack the $facet result safely.
        const weekAgg = (weekAggRaw[0] ?? {}) as {
            total?: Array<{ n?: number }>;
            topActor?: Array<{ _id?: unknown; n?: number }>;
            topEntity?: Array<{ _id?: unknown; n?: number }>;
        };
        const eventsThisWeek = weekAgg.total?.[0]?.n ?? 0;
        const topActorRaw = weekAgg.topActor?.[0]?._id;
        const topEntityRaw = weekAgg.topEntity?.[0]?._id;

        const kpis: CrmActivityFeedKpis = {
            eventsToday: eventsTodayCount,
            eventsThisWeek,
            topActorId:
                topActorRaw instanceof ObjectId
                    ? topActorRaw.toHexString()
                    : topActorRaw
                      ? String(topActorRaw)
                      : null,
            topEntityKind: topEntityRaw ? String(topEntityRaw) : null,
        };

        return { items, nextCursor, kpis };
    } catch (err) {
        console.error('[getCrmActivityFeed] read failed:', err);
        return emptyResult(getErrorMessage(err));
    }
}
