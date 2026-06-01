import "server-only";

/**
 * SabCRM — project activity feed / digest (server-only).
 *
 * Surfaces a unified, tenant-scoped, reverse-chronological stream of ALL
 * timeline activities (`sabcrm_activities`) across every CRM record in the
 * project.  This is the "what happened recently in the CRM" feed that appears
 * on the CRM dashboard / digest panel — it is intentionally broader than the
 * per-record timeline surfaced by `activities.server.ts:listActivities`.
 *
 * ## Scoping & security
 * Every query is hard-filtered by `projectId` (tenant boundary). The feed
 * never crosses tenants.  Callers are responsible for RBAC gating — this
 * module contains no auth logic by design; it is called from the gated
 * server-action layer (`sabcrm.actions.ts`) and from RSC pages that have
 * already verified session + RBAC.
 *
 * ## Pagination
 * Cursor-based forward pagination (oldest-to-newest stable ordering with a
 * `createdAt`-keyed cursor) is available for streaming UIs.  Classic
 * offset-based pagination is also supported for simpler table/list views.
 * Both modes are tenant-scoped and hit the same compound index
 * `{projectId, createdAt, _id}` that is ensured by `ensureSabcrmFeedIndexes`.
 *
 * ## Filtering
 * Optional filters narrow the feed by:
 *  - `types`          — subset of {@link TimelineActivityType}
 *  - `targetObjects`  — subset of object slugs (e.g. only notes on companies)
 *  - `authorIds`      — subset of user ids (my team's activity)
 *  - `since` / `until` — date range window (ISO strings or Date)
 *
 * ## Index
 * The module calls `ensureSabcrmFeedIndexes()` once per process to register
 * the compound index that makes the feed query fast at scale.  It does NOT
 * call the full `ensureSabcrmIndexes()` from `db.ts` to avoid double-work
 * when both are exercised in the same process.
 */

import { ObjectId, type Filter } from "mongodb";

import { sabcrmActivities } from "./db";
import type {
  CrmActivityRecord,
  TimelineActivityType,
} from "./activities.server";
import {
  TIMELINE_ACTIVITY_TYPES,
} from "./activities.server";

/* -------------------------------------------------------------------------- */
/* Feed-specific index management                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ensures the compound index that backs tenant-scoped feed queries is present.
 *
 * Leading key: `projectId` — every feed query is tenant-scoped.
 * Sort key: `createdAt -1` — feed is newest-first.
 * Tie-break: `_id -1` — stable cursor across rows with the same timestamp.
 *
 * Optional second index adds `type` prefix for type-filtered feed queries
 * (e.g. "show me only TASK activities across the whole project").
 *
 * Called lazily (once per process) from every exported feed function.
 */
let feedIndexesEnsured = false;

async function ensureFeedIndexes(): Promise<void> {
  if (feedIndexesEnsured) return;
  feedIndexesEnsured = true;

  const col = await sabcrmActivities();
  await col.createIndexes([
    // Primary feed index: tenant → newest-first with stable cursor.
    { key: { projectId: 1, createdAt: -1, _id: -1 } },
    // Type-filtered feed: tenant → type → newest-first.
    { key: { projectId: 1, type: 1, createdAt: -1, _id: -1 } },
    // Author-filtered feed: tenant → author → newest-first.
    { key: { projectId: 1, authorId: 1, createdAt: -1, _id: -1 } },
    // Object-filtered feed: tenant → targetObject → newest-first.
    { key: { projectId: 1, targetObject: 1, createdAt: -1, _id: -1 } },
  ]);
}

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

/** A subset of activity types the feed can be narrowed to. */
export type FeedActivityType = TimelineActivityType;

/** All recognised activity types for guard checks (re-export for callers). */
export { TIMELINE_ACTIVITY_TYPES };

/**
 * Optional filters for {@link listProjectFeed} and {@link getProjectFeedPage}.
 * All filters are additive (AND'd together).
 */
export interface FeedFilter {
  /**
   * Restrict to specific activity types.  Pass an empty array or omit to
   * include all types.
   */
  types?: FeedActivityType[];
  /**
   * Restrict to activities on specific object slugs (e.g. `['companies',
   * 'opportunities']`).  Omit or pass empty to include all objects.
   */
  targetObjects?: string[];
  /**
   * Restrict to activities authored by specific user ids.
   */
  authorIds?: string[];
  /**
   * Include only activities created at or after this timestamp.
   * Accepts a `Date` or an ISO-8601 string.
   */
  since?: Date | string;
  /**
   * Include only activities created before or at this timestamp.
   * Accepts a `Date` or an ISO-8601 string.
   */
  until?: Date | string;
}

/**
 * Options for classic offset-based pagination.
 */
export interface FeedPageOptions {
  /** 1-based page number. Defaults to `1`. */
  page?: number;
  /**
   * Items per page. Clamped to 1–200. Defaults to `30`.
   */
  pageSize?: number;
}

/** A single page of feed items with pagination metadata. */
export interface FeedPage {
  activities: CrmActivityRecord[];
  total: number;
  page: number;
  pageSize: number;
  /** Convenience flag — `true` when there are more pages after this one. */
  hasMore: boolean;
}

/**
 * Opaque cursor for forward cursor-based pagination.
 *
 * Clients receive this string and pass it back as `after` to get the next
 * batch. Encodes `{createdAt, _id}` so the feed stays stable when new items
 * arrive while the consumer is paginating.
 */
export type FeedCursor = string;

/** Options for cursor-based feed streaming. */
export interface FeedCursorOptions {
  /**
   * Opaque cursor received from a previous call.  Omit (or pass `undefined`)
   * to start from the most-recent activity.
   */
  after?: FeedCursor;
  /**
   * Number of items to return.  Clamped to 1–200.  Defaults to `30`.
   */
  limit?: number;
}

/** Result of a cursor-based feed query. */
export interface FeedCursorPage {
  activities: CrmActivityRecord[];
  /**
   * Cursor to pass as `after` in the next call.  `null` when there are no
   * further items.
   */
  nextCursor: FeedCursor | null;
  /** `true` when there are more items after `nextCursor`. */
  hasMore: boolean;
}

/**
 * Digest statistics for a project over a time window.
 * Used by the CRM dashboard digest panel to show high-level activity counts.
 */
export interface FeedDigest {
  /** Total activities in the window. */
  total: number;
  /** Breakdown by activity type. */
  byType: Record<FeedActivityType, number>;
  /** Breakdown by target object slug. */
  byObject: Record<string, number>;
  /** Breakdown by author user id. */
  byAuthor: Record<string, number>;
  /** Most-recent activity (or `null` when the window is empty). */
  latest: CrmActivityRecord | null;
  /** ISO-8601 string representing the start of the window. */
  since: string;
  /** ISO-8601 string representing the end of the window. */
  until: string;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 200;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

/** Parse a Date-or-ISO-string safely; returns `undefined` on failure. */
function parseDate(value: Date | string | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Guard: value is a recognised {@link TimelineActivityType}. */
function isFeedActivityType(value: unknown): value is FeedActivityType {
  return (
    typeof value === "string" &&
    (TIMELINE_ACTIVITY_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Build a Mongo filter for the `sabcrm_activities` collection from the
 * caller-supplied {@link FeedFilter} and a mandatory `projectId`.
 */
function buildFeedFilter(
  projectId: string,
  filter?: FeedFilter,
): Filter<Record<string, unknown>> {
  const q: Record<string, unknown> = { projectId };

  if (filter?.types && filter.types.length > 0) {
    const validTypes = filter.types.filter(isFeedActivityType);
    if (validTypes.length === 1) {
      q.type = validTypes[0];
    } else if (validTypes.length > 1) {
      q.type = { $in: validTypes };
    }
  }

  if (filter?.targetObjects && filter.targetObjects.length > 0) {
    const objs = filter.targetObjects.filter(
      (s) => typeof s === "string" && s.trim(),
    );
    if (objs.length === 1) {
      q.targetObject = objs[0];
    } else if (objs.length > 1) {
      q.targetObject = { $in: objs };
    }
  }

  if (filter?.authorIds && filter.authorIds.length > 0) {
    const authors = filter.authorIds.filter(
      (s) => typeof s === "string" && s.trim(),
    );
    if (authors.length === 1) {
      q.authorId = authors[0];
    } else if (authors.length > 1) {
      q.authorId = { $in: authors };
    }
  }

  const since = parseDate(filter?.since);
  const until = parseDate(filter?.until);

  if (since || until) {
    const range: Record<string, unknown> = {};
    if (since) range.$gte = since;
    if (until) range.$lte = until;
    q.createdAt = range;
  }

  return q as Filter<Record<string, unknown>>;
}

/**
 * Map a raw Mongo document to the serialisable {@link CrmActivityRecord}.
 * Mirrors the private `toActivity` mapper in `activities.server.ts` without
 * duplicating its import — we only need the same document-to-type projection.
 */
function toActivity(doc: Record<string, unknown>): CrmActivityRecord {
  const rawId = doc._id;
  const id =
    rawId instanceof ObjectId ? rawId.toHexString() : String(rawId ?? "");

  const type: TimelineActivityType = isFeedActivityType(doc.type)
    ? (doc.type as TimelineActivityType)
    : "NOTE";

  const toDate = (v: unknown): Date => {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date(0);
  };

  const sanitizeAttachments = (
    raw: unknown,
  ): CrmActivityRecord["attachments"] => {
    if (!Array.isArray(raw)) return [];
    const out: CrmActivityRecord["attachments"] = [];
    const seen = new Set<string>();
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      if (typeof r.fileId !== "string" || !r.fileId.trim()) continue;
      if (seen.has(r.fileId)) continue;
      seen.add(r.fileId);
      out.push({
        fileId: r.fileId,
        name:
          typeof r.name === "string" && r.name ? r.name : r.fileId,
        ...(typeof r.contentType === "string" && r.contentType
          ? { contentType: r.contentType }
          : {}),
        ...(typeof r.size === "number" && Number.isFinite(r.size)
          ? { size: r.size }
          : {}),
        ...(typeof r.url === "string" && r.url ? { url: r.url } : {}),
      });
    }
    return out;
  };

  const sanitizeMentions = (raw: unknown): CrmActivityRecord["mentions"] => {
    if (!Array.isArray(raw)) return [];
    const out: CrmActivityRecord["mentions"] = [];
    const seen = new Set<string>();
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      if (typeof r.userId !== "string" || !r.userId.trim()) continue;
      if (seen.has(r.userId)) continue;
      seen.add(r.userId);
      out.push({
        userId: r.userId,
        ...(typeof r.displayName === "string" && r.displayName
          ? { displayName: r.displayName }
          : {}),
      });
    }
    return out;
  };

  const isTaskStatus = (v: unknown): v is "TODO" | "IN_PROGRESS" | "DONE" =>
    v === "TODO" || v === "IN_PROGRESS" || v === "DONE";

  const result: CrmActivityRecord = {
    _id: id,
    projectId: String(doc.projectId ?? ""),
    type,
    title: typeof doc.title === "string" ? doc.title : "",
    body: typeof doc.body === "string" ? doc.body : "",
    targetObject: String(doc.targetObject ?? ""),
    targetRecordId: String(doc.targetRecordId ?? ""),
    authorId: String(doc.authorId ?? ""),
    attachments: sanitizeAttachments(doc.attachments),
    mentions: sanitizeMentions(doc.mentions),
    createdAt: toDate(doc.createdAt),
    updatedAt: toDate(doc.updatedAt),
  };

  if (type === "TASK") {
    result.status = isTaskStatus(doc.status) ? doc.status : "TODO";
    if (typeof doc.assigneeId === "string" && doc.assigneeId) {
      result.assigneeId = doc.assigneeId;
    }
    const due = parseDate(
      doc.dueAt instanceof Date || typeof doc.dueAt === "string"
        ? doc.dueAt
        : undefined,
    );
    if (due) result.dueAt = due;
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Cursor encoding / decoding                                                  */
/* -------------------------------------------------------------------------- */

interface CursorPayload {
  /** ISO-8601 timestamp of the last seen activity. */
  t: string;
  /** Hex ObjectId of the last seen activity. */
  id: string;
}

function encodeCursor(createdAt: Date, id: string): FeedCursor {
  const payload: CursorPayload = { t: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(cursor: FeedCursor): CursorPayload | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "t" in parsed &&
      "id" in parsed &&
      typeof (parsed as Record<string, unknown>).t === "string" &&
      typeof (parsed as Record<string, unknown>).id === "string"
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Exported functions                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Offset-based paginated feed of ALL activities across the project.
 *
 * Use this for dashboard tables and list views where the total count is
 * needed.  For infinite-scroll / streaming UIs prefer
 * {@link getProjectFeedCursor} which is cheaper (no `countDocuments`).
 *
 * @param projectId - Tenant boundary — all documents are scoped to this id.
 * @param filter    - Optional narrowing predicates (types, objects, authors,
 *                    date range).  All fields are additive (AND).
 * @param options   - Pagination options (`page`, `pageSize`).
 * @returns A {@link FeedPage} with `activities`, pagination metadata and a
 *          `hasMore` convenience flag.
 */
export async function getProjectFeedPage(
  projectId: string,
  filter?: FeedFilter,
  options?: FeedPageOptions,
): Promise<FeedPage> {
  if (!projectId) {
    throw new Error("projectId is required for getProjectFeedPage");
  }

  await ensureFeedIndexes();

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE),
  );

  const col = await sabcrmActivities();
  const mongoFilter = buildFeedFilter(projectId, filter);

  const [total, docs] = await Promise.all([
    col.countDocuments(mongoFilter),
    col
      .find(mongoFilter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
  ]);

  const activities = docs.map((d) => toActivity(d as Record<string, unknown>));

  return {
    activities,
    total,
    page,
    pageSize,
    hasMore: total > page * pageSize,
  };
}

/**
 * Cursor-based feed for infinite-scroll / streaming UIs.
 *
 * Returns the next batch of activities older than the `after` cursor.  Pass
 * `undefined` (or omit `after`) to start from the most-recent activity.
 *
 * The cursor encodes `{createdAt, _id}` to give stable pagination even when
 * new activities arrive between pages.
 *
 * @param projectId - Tenant boundary.
 * @param filter    - Optional narrowing predicates (same as
 *                    {@link getProjectFeedPage}).
 * @param options   - `after` cursor + `limit` (clamped to 1–200).
 * @returns A {@link FeedCursorPage} with `activities`, `nextCursor` (or
 *          `null`) and a `hasMore` flag.
 */
export async function getProjectFeedCursor(
  projectId: string,
  filter?: FeedFilter,
  options?: FeedCursorOptions,
): Promise<FeedCursorPage> {
  if (!projectId) {
    throw new Error("projectId is required for getProjectFeedCursor");
  }

  await ensureFeedIndexes();

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, options?.limit ?? DEFAULT_LIMIT),
  );

  const col = await sabcrmActivities();
  const baseFilter = buildFeedFilter(projectId, filter);
  const mongoFilter = baseFilter as Record<string, unknown>;

  // Apply cursor: fetch items strictly older than the cursor position.
  if (options?.after) {
    const payload = decodeCursor(options.after);
    if (payload) {
      const cursorDate = parseDate(payload.t);
      const cursorId = ObjectId.isValid(payload.id)
        ? new ObjectId(payload.id)
        : null;

      if (cursorDate && cursorId) {
        // Rows where createdAt < cursorDate, OR createdAt == cursorDate AND
        // _id < cursorId (stable secondary sort on ObjectId).
        mongoFilter.$or = [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ];
      }
    }
  }

  // Fetch one extra item to determine `hasMore` without a count query.
  const docs = await col
    .find(mongoFilter as Filter<Record<string, unknown>>)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = docs.length > limit;
  const pageDocs = docs.slice(0, limit);
  const activities = pageDocs.map((d) =>
    toActivity(d as Record<string, unknown>),
  );

  const lastActivity = activities[activities.length - 1];
  const nextCursor =
    hasMore && lastActivity
      ? encodeCursor(lastActivity.createdAt, lastActivity._id)
      : null;

  return { activities, nextCursor, hasMore };
}

/**
 * Aggregated digest statistics for a project over a time window.
 *
 * Used by the CRM dashboard to render "X notes logged, Y tasks created, Z
 * calls made this week" summary panels without fetching the full activity
 * list.
 *
 * @param projectId - Tenant boundary.
 * @param since     - Start of the window (defaults to 7 days ago).
 * @param until     - End of the window (defaults to now).
 * @param filter    - Additional narrowing predicates (types, objects,
 *                    authors).  `since`/`until` from this param are ignored
 *                    in favour of the explicit parameters.
 * @returns A {@link FeedDigest} with counts and a snapshot of the latest
 *          activity.
 */
export async function getProjectFeedDigest(
  projectId: string,
  since?: Date | string,
  until?: Date | string,
  filter?: Omit<FeedFilter, "since" | "until">,
): Promise<FeedDigest> {
  if (!projectId) {
    throw new Error("projectId is required for getProjectFeedDigest");
  }

  await ensureFeedIndexes();

  const sinceDate =
    parseDate(since) ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    })();
  const untilDate = parseDate(until) ?? new Date();

  const effectiveFilter: FeedFilter = {
    ...filter,
    since: sinceDate,
    until: untilDate,
  };

  const col = await sabcrmActivities();
  const mongoFilter = buildFeedFilter(projectId, effectiveFilter);

  // Fetch all documents in the window (capped at 2 000 to bound memory on
  // noisy projects; the digest is statistical, not exact at high volumes).
  const DIGEST_CAP = 2_000;
  const docs = await col
    .find(mongoFilter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(DIGEST_CAP)
    .toArray();

  const activities = docs.map((d) => toActivity(d as Record<string, unknown>));

  const byType: Record<string, number> = {};
  const byObject: Record<string, number> = {};
  const byAuthor: Record<string, number> = {};

  for (const a of activities) {
    byType[a.type] = (byType[a.type] ?? 0) + 1;
    byObject[a.targetObject] = (byObject[a.targetObject] ?? 0) + 1;
    byAuthor[a.authorId] = (byAuthor[a.authorId] ?? 0) + 1;
  }

  return {
    total: activities.length,
    byType: byType as Record<FeedActivityType, number>,
    byObject,
    byAuthor,
    latest: activities[0] ?? null,
    since: sinceDate.toISOString(),
    until: untilDate.toISOString(),
  };
}

/**
 * Fetch a single activity from the project feed by its id. Returns `null`
 * when the id is malformed or the activity belongs to a different tenant.
 *
 * @param projectId - Tenant boundary.
 * @param id        - Hex ObjectId string of the activity.
 */
export async function getFeedActivity(
  projectId: string,
  id: string,
): Promise<CrmActivityRecord | null> {
  if (!projectId || !id) return null;
  if (!ObjectId.isValid(id)) return null;

  await ensureFeedIndexes();

  const col = await sabcrmActivities();
  const doc = await col.findOne({
    _id: new ObjectId(id),
    projectId,
  } as Filter<Record<string, unknown>>);

  if (!doc) return null;
  return toActivity(doc as Record<string, unknown>);
}

/**
 * Count of activities in the project matching the filter.  Lighter than
 * {@link getProjectFeedPage} when only the total is needed (e.g. badge
 * counters, unread indicators).
 *
 * @param projectId - Tenant boundary.
 * @param filter    - Optional narrowing predicates.
 */
export async function countProjectFeedActivities(
  projectId: string,
  filter?: FeedFilter,
): Promise<number> {
  if (!projectId) return 0;

  await ensureFeedIndexes();

  const col = await sabcrmActivities();
  return col.countDocuments(buildFeedFilter(projectId, filter));
}
