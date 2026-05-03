/**
 * SabNode Developer Platform — opaque cursor pagination helpers.
 *
 * The platform standardises on a base64url-encoded JSON cursor of the form
 *
 *   { id: string, ts?: number, dir?: 'next' | 'prev' }
 *
 * `id` is whatever stable key the underlying collection uses (Mongo
 * ObjectId hex, UUID, monotonic numeric id, …).  `ts` is optional but
 * useful when the primary sort is by createdAt — including the timestamp
 * lets the decoder validate freshness and lets callers debug a cursor by
 * inspecting it.
 *
 * The cursor is **opaque** to the API consumer; the contract is "send the
 * `next_cursor` we returned, untouched, on the next call".
 */

import 'server-only';

import { Buffer } from 'node:buffer';

/* ── Cursor codec ───────────────────────────────────────────────────────── */

export interface CursorPayload {
  /** Stable id of the boundary record (last item from the previous page). */
  id: string;
  /** Optional unix-ms timestamp for stable secondary ordering. */
  ts?: number;
  /** Direction hint, default `next`. */
  dir?: 'next' | 'prev';
}

/** Encode a cursor payload to a URL-safe base64 string. */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * Decode a cursor.  Returns `null` on any failure so callers can decide
 * how to surface that (we recommend `ApiError.validationFailed`).
 */
export function decodeCursor(raw: string | null | undefined): CursorPayload | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<CursorPayload>;
    if (typeof parsed.id !== 'string' || parsed.id.length === 0) return null;
    if (parsed.ts !== undefined && typeof parsed.ts !== 'number') return null;
    if (parsed.dir !== undefined && parsed.dir !== 'next' && parsed.dir !== 'prev') {
      return null;
    }
    return {
      id: parsed.id,
      ts: parsed.ts,
      dir: parsed.dir ?? 'next',
    };
  } catch {
    return null;
  }
}

/* ── Page helpers ───────────────────────────────────────────────────────── */

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

/** Options accepted by `paginate`. */
export interface PaginateOptions {
  /** Caller-supplied limit, will be clamped to `[1, MAX_LIMIT]`. */
  limit?: number | string | null;
  /** Optional cursor from the caller (will be `decode`d). */
  cursor?: string | null;
  /** Override default limit (default 25). */
  defaultLimit?: number;
  /** Override max limit (default 200). */
  maxLimit?: number;
}

/**
 * Result of running a paginated query.  `data` is the (clamped) page,
 * `next_cursor` is `null` when there are no more pages.
 */
export interface PageResult<T> {
  data: T[];
  next_cursor: string | null;
}

/** Internal: normalise a caller's limit + parsed cursor. */
export function normalisePageArgs(opts: PaginateOptions): {
  pageSize: number;
  cursor: CursorPayload | null;
} {
  const max = opts.maxLimit ?? MAX_LIMIT;
  const def = opts.defaultLimit ?? DEFAULT_LIMIT;
  const rawLimit = Number(opts.limit ?? def);
  const pageSize = Math.max(
    1,
    Math.min(max, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : def),
  );
  return { pageSize, cursor: decodeCursor(opts.cursor ?? null) };
}

/**
 * Generic cursor-pagination runner.
 *
 * `query` receives `{ pageSize, cursor }` and is expected to return up to
 * `pageSize + 1` rows ordered consistently with the cursor (caller's
 * responsibility — we can't enforce sort order here).  `paginate`:
 *
 *   - decodes the input cursor,
 *   - asks the query for `pageSize + 1` rows,
 *   - trims the overflow row and uses it as the "has more" signal,
 *   - encodes a `next_cursor` from the last row of the trimmed page using
 *     the supplied `getKey` function.
 *
 * Example:
 *
 *   const page = await paginate(
 *     ({ pageSize, cursor }) =>
 *       col
 *         .find({ ...filter, ...(cursor ? { _id: { $lt: new ObjectId(cursor.id) } } : {}) })
 *         .sort({ _id: -1 })
 *         .limit(pageSize + 1)
 *         .toArray(),
 *     { limit, cursor: rawCursor, getKey: (doc) => doc._id.toHexString() },
 *   );
 */
export async function paginate<T>(
  query: (args: { pageSize: number; cursor: CursorPayload | null }) => Promise<T[]>,
  opts: PaginateOptions & {
    /** Project a row to a stable boundary id for the next cursor. */
    getKey: (row: T) => string;
    /** Optional: project a row to its sort timestamp (unix ms). */
    getTs?: (row: T) => number | undefined;
  },
): Promise<PageResult<T>> {
  const { pageSize, cursor } = normalisePageArgs(opts);
  const fetched = await query({ pageSize, cursor });

  const hasMore = fetched.length > pageSize;
  const page = hasMore ? fetched.slice(0, pageSize) : fetched;
  let next: string | null = null;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1];
    next = encodeCursor({
      id: opts.getKey(last),
      ts: opts.getTs ? opts.getTs(last) : undefined,
      dir: 'next',
    });
  }

  return { data: page, next_cursor: next };
}
