"use server";

/**
 * SabSMS segment builder — server actions.
 *
 * Powers the `/sabsms/segments/new` page (feature surface listed in the
 * SabSMS catalog under §B.3 page 19). The route owns:
 *
 *   - live count preview (debounced)
 *   - sample matching contacts (top 10)
 *   - save as static / dynamic
 *   - test predicate against a single phone
 *   - cost forecast
 *   - sharing tokens
 *   - prior-version diff
 *
 * Every action revalidates the workspace and bounces unauthorised
 * callers with the `unauthorized` error code.
 */

import { ObjectId, type Filter } from "mongodb";
import { randomBytes } from "node:crypto";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  sabsmsEngine,
  SabsmsEngineError,
} from "@/lib/sabsms/engine-client";
import type { SabsmsMessageCategory } from "@/lib/sabsms/types";

import {
  evaluatePredicate,
  type SegmentContact,
  type SegmentNode,
} from "./evaluate";
import {
  validateDraftForSave as validateDraftForSaveImpl,
  type SegmentBuilderDraft as SegmentBuilderDraftType,
} from "./types";

// Re-export the pure validator + draft type from `./types.ts` so client
// code can keep importing them from `./actions`. Keeping the impl in
// `./types.ts` lets the unit tests dodge `server-only`.
const validateDraftForSave = validateDraftForSaveImpl;
export type SegmentBuilderDraft = SegmentBuilderDraftType;

const SEGMENTS_COLLECTION = "sabsms_segments";

type ActionOk<T> = { ok: true } & T;
type ActionErr = { ok: false; error: string; issues?: string[] };
export type ActionResult<T> = ActionOk<T> | ActionErr;

interface SavedSegmentDoc {
  _id?: ObjectId;
  workspaceId: string;
  name: string;
  description?: string;
  kind: "static" | "dynamic";
  predicate: SegmentNode | null;
  contactIds?: string[];
  size?: number;
  lastRefreshedAt?: Date;
  autoRefreshSeconds?: number;
  tags?: string[];
  archived?: boolean;
  category?: SabsmsMessageCategory;
  shareToken?: string;
  /** Tiny history ring (last 5 versions) used by the diff drawer. */
  versions?: Array<{
    at: Date;
    predicate: SegmentNode | null;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

async function resolveWorkspace(): Promise<
  | { ok: true; workspaceId: string; userId: string }
  | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId), userId: String(userId) };
}

async function fetchContacts(workspaceId: string, limit = 50000): Promise<SegmentContact[]> {
  const { db } = await connectToDatabase();
  return db
    .collection<SegmentContact>("sabsms_contacts")
    .find({ workspaceId } as Filter<SegmentContact>)
    .limit(limit)
    .toArray()
    .catch(() => []);
}

// ─── Live count preview (feature 3) ───────────────────────────────────────

export async function previewCount(
  predicate: SegmentNode | null,
): Promise<ActionResult<{ matched: number; scanned: number }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  try {
    const contacts = await fetchContacts(ws.workspaceId);
    let matched = 0;
    for (const c of contacts) {
      if (evaluatePredicate(predicate, c)) matched++;
    }
    return { ok: true, matched, scanned: contacts.length };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "previewCount failed",
    };
  }
}

// ─── Sample matching contacts (feature 4) ─────────────────────────────────

export interface SampleContact {
  id: string;
  phone: string;
  country?: string;
  tags?: string[];
}

export async function previewSample(
  predicate: SegmentNode | null,
  limit = 10,
): Promise<ActionResult<{ rows: SampleContact[] }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  try {
    const contacts = await fetchContacts(ws.workspaceId);
    const rows: SampleContact[] = [];
    for (const c of contacts) {
      if (!evaluatePredicate(predicate, c)) continue;
      rows.push({
        id: String((c as { _id?: unknown })._id ?? ""),
        phone: (c.e164 ?? c.phone ?? "").trim(),
        country: c.country,
        tags: c.tags,
      });
      if (rows.length >= limit) break;
    }
    return { ok: true, rows };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "previewSample failed",
    };
  }
}

// ─── Save (features 5, 6, 7, 13, 20) ──────────────────────────────────────

export async function saveSegment(
  draft: SegmentBuilderDraft,
): Promise<ActionResult<{ id: string; size: number }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const issues = validateDraftForSave(draft);
  if (issues.length > 0) {
    return {
      ok: false,
      error: "Validation failed.",
      issues: issues.map((i) => `${i.field}: ${i.message}`),
    };
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<SavedSegmentDoc>(SEGMENTS_COLLECTION);
    const now = new Date();

    // Materialise membership for static segments (Page 19 feature 5).
    let contactIds: string[] | undefined;
    let size = 0;
    const contacts = await fetchContacts(ws.workspaceId);
    if (draft.kind === "static") {
      const matching = contacts.filter((c) =>
        evaluatePredicate(draft.predicate, c),
      );
      contactIds = matching.map((c) => String((c as { _id?: unknown })._id ?? ""));
      size = matching.length;
    } else {
      size = contacts.filter((c) => evaluatePredicate(draft.predicate, c)).length;
    }

    if (draft.id && ObjectId.isValid(draft.id)) {
      // Preserve a small version history for the diff drawer.
      const prior = await col.findOne({
        _id: new ObjectId(draft.id),
        workspaceId: ws.workspaceId,
      });
      const versions = (prior?.versions ?? []).slice(-4);
      if (prior) {
        versions.push({ at: now, predicate: prior.predicate, note: "save" });
      }

      await col.updateOne(
        { _id: new ObjectId(draft.id), workspaceId: ws.workspaceId },
        {
          $set: {
            name: draft.name.trim(),
            description: draft.description?.trim(),
            kind: draft.kind,
            predicate: draft.predicate,
            contactIds,
            size,
            autoRefreshSeconds: draft.autoRefreshSeconds,
            tags: draft.tags,
            category: draft.category,
            updatedAt: now,
            lastRefreshedAt: now,
            versions,
          },
        },
      );
      await logAudit(ws.workspaceId, "segment.save", draft.id, {
        kind: draft.kind,
        size,
      });
      return { ok: true, id: draft.id, size };
    }

    const doc: Omit<SavedSegmentDoc, "_id"> = {
      workspaceId: ws.workspaceId,
      name: draft.name.trim(),
      description: draft.description?.trim(),
      kind: draft.kind,
      predicate: draft.predicate,
      contactIds,
      size,
      autoRefreshSeconds: draft.autoRefreshSeconds,
      tags: draft.tags,
      category: draft.category,
      createdAt: now,
      updatedAt: now,
      lastRefreshedAt: now,
      createdBy: ws.userId,
      versions: [],
    };
    const res = await col.insertOne(doc as SavedSegmentDoc);
    await logAudit(ws.workspaceId, "segment.create", res.insertedId.toHexString(), {
      kind: draft.kind,
      size,
      category: draft.category,
    });
    return { ok: true, id: res.insertedId.toHexString(), size };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "saveSegment failed",
    };
  }
}

// ─── Test predicate against a single phone (feature 10) ───────────────────

export async function testPredicateAgainstPhone(
  predicate: SegmentNode | null,
  phone: string,
): Promise<
  ActionResult<{
    matched: boolean;
    contactFound: boolean;
    contact?: SampleContact;
  }>
> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!phone.trim()) return { ok: false, error: "Phone is required." };
  try {
    const { db } = await connectToDatabase();
    const c = await db
      .collection<SegmentContact>("sabsms_contacts")
      .findOne({
        workspaceId: ws.workspaceId,
        $or: [{ e164: phone.trim() }, { phone: phone.trim() }],
      });
    if (!c) {
      // Still allow the user to test against a synthetic contact —
      // helpful when the predicate uses only e164_prefix.
      const synthetic: SegmentContact = { phone: phone.trim() };
      return {
        ok: true,
        matched: evaluatePredicate(predicate, synthetic),
        contactFound: false,
      };
    }
    return {
      ok: true,
      matched: evaluatePredicate(predicate, c),
      contactFound: true,
      contact: {
        id: String((c as { _id?: unknown })._id ?? ""),
        phone: (c.e164 ?? c.phone ?? "").trim(),
        country: c.country,
        tags: c.tags,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "testPredicateAgainstPhone failed",
    };
  }
}

// ─── Import predicates from another segment (feature 8) ───────────────────

export async function loadSegmentPredicate(
  segmentId: string,
): Promise<ActionResult<{ predicate: SegmentNode | null; name: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection<SavedSegmentDoc>(SEGMENTS_COLLECTION)
      .findOne({
        _id: new ObjectId(segmentId),
        workspaceId: ws.workspaceId,
      });
    if (!doc) return { ok: false, error: "Segment not found." };
    return { ok: true, predicate: doc.predicate, name: doc.name };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "loadSegmentPredicate failed",
    };
  }
}

// ─── Share token (feature 16) ─────────────────────────────────────────────

export async function mintShareToken(
  segmentId: string,
): Promise<ActionResult<{ token: string; shareUrl: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(segmentId)) {
    return { ok: false, error: "Invalid segment id." };
  }
  try {
    const { db } = await connectToDatabase();
    const token = randomBytes(16).toString("hex");
    await db.collection<SavedSegmentDoc>(SEGMENTS_COLLECTION).updateOne(
      { _id: new ObjectId(segmentId), workspaceId: ws.workspaceId },
      { $set: { shareToken: token, updatedAt: new Date() } },
    );
    return {
      ok: true,
      token,
      shareUrl: `/sabsms/segments/share/${token}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "mintShareToken failed",
    };
  }
}

// ─── Diff vs prior version (feature 17) ───────────────────────────────────

export async function loadPriorVersions(
  segmentId: string,
): Promise<
  ActionResult<{
    versions: Array<{ at: string; predicate: SegmentNode | null; note?: string }>;
    current: SegmentNode | null;
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
      .collection<SavedSegmentDoc>(SEGMENTS_COLLECTION)
      .findOne({
        _id: new ObjectId(segmentId),
        workspaceId: ws.workspaceId,
      });
    if (!doc) return { ok: false, error: "Segment not found." };
    return {
      ok: true,
      versions: (doc.versions ?? []).map((v) => ({
        at: v.at instanceof Date ? v.at.toISOString() : String(v.at),
        predicate: v.predicate,
        note: v.note,
      })),
      current: doc.predicate,
    };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "loadPriorVersions failed",
    };
  }
}

// ─── Cost forecast (feature 14) ───────────────────────────────────────────

export async function forecastCost(
  predicate: SegmentNode | null,
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
  try {
    const contacts = await fetchContacts(ws.workspaceId);
    const size = contacts.filter((c) => evaluatePredicate(predicate, c)).length;
    const price =
      pricePerMessageCents ??
      parseInt(process.env.SABSMS_DEFAULT_PRICE_CENTS ?? "1", 10);
    return {
      ok: true,
      size,
      pricePerMessageCents: price,
      totalCents: size * price,
    };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "forecastCost failed",
    };
  }
}

// ─── AI build (feature 12, stub) ──────────────────────────────────────────

/**
 * "Build segment from prompt" — stubbed until the SabSMS LLM gateway
 * lands. We return a benign predicate (`country IN (US)`) so the
 * builder still updates and the UI flow can be tested.
 */
export async function aiBuildFromPrompt(
  prompt: string,
): Promise<ActionResult<{ predicate: SegmentNode; note: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!prompt.trim()) {
    return { ok: false, error: "Prompt is required." };
  }
  // Pure stub — no LLM call. Match the AST shape so the builder can
  // diff the new predicate against whatever was on screen.
  const predicate: SegmentNode = {
    kind: "group",
    op: "and",
    children: [
      { kind: "leaf", field: "country", op: "eq", value: "US" },
      { kind: "leaf", field: "unsubscribed", op: "eq", value: false },
    ],
  };
  return {
    ok: true,
    predicate,
    note: `AI: ${prompt.slice(0, 80)} (stub — wire up SabSMS LLM gateway in Phase 4)`,
  };
}

// ─── Engine probe — used by the cost forecast tooltip ─────────────────────

export async function engineHealthProbe(): Promise<
  ActionResult<{ reachable: boolean; detail?: string }>
> {
  try {
    await sabsmsEngine.health();
    return { ok: true, reachable: true };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: true, reachable: false, detail: `${e.status} ${e.message}` };
    }
    return {
      ok: true,
      reachable: false,
      detail: (e as Error)?.message ?? "unreachable",
    };
  }
}

// ─── Audit ────────────────────────────────────────────────────────────────

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
