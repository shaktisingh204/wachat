/**
 * Audit log helpers.
 *
 * Wraps the `sabwa_audit_log` collection. Two surface areas:
 *
 *   - `recordAudit(state, entry)` — fire-and-forget insert used by every
 *     mutation handler across the service. Failures are logged but never
 *     thrown so an audit outage cannot break user-facing writes.
 *   - `listAudit(state, query)` — paginated reverse-chronological listing,
 *     used by `/v1/audit`. Cursor is opaque (base64 of `<ts>:<_id>`).
 *
 * The on-disk shape mirrors `SabwaAuditLog` in `src/lib/sabwa/types.ts`.
 */

import { Collection, ObjectId, type Db, type Filter } from 'mongodb';
import type { AppState } from '../state.js';

/** Persisted audit document. */
export interface AuditDoc {
  _id: ObjectId;
  projectId: ObjectId;
  sessionId?: ObjectId;
  actorId?: ObjectId;
  actorEmail?: string;
  action: string;
  /** Free-form target kind (e.g. `webhook`, `auto_reply`). */
  targetKind?: string;
  /** Free-form target id, usually a stringified ObjectId. */
  targetId?: string;
  target?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  ts: Date;
}

/** Wire shape returned by `GET /v1/audit`. */
export interface AuditWire {
  id: string;
  projectId: string;
  sessionId?: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  targetKind?: string;
  targetId?: string;
  target?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  ts: string;
}

export interface RecordAuditInput {
  projectId: string | ObjectId;
  sessionId?: string | ObjectId | null;
  userId?: string | ObjectId | null;
  actorEmail?: string;
  action: string;
  targetKind?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  actorIp?: string;
  userAgent?: string;
}

export interface ListAuditQuery {
  projectId: string;
  from?: Date;
  to?: Date;
  actor?: string;
  action?: string;
  cursor?: string;
  limit?: number;
}

export interface ListAuditResult {
  entries: AuditWire[];
  nextCursor?: string;
}

const COLL = 'sabwa_audit_log';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function coll(db: Db): Collection<AuditDoc> {
  return db.collection<AuditDoc>(COLL);
}

function toObjectIdOrUndef(v: string | ObjectId | null | undefined): ObjectId | undefined {
  if (!v) return undefined;
  if (v instanceof ObjectId) return v;
  if (!ObjectId.isValid(v)) return undefined;
  return new ObjectId(v);
}

function toWire(doc: AuditDoc): AuditWire {
  return {
    id: doc._id.toHexString(),
    projectId: doc.projectId.toHexString(),
    sessionId: doc.sessionId?.toHexString(),
    actorId: doc.actorId?.toHexString(),
    actorEmail: doc.actorEmail,
    action: doc.action,
    targetKind: doc.targetKind,
    targetId: doc.targetId,
    target: doc.target,
    metadata: doc.metadata,
    ip: doc.ip,
    userAgent: doc.userAgent,
    ts: doc.ts.toISOString(),
  };
}

function encodeCursor(ts: Date, id: ObjectId): string {
  return Buffer.from(`${ts.getTime()}:${id.toHexString()}`).toString('base64url');
}

function decodeCursor(raw: string): { ts: Date; id: ObjectId } | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const [tsRaw, idRaw] = decoded.split(':');
    if (!tsRaw || !idRaw || !ObjectId.isValid(idRaw)) return null;
    const ms = Number.parseInt(tsRaw, 10);
    if (!Number.isFinite(ms)) return null;
    return { ts: new Date(ms), id: new ObjectId(idRaw) };
  } catch {
    return null;
  }
}

/**
 * Persist a single audit log entry. Errors are swallowed (logged) — the
 * caller's mutation must not fail because audit write failed.
 */
export async function recordAudit(state: AppState, input: RecordAuditInput): Promise<void> {
  try {
    const projectId = toObjectIdOrUndef(input.projectId);
    if (!projectId) return; // invalid project id — nothing useful to record
    const doc: AuditDoc = {
      _id: new ObjectId(),
      projectId,
      action: input.action,
      ts: new Date(),
    };
    const sessionId = toObjectIdOrUndef(input.sessionId);
    if (sessionId) doc.sessionId = sessionId;
    const actorId = toObjectIdOrUndef(input.userId);
    if (actorId) doc.actorId = actorId;
    if (input.actorEmail) doc.actorEmail = input.actorEmail;
    if (input.targetKind) doc.targetKind = input.targetKind;
    if (input.targetId) doc.targetId = input.targetId;
    if (input.targetKind || input.targetId) {
      doc.target = [input.targetKind, input.targetId].filter(Boolean).join(':');
    }
    if (input.metadata) doc.metadata = input.metadata;
    if (input.actorIp) doc.ip = input.actorIp;
    if (input.userAgent) doc.userAgent = input.userAgent;
    await coll(state.db).insertOne(doc);
  } catch (err) {
    state.log.warn({ err, action: input.action }, 'audit write failed');
  }
}

/** Paginated reverse-chronological audit listing for `/v1/audit`. */
export async function listAudit(
  state: AppState,
  q: ListAuditQuery,
): Promise<ListAuditResult> {
  if (!ObjectId.isValid(q.projectId)) {
    return { entries: [] };
  }
  const limit = Math.min(Math.max(q.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const filter: Filter<AuditDoc> = {
    projectId: new ObjectId(q.projectId),
  };
  if (q.from || q.to) {
    const tsFilter: Record<string, Date> = {};
    if (q.from) tsFilter.$gte = q.from;
    if (q.to) tsFilter.$lte = q.to;
    filter.ts = tsFilter as Filter<AuditDoc>['ts'];
  }
  if (q.actor && ObjectId.isValid(q.actor)) {
    filter.actorId = new ObjectId(q.actor);
  }
  if (q.action && q.action.trim().length > 0) {
    filter.action = q.action;
  }
  if (q.cursor) {
    const c = decodeCursor(q.cursor);
    if (c) {
      // Reverse-chronological — give me docs strictly older than the cursor.
      filter.$or = [
        { ts: { $lt: c.ts } },
        { ts: c.ts, _id: { $lt: c.id } },
      ];
    }
  }

  const docs = await coll(state.db)
    .find(filter)
    .sort({ ts: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const out: ListAuditResult = { entries: page.map(toWire) };
  if (hasMore) {
    const last = page[page.length - 1];
    if (last) out.nextCursor = encodeCursor(last.ts, last._id);
  }
  return out;
}
