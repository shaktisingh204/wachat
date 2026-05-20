'use server';

/**
 * CRM tenant-wide activity feed — read/write server actions.
 *
 * Two data sources:
 *  1. `crm_audit_log` — tenant-wide audit trail (existing, read-only here).
 *     Powers the Feed view at `/dashboard/crm/activity`.
 *  2. `crm_activities` — structured activity records (calls, emails,
 *     meetings, tasks, notes) with status + due-date tracking.
 *     Powers the Table view and the KPI strip.
 *
 * Cursor pagination (feed): each page returns `nextCursor` = ISO string of
 * the oldest row. Pass back as `filters.cursor` for the next page.
 *
 * RBAC: interim gate on `crm_lead` 'view' (see inline comment).
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';

/* ─── crm_activities collection types ───────────────────────────────────── */

export type CrmActivityType = 'call' | 'email' | 'meeting' | 'task' | 'note';
export type CrmActivityStatus = 'open' | 'completed' | 'overdue';

export interface CrmActivityDoc {
  _id?: string;
  type: CrmActivityType;
  subject: string;
  notes?: string;
  status: CrmActivityStatus;
  relatedEntityKind?: string;
  relatedEntityId?: string;
  assignedUserId?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmActivityListFilters {
  type?: CrmActivityType | string;
  status?: CrmActivityStatus | string;
  assignedUserId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CrmActivityListResult {
  items: CrmActivityDoc[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CrmActivityPageKpis {
  activitiesToday: number;
  openActivities: number;
  overdueActivities: number;
  completedThisWeek: number;
}

const COL_ACTIVITIES = 'crm_activities';
const ACTIVITY_PATH = '/dashboard/crm/activity';

/* ─── Activities list + KPIs ─────────────────────────────────────────────── */

export async function listCrmActivities(
  filters: CrmActivityListFilters = {},
): Promise<CrmActivityListResult> {
  const session = await getSession();
  if (!session?.user?._id) return { items: [], total: 0, page: 1, pageSize: 50 };

  const pageSize = Math.min(Math.max(filters.pageSize ?? 50, 1), 200);
  const page = Math.max(1, filters.page ?? 1);
  const skip = (page - 1) * pageSize;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const q: Record<string, unknown> = { userId };

    if (filters.type && filters.type !== 'all') q.type = filters.type;
    if (filters.status && filters.status !== 'all') q.status = filters.status;
    if (filters.assignedUserId && ObjectId.isValid(filters.assignedUserId)) {
      q.assignedUserId = filters.assignedUserId;
    }
    if (filters.from || filters.to) {
      const range: Record<string, Date> = {};
      if (filters.from) range.$gte = new Date(filters.from);
      if (filters.to) {
        const d = new Date(filters.to);
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
      q.dueDate = range;
    }
    if (filters.search) {
      const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q.$or = [
        { subject: { $regex: escaped, $options: 'i' } },
        { notes: { $regex: escaped, $options: 'i' } },
      ];
    }

    const coll = db.collection(COL_ACTIVITIES);
    const [docs, total] = await Promise.all([
      coll.find(q).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
      coll.countDocuments(q),
    ]);

    return {
      items: JSON.parse(JSON.stringify(docs)) as CrmActivityDoc[],
      total,
      page,
      pageSize,
    };
  } catch (e) {
    console.error('[listCrmActivities] failed:', e);
    return { items: [], total: 0, page, pageSize };
  }
}

export async function getCrmActivityPageKpis(): Promise<CrmActivityPageKpis> {
  const empty: CrmActivityPageKpis = {
    activitiesToday: 0,
    openActivities: 0,
    overdueActivities: 0,
    completedThisWeek: 0,
  };
  const session = await getSession();
  if (!session?.user?._id) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const coll = db.collection(COL_ACTIVITIES);
    const [activitiesToday, openActivities, overdueActivities, completedThisWeek] =
      await Promise.all([
        coll.countDocuments({
          userId,
          createdAt: { $gte: startToday },
        } as Record<string, unknown>),
        coll.countDocuments({ userId, status: 'open' } as Record<string, unknown>),
        coll.countDocuments({ userId, status: 'overdue' } as Record<string, unknown>),
        coll.countDocuments({
          userId,
          status: 'completed',
          completedAt: { $gte: startWeek },
        } as Record<string, unknown>),
      ]);

    return {
      activitiesToday: Number(activitiesToday) || 0,
      openActivities: Number(openActivities) || 0,
      overdueActivities: Number(overdueActivities) || 0,
      completedThisWeek: Number(completedThisWeek) || 0,
    };
  } catch (e) {
    console.error('[getCrmActivityPageKpis] failed:', e);
    return empty;
  }
}

/* ─── Activities mutations ───────────────────────────────────────────────── */

export async function bulkCompleteActivities(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, processed: 0, error: 'Access denied.' };

  const valid = ids.filter((id) => ObjectId.isValid(id));
  if (valid.length === 0) return { success: false, processed: 0, error: 'No valid ids.' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const result = await db.collection(COL_ACTIVITIES).updateMany(
      { _id: { $in: valid.map((id) => new ObjectId(id)) }, userId } as Record<string, unknown>,
      {
        $set: {
          status: 'completed',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    );
    revalidatePath(ACTIVITY_PATH);
    return { success: true, processed: result.modifiedCount ?? 0 };
  } catch (e) {
    return { success: false, processed: 0, error: getErrorMessage(e) };
  }
}

export async function bulkDeleteActivities(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, processed: 0, error: 'Access denied.' };

  const valid = ids.filter((id) => ObjectId.isValid(id));
  if (valid.length === 0) return { success: false, processed: 0, error: 'No valid ids.' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const result = await db.collection(COL_ACTIVITIES).deleteMany({
      _id: { $in: valid.map((id) => new ObjectId(id)) },
      userId,
    } as Record<string, unknown>);
    revalidatePath(ACTIVITY_PATH);
    return { success: true, processed: result.deletedCount ?? 0 };
  } catch (e) {
    return { success: false, processed: 0, error: getErrorMessage(e) };
  }
}

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
