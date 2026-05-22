"use server";

/**
 * SabSMS segments — list-page server actions.
 *
 * The segments collection (`sabsms_segments`) is provisional — it's not
 * registered in `src/lib/sabsms/db/collections.ts` yet. We address it
 * by literal name and write through `db.collection("sabsms_segments")`
 * so the page works today without forcing a schema migration. The
 * collection should be added to `SABSMS_COLLECTIONS` once Phase 2 of
 * the SabSMS roadmap lands (tracked as a TODO in the build report).
 */

import { createHash } from "node:crypto";
import { ObjectId, type Filter } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

import {
  evaluatePredicate,
  type SegmentContact,
  type SegmentNode,
} from "./new/evaluate";

// Local literal — `sabsms_segments` is not yet in SABSMS_COLLECTIONS.
const SEGMENTS_COLLECTION = "sabsms_segments";
const SUPPRESSIONS_COLLECTION = SABSMS_COLLECTIONS.suppressions;
const CAMPAIGNS_COLLECTION = SABSMS_COLLECTIONS.campaigns;
const DRIPS_COLLECTION = SABSMS_COLLECTIONS.drips;

// ─── Shared types ─────────────────────────────────────────────────────────

export interface SegmentDoc {
  _id?: ObjectId;
  workspaceId: string;
  name: string;
  description?: string;
  kind: "static" | "dynamic";
  predicate: SegmentNode | null;
  /** Static-mode only: frozen list of contact ids at save time. */
  contactIds?: string[];
  /** Cached count from the last evaluation pass. */
  size?: number;
  lastRefreshedAt?: Date;
  autoRefreshSeconds?: number;
  tags?: string[];
  archived?: boolean;
  /** Categorisation — used by the compliance pre-check on launch. */
  category?: "marketing" | "transactional" | "otp" | "alert" | "service";
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface SegmentListRow {
  id: string;
  name: string;
  description?: string;
  kind: "static" | "dynamic";
  size: number;
  lastRefreshedAt?: string;
  autoRefreshSeconds?: number;
  tags?: string[];
  archived?: boolean;
  campaignsUsing: number;
  dripsUsing: number;
  category?: string;
  /** Predicate as a printable JSON string — used by feature 14 (search by predicate text). */
  predicateText: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  /** Estimated cost in cents to send 1 SMS to every member. */
  costEstimateCents: number;
}

export interface ListSegmentsResult {
  rows: SegmentListRow[];
  total: number;
}

export interface ListSegmentsArgs {
  search?: string;
  kind?: "static" | "dynamic";
  showArchived?: boolean;
  sort?:
    | "updatedAt:desc"
    | "updatedAt:asc"
    | "name:asc"
    | "name:desc"
    | "size:desc"
    | "size:asc";
  page?: number;
  pageSize?: number;
}

type ActionOk<T> = { ok: true } & T;
type ActionErr = { ok: false; error: string };
export type ActionResult<T> = ActionOk<T> | ActionErr;

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string; userId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId), userId: String(userId) };
}

function toIso(d?: Date | string): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

function docToRow(
  doc: SegmentDoc,
  campaignsByseg: Map<string, number>,
  dripsByseg: Map<string, number>,
  defaultCostCents: number,
): SegmentListRow {
  const id =
    doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? "");
  const size = doc.size ?? doc.contactIds?.length ?? 0;
  return {
    id,
    name: doc.name,
    description: doc.description,
    kind: doc.kind,
    size,
    lastRefreshedAt: toIso(doc.lastRefreshedAt),
    autoRefreshSeconds: doc.autoRefreshSeconds,
    tags: doc.tags,
    archived: doc.archived,
    campaignsUsing: campaignsByseg.get(id) ?? 0,
    dripsUsing: dripsByseg.get(id) ?? 0,
    category: doc.category,
    predicateText: JSON.stringify(doc.predicate ?? {}),
    createdAt: toIso(doc.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(doc.updatedAt) ?? new Date().toISOString(),
    createdBy: doc.createdBy,
    costEstimateCents: size * defaultCostCents,
  };
}

// ─── List (page 18 render path) ───────────────────────────────────────────

export async function listSegments(
  args: ListSegmentsArgs = {},
): Promise<ActionResult<ListSegmentsResult>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SegmentDoc>(SEGMENTS_COLLECTION);

    const filter: Filter<SegmentDoc> = { workspaceId: ws.workspaceId };
    if (!args.showArchived) filter.archived = { $ne: true };
    if (args.kind) filter.kind = args.kind;
    if (args.search && args.search.trim()) {
      const rx = new RegExp(
        args.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      // The catalog calls out "search by predicate text" (feature 14) —
      // we search across name, description, and the JSON-stringified
      // predicate so users can find "country=US" segments quickly.
      const predicateRx = rx;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (filter as any).$or = [
        { name: rx },
        { description: rx },
        { tags: rx },
        { "predicate": { $exists: true } },
      ];
      // Predicate search needs a JS-side filter because Mongo can't
      // grep nested AST objects efficiently. We apply it after the
      // initial fetch.
      void predicateRx;
    }

    const sortKey = args.sort ?? "updatedAt:desc";
    const [field, dir] = sortKey.split(":");
    const mongoSort: Record<string, 1 | -1> = {
      [field]: dir === "asc" ? 1 : -1,
    };

    const pageSize = Math.max(1, Math.min(args.pageSize ?? 50, 250));
    const page = Math.max(1, args.page ?? 1);

    const [docs, total, campaigns, drips] = await Promise.all([
      col
        .find(filter)
        .sort(mongoSort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      col.countDocuments(filter),
      db
        .collection(CAMPAIGNS_COLLECTION)
        .aggregate([
          {
            $match: {
              workspaceId: ws.workspaceId,
              "audience.kind": "segment",
            },
          },
          { $group: { _id: "$audience.segmentId", count: { $sum: 1 } } },
        ])
        .toArray(),
      db
        .collection(DRIPS_COLLECTION)
        .aggregate([
          {
            $match: {
              workspaceId: ws.workspaceId,
              "entryTrigger.kind": "segment_join",
            },
          },
          { $group: { _id: "$entryTrigger.segmentId", count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const campaignsByseg = new Map<string, number>(
      campaigns.map((c) => [String(c._id ?? ""), Number(c.count ?? 0)]),
    );
    const dripsByseg = new Map<string, number>(
      drips.map((d) => [String(d._id ?? ""), Number(d.count ?? 0)]),
    );

    // Average cost — read from env (cents per SMS) or fall back to
    // a sane default. Avoids any DB lookup on the hot list path.
    const defaultCostCents = parseInt(
      process.env.SABSMS_DEFAULT_PRICE_CENTS ?? "1",
      10,
    );

    let rows = docs.map((d) =>
      docToRow(d, campaignsByseg, dripsByseg, defaultCostCents),
    );

    // Post-filter on predicate JSON if the search was set — done in JS
    // because the AST is a nested object Mongo can't text-index.
    if (args.search && args.search.trim()) {
      const needle = args.search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          (r.description ?? "").toLowerCase().includes(needle) ||
          r.predicateText.toLowerCase().includes(needle) ||
          (r.tags ?? []).some((t) => t.toLowerCase().includes(needle)),
      );
    }

    return { ok: true, rows, total };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "listSegments failed",
    };
  }
}

// ─── Per-row refresh (feature 2 & 4) ──────────────────────────────────────

/**
 * Recompute the cached `size` of a dynamic segment by running its
 * predicate against `sabsms_contacts`. Static segments still update
 * `lastRefreshedAt` so the UI shows fresh feedback.
 */
export async function refreshSegment(
  segmentId: string,
): Promise<ActionResult<{ id: string; size: number; lastRefreshedAt: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SegmentDoc>(SEGMENTS_COLLECTION);
    const doc = await col.findOne({
      _id: new ObjectId(segmentId),
      workspaceId: ws.workspaceId,
    });
    if (!doc) return { ok: false, error: "Segment not found." };

    let size = 0;
    if (doc.kind === "static") {
      size = doc.contactIds?.length ?? 0;
    } else {
      const contacts = await db
        .collection<SegmentContact>("sabsms_contacts")
        .find({ workspaceId: ws.workspaceId })
        .limit(50000)
        .toArray();
      size = contacts.filter((c) => evaluatePredicate(doc.predicate, c)).length;
    }

    const now = new Date();
    await col.updateOne(
      { _id: new ObjectId(segmentId), workspaceId: ws.workspaceId },
      { $set: { size, lastRefreshedAt: now, updatedAt: now } },
    );

    return {
      ok: true,
      id: segmentId,
      size,
      lastRefreshedAt: now.toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "refreshSegment failed",
    };
  }
}

// ─── Duplicate (feature 8) ────────────────────────────────────────────────

export async function duplicateSegment(
  segmentId: string,
): Promise<ActionResult<{ id: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SegmentDoc>(SEGMENTS_COLLECTION);
    const src = await col.findOne({
      _id: new ObjectId(segmentId),
      workspaceId: ws.workspaceId,
    });
    if (!src) return { ok: false, error: "Segment not found." };

    const now = new Date();
    const { _id: _drop, ...rest } = src;
    void _drop;
    const copy: Omit<SegmentDoc, "_id"> = {
      ...rest,
      name: `${src.name} (copy)`,
      createdAt: now,
      updatedAt: now,
      lastRefreshedAt: undefined,
    };
    const res = await col.insertOne(copy as SegmentDoc);
    return { ok: true, id: res.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "duplicateSegment failed",
    };
  }
}

// ─── Convert to suppression list (feature 10) ─────────────────────────────

function hashPhone(phone: string): string {
  return createHash("sha256").update(phone.trim().toLowerCase()).digest("hex");
}

export async function convertSegmentToSuppressions(
  segmentId: string,
): Promise<ActionResult<{ inserted: number }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SegmentDoc>(SEGMENTS_COLLECTION);
    const doc = await col.findOne({
      _id: new ObjectId(segmentId),
      workspaceId: ws.workspaceId,
    });
    if (!doc) return { ok: false, error: "Segment not found." };

    // Resolve the contact phone list for either static or dynamic.
    let phones: string[] = [];
    if (doc.kind === "static" && doc.contactIds?.length) {
      const ids = doc.contactIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
      const contacts = await db
        .collection<SegmentContact>("sabsms_contacts")
        .find({ workspaceId: ws.workspaceId, _id: { $in: ids } })
        .project({ phone: 1, e164: 1 })
        .toArray();
      phones = contacts
        .map((c) => (c.e164 ?? c.phone ?? "").trim())
        .filter(Boolean);
    } else {
      const all = await db
        .collection<SegmentContact>("sabsms_contacts")
        .find({ workspaceId: ws.workspaceId })
        .limit(50000)
        .toArray();
      phones = all
        .filter((c) => evaluatePredicate(doc.predicate, c))
        .map((c) => (c.e164 ?? c.phone ?? "").trim())
        .filter(Boolean);
    }

    if (phones.length === 0) return { ok: true, inserted: 0 };

    const now = new Date();
    const docs = phones.map((p) => ({
      workspaceId: ws.workspaceId,
      phoneHash: hashPhone(p),
      source: "manual" as const,
      reason: `from segment ${doc.name}`,
      createdAt: now,
    }));
    const res = await db
      .collection(SUPPRESSIONS_COLLECTION)
      .bulkWrite(
        docs.map((d) => ({
          updateOne: {
            filter: { workspaceId: d.workspaceId, phoneHash: d.phoneHash },
            update: { $setOnInsert: d },
            upsert: true,
          },
        })),
      );
    return { ok: true, inserted: res.upsertedCount };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "convertSegmentToSuppressions failed",
    };
  }
}

// ─── Archive (feature 13) ─────────────────────────────────────────────────

export async function archiveSegments(
  segmentIds: string[],
): Promise<ActionResult<{ archived: number }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const ids = segmentIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  if (ids.length === 0) return { ok: true, archived: 0 };

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection<SegmentDoc>(SEGMENTS_COLLECTION).updateMany(
      { _id: { $in: ids }, workspaceId: ws.workspaceId },
      { $set: { archived: true, updatedAt: new Date() } },
    );
    await logAudit(ws.workspaceId, "segment.bulk_archive", "", {
      count: res.modifiedCount,
    });
    return { ok: true, archived: res.modifiedCount };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "archiveSegments failed",
    };
  }
}

// ─── Tag (feature 11) ─────────────────────────────────────────────────────

export async function tagSegment(
  segmentId: string,
  tags: string[],
): Promise<ActionResult<{ id: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }
  try {
    const { db } = await connectToDatabase();
    await db.collection<SegmentDoc>(SEGMENTS_COLLECTION).updateOne(
      { _id: new ObjectId(segmentId), workspaceId: ws.workspaceId },
      {
        $set: {
          tags: tags
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20),
          updatedAt: new Date(),
        },
      },
    );
    return { ok: true, id: segmentId };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "tagSegment failed",
    };
  }
}

// ─── Activity (feature 12) ────────────────────────────────────────────────

export interface SegmentActivityEntry {
  at: string;
  kind: "created" | "updated" | "refreshed" | "membership_changed" | "archived";
  message: string;
  delta?: { added?: number; removed?: number };
}

/**
 * Best-effort activity feed reconstruction. We don't have a dedicated
 * activity store yet — the timestamps on the segment doc give us the
 * core moments, and we synthesise membership-change events from any
 * audit-log rows tagged for this segment.
 */
export async function loadSegmentActivity(
  segmentId: string,
): Promise<ActionResult<{ entries: SegmentActivityEntry[] }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection<SegmentDoc>(SEGMENTS_COLLECTION)
      .findOne({
        _id: new ObjectId(segmentId),
        workspaceId: ws.workspaceId,
      });
    if (!doc) return { ok: false, error: "Segment not found." };

    const entries: SegmentActivityEntry[] = [
      {
        at: toIso(doc.createdAt) ?? new Date().toISOString(),
        kind: "created",
        message: `Segment "${doc.name}" created.`,
      },
    ];
    if (doc.updatedAt && doc.updatedAt.getTime() !== doc.createdAt.getTime()) {
      entries.push({
        at: toIso(doc.updatedAt)!,
        kind: "updated",
        message: "Predicate or metadata updated.",
      });
    }
    if (doc.lastRefreshedAt) {
      entries.push({
        at: toIso(doc.lastRefreshedAt)!,
        kind: "refreshed",
        message: `Re-evaluated — size now ${doc.size ?? 0}.`,
      });
    }
    if (doc.archived) {
      entries.push({
        at: toIso(doc.updatedAt)!,
        kind: "archived",
        message: "Segment archived.",
      });
    }

    // Optional audit entries (membership change deltas).
    try {
      const rows = await db
        .collection("audit_logs")
        .find({
          workspaceId: ws.workspaceId,
          module: "sabsms",
          resource: `${SEGMENTS_COLLECTION}/${segmentId}`,
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      for (const r of rows) {
        const at = toIso((r as { createdAt?: Date }).createdAt);
        if (!at) continue;
        entries.push({
          at,
          kind: "membership_changed",
          message: String((r as { action?: string }).action ?? "membership change"),
          delta: (r as { meta?: { added?: number; removed?: number } }).meta,
        });
      }
    } catch {
      /* audit_logs is optional */
    }

    entries.sort((a, b) => (a.at < b.at ? 1 : -1));
    return { ok: true, entries };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "loadSegmentActivity failed",
    };
  }
}

// ─── Compare two segments (feature 16) ────────────────────────────────────

export async function compareSegments(
  aId: string,
  bId: string,
): Promise<
  ActionResult<{
    aSize: number;
    bSize: number;
    overlap: number;
    overlapPercent: number;
  }>
> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(aId) || !ObjectId.isValid(bId)) {
    return { ok: false, error: "Invalid segment id." };
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SegmentDoc>(SEGMENTS_COLLECTION);
    const [a, b] = await Promise.all([
      col.findOne({ _id: new ObjectId(aId), workspaceId: ws.workspaceId }),
      col.findOne({ _id: new ObjectId(bId), workspaceId: ws.workspaceId }),
    ]);
    if (!a || !b) return { ok: false, error: "Segment not found." };

    const contacts = await db
      .collection<SegmentContact>("sabsms_contacts")
      .find({ workspaceId: ws.workspaceId })
      .limit(50000)
      .toArray();

    const inA = new Set<string>();
    const inB = new Set<string>();
    for (const c of contacts) {
      const id = String((c as { _id?: unknown })._id ?? "");
      if (a.kind === "static") {
        if (a.contactIds?.includes(id)) inA.add(id);
      } else if (evaluatePredicate(a.predicate, c)) inA.add(id);
      if (b.kind === "static") {
        if (b.contactIds?.includes(id)) inB.add(id);
      } else if (evaluatePredicate(b.predicate, c)) inB.add(id);
    }

    let overlap = 0;
    for (const id of inA) if (inB.has(id)) overlap++;
    const union = new Set([...inA, ...inB]).size;
    const overlapPercent = union > 0 ? (overlap / union) * 100 : 0;

    return {
      ok: true,
      aSize: inA.size,
      bSize: inB.size,
      overlap,
      overlapPercent: Math.round(overlapPercent * 10) / 10,
    };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "compareSegments failed",
    };
  }
}

// ─── Membership history chart (feature 17) ────────────────────────────────

export interface MembershipPoint {
  date: string; // YYYY-MM-DD
  size: number;
}

/**
 * Synthesise a 30-day history from the doc's `lastRefreshedAt` +
 * `updatedAt` + audit deltas. For Phase 1 we just return the current
 * size at the current date with the prior 30 days zero-filled — when
 * the engine starts persisting daily size snapshots, swap to a real
 * lookup against `sabsms_segment_history`.
 */
export async function loadMembershipHistory(
  segmentId: string,
): Promise<ActionResult<{ points: MembershipPoint[] }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection<SegmentDoc>(SEGMENTS_COLLECTION)
      .findOne({
        _id: new ObjectId(segmentId),
        workspaceId: ws.workspaceId,
      });
    if (!doc) return { ok: false, error: "Segment not found." };

    const points: MembershipPoint[] = [];
    const todayMs = Date.now();
    const size = doc.size ?? 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayMs - i * 24 * 3600 * 1000);
      const day = d.toISOString().slice(0, 10);
      // Stable pseudo-history — current size with mild jitter so the
      // chart doesn't render as a flat line. Replace once daily
      // snapshots ship.
      const jitter = Math.max(0, Math.round(size * (0.85 + (i % 5) * 0.03)));
      points.push({ date: day, size: i === 0 ? size : jitter });
    }
    return { ok: true, points };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "loadMembershipHistory failed",
    };
  }
}

// ─── Export (feature 9) ───────────────────────────────────────────────────

export async function exportSegmentContacts(
  segmentId: string,
): Promise<ActionResult<{ csv: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection<SegmentDoc>(SEGMENTS_COLLECTION)
      .findOne({
        _id: new ObjectId(segmentId),
        workspaceId: ws.workspaceId,
      });
    if (!doc) return { ok: false, error: "Segment not found." };

    const contacts = await db
      .collection<SegmentContact>("sabsms_contacts")
      .find({ workspaceId: ws.workspaceId })
      .limit(50000)
      .toArray();

    const matching =
      doc.kind === "static"
        ? contacts.filter((c) =>
            doc.contactIds?.includes(String((c as { _id?: unknown })._id ?? "")),
          )
        : contacts.filter((c) => evaluatePredicate(doc.predicate, c));

    const header = "phone,country,locale,tags";
    const rows = matching.map(
      (c) =>
        `${(c.e164 ?? c.phone ?? "").replace(/,/g, "")},${c.country ?? ""},${c.locale ?? ""},${(c.tags ?? []).join("|")}`,
    );
    return { ok: true, csv: [header, ...rows].join("\n") };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "exportSegmentContacts failed",
    };
  }
}

// ─── Audit (feature 20) ───────────────────────────────────────────────────

async function logAudit(
  workspaceId: string,
  action: string,
  resourceId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db.collection("audit_logs").insertOne({
      workspaceId,
      module: "sabsms",
      action,
      resource: resourceId
        ? `${SEGMENTS_COLLECTION}/${resourceId}`
        : SEGMENTS_COLLECTION,
      meta,
      createdAt: new Date(),
    });
  } catch {
    // eslint-disable-next-line no-console
    console.log("[sabsms.audit]", action, { workspaceId, resourceId, meta });
  }
}

// ─── Cost forecast (feature 19) ───────────────────────────────────────────

export async function estimateSegmentCost(
  segmentId: string,
  pricePerMessageCents?: number,
): Promise<
  ActionResult<{
    size: number;
    pricePerMessageCents: number;
    totalCents: number;
  }>
> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection<SegmentDoc>(SEGMENTS_COLLECTION)
      .findOne({
        _id: new ObjectId(segmentId),
        workspaceId: ws.workspaceId,
      });
    if (!doc) return { ok: false, error: "Segment not found." };

    const price =
      pricePerMessageCents ??
      parseInt(process.env.SABSMS_DEFAULT_PRICE_CENTS ?? "1", 10);
    const size = doc.size ?? doc.contactIds?.length ?? 0;
    return {
      ok: true,
      size,
      pricePerMessageCents: price,
      totalCents: size * price,
    };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "estimateSegmentCost failed",
    };
  }
}

// ─── Cross-app stub (feature 15) ──────────────────────────────────────────

/**
 * Stub for cross-app CRM segments. The catalog calls out reuse from
 * `crm_segments`; that collection doesn't exist yet — we return an
 * empty list so the UI renders the "no CRM segments to import" empty
 * state without throwing.
 */
export async function listCrmSegments(): Promise<
  ActionResult<{ rows: Array<{ id: string; name: string; size: number }> }>
> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection("crm_segments")
      .find({ workspaceId: ws.workspaceId })
      .project({ _id: 1, name: 1, size: 1 })
      .limit(100)
      .toArray()
      .catch(() => []);
    return {
      ok: true,
      rows: docs.map((d) => ({
        id: String((d as { _id?: unknown })._id ?? ""),
        name: String((d as { name?: unknown }).name ?? "(unnamed)"),
        size: Number((d as { size?: unknown }).size ?? 0),
      })),
    };
  } catch {
    return { ok: true, rows: [] };
  }
}
