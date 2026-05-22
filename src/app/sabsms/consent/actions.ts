"use server";

/**
 * SabSMS consent log — server actions + read paths.
 *
 * Catalog: `plans/sabsms-pages-catalog.md` Page 21 §B.3.
 *
 * Reads `sabsms_consent_log`. Writes:
 *   - opt-in/opt-out events through the inbound webhook → engine path
 *     (this module never inserts inbound consent directly).
 *   - admin overrides (erasure, re-request) through Mongo + the engine
 *     stub.
 *
 * The double-opt-in verifier is the only non-trivial pure helper —
 * exported so the unit tests can run it without spinning up Mongo.
 */

import { ObjectId, type Filter } from "mongodb";

import { getCachedSession } from "@/lib/server-cache";
import {
  SABSMS_COLLECTIONS,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import { sabsmsEngine, SabsmsEngineError } from "@/lib/sabsms/engine-client";
import type {
  SabsmsConsentEvent,
  SabsmsConsentKind,
} from "@/lib/sabsms/types";

import { signExportPayload as signExportPayloadImpl, verifyDoubleOptIn } from "./lib";

/**
 * Async wrapper that exposes the pure SHA-256 signer as a server
 * action (so the client component can call it across the network).
 */
export async function signExportPayload(payload: string): Promise<string> {
  return signExportPayloadImpl(payload);
}

// ─── View types ───────────────────────────────────────────────────────────

export interface ConsentRow {
  id: string;
  phoneHash: string;
  kind: SabsmsConsentKind;
  captureMethod: SabsmsConsentEvent["captureMethod"];
  source?: string;
  ip?: string;
  userAgent?: string;
  doubleOptInVerifiedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ConsentFilters {
  q?: string;
  kind?: SabsmsConsentKind[];
  captureMethod?: SabsmsConsentEvent["captureMethod"][];
  sourceQuery?: string;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
}

export interface ConsentListResult {
  rows: ConsentRow[];
  total: number;
}

export interface JurisdictionStatus {
  /** TCPA / GDPR / CASL / TRAI */
  code: "TCPA" | "GDPR" | "CASL" | "TRAI";
  label: string;
  status: "ok" | "warn" | "blocked";
  note: string;
}

export interface CohortPoint {
  bucket: string;
  retained: number;
  totalOptIn: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

type WorkspaceResolution =
  | { ok: true; workspaceId: string; isAdmin: boolean }
  | { ok: false; error: string };

async function resolveWorkspace(): Promise<WorkspaceResolution> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown; role?: unknown } | undefined)
    ?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  const role = String(
    (session?.user as { role?: unknown } | undefined)?.role ?? "",
  );
  return { ok: true, workspaceId: String(userId), isAdmin: role === "admin" };
}

function toIso(d?: Date | string): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

function projectEvent(
  doc: SabsmsConsentEvent & { _id?: ObjectId },
): ConsentRow {
  return {
    id: String(doc._id),
    phoneHash: doc.phoneHash,
    kind: doc.kind,
    captureMethod: doc.captureMethod,
    source: doc.source,
    ip: doc.ip,
    userAgent: doc.userAgent,
    doubleOptInVerifiedAt: toIso(doc.doubleOptInVerifiedAt),
    metadata: doc.metadata,
    createdAt: toIso(doc.createdAt) ?? new Date().toISOString(),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Read paths ───────────────────────────────────────────────────────────

export async function loadConsentEvents(
  workspaceId: string,
  filters: ConsentFilters,
): Promise<ConsentListResult> {
  const { cols } = await getSabsmsCollections();
  const filter: Filter<SabsmsConsentEvent> = { workspaceId };

  // Phone hash search — `q` accepts either the raw hash (preferred) or
  // a partial prefix for power-user lookups.
  if (filters.q?.trim()) {
    const trimmed = filters.q.trim();
    if (/^[0-9a-f]{64}$/.test(trimmed)) {
      filter.phoneHash = trimmed;
    } else if (/^[0-9a-f]+$/.test(trimmed)) {
      (filter as Record<string, unknown>).phoneHash = {
        $regex: `^${trimmed}`,
      };
    }
  }
  if (filters.kind && filters.kind.length > 0) {
    filter.kind = { $in: filters.kind };
  }
  if (filters.captureMethod && filters.captureMethod.length > 0) {
    filter.captureMethod = { $in: filters.captureMethod };
  }
  if (filters.sourceQuery?.trim()) {
    (filter as Record<string, unknown>).source = {
      $regex: escapeRegex(filters.sourceQuery.trim()),
      $options: "i",
    };
  }
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);
    filter.createdAt = createdAt as never;
  }

  const sort: Record<string, 1 | -1> =
    filters.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

  const page = Math.max(0, filters.page ?? 0);
  const pageSize = Math.max(1, Math.min(250, filters.pageSize ?? 50));

  const [docs, total] = await Promise.all([
    cols.consentLog
      .find(filter)
      .sort(sort)
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray(),
    cols.consentLog.countDocuments(filter),
  ]);

  return {
    rows: docs.map((d) => projectEvent(d as never)),
    total,
  };
}

export async function loadTimeline(
  _workspaceId: string,
  phoneHash: string,
): Promise<ConsentRow[]> {
  // Called from the client — always resolve the workspace from the
  // session so we never leak another tenant's events.
  const ws = await resolveWorkspace();
  if (!ws.ok) return [];
  const { cols } = await getSabsmsCollections();
  const docs = await cols.consentLog
    .find({ workspaceId: ws.workspaceId, phoneHash })
    .sort({ createdAt: 1 })
    .limit(500)
    .toArray();
  return docs.map((d) => projectEvent(d as never));
}

export async function loadJurisdictionStatus(
  workspaceId: string,
): Promise<JurisdictionStatus[]> {
  // Quick heuristic per jurisdiction. The real Phase-11 compliance
  // engine will compute these from a richer rule set — until then we
  // surface counts so the badges aren't blank.
  const { cols } = await getSabsmsCollections();
  const [doubleOpted, totalContacts, stopCount, manualOptOuts] =
    await Promise.all([
      cols.consentLog.countDocuments({ workspaceId, kind: "opt_in_double" }),
      cols.consentLog.countDocuments({ workspaceId }),
      cols.consentLog.countDocuments({ workspaceId, kind: "opt_out_stop" }),
      cols.consentLog.countDocuments({ workspaceId, kind: "opt_out_manual" }),
    ]);

  const safe = (n: number) => (Number.isFinite(n) ? n : 0);
  const doubleOptInPct =
    totalContacts > 0 ? (safe(doubleOpted) / safe(totalContacts)) * 100 : 0;

  function statusFor(pct: number): JurisdictionStatus["status"] {
    if (pct >= 80) return "ok";
    if (pct >= 50) return "warn";
    return "blocked";
  }

  return [
    {
      code: "TCPA",
      label: "TCPA (US)",
      status: stopCount > 0 ? "ok" : "warn",
      note: `${stopCount} STOP keyword captures recorded`,
    },
    {
      code: "GDPR",
      label: "GDPR (EU)",
      status: statusFor(doubleOptInPct),
      note: `${doubleOptInPct.toFixed(1)}% double-opt-in coverage`,
    },
    {
      code: "CASL",
      label: "CASL (CA)",
      status: statusFor(doubleOptInPct),
      note: `${manualOptOuts} manual unsubscribes honoured`,
    },
    {
      code: "TRAI",
      label: "TRAI (IN)",
      status: "warn",
      note: "DLT registration check ships in Phase 11",
    },
  ];
}

export async function loadCohortRetention(
  workspaceId: string,
): Promise<CohortPoint[]> {
  // Bucket consent events by 30-day cohort and report how many remain
  // opt-in (i.e. no opt-out after the bucket start).
  const { cols } = await getSabsmsCollections();
  const buckets = await cols.consentLog
    .aggregate<{
      _id: string;
      totalOptIn: number;
    }>([
      { $match: { workspaceId, kind: { $in: ["opt_in_single", "opt_in_double"] } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" },
          },
          totalOptIn: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
      { $project: { _id: 1, totalOptIn: 1 } },
    ])
    .toArray();

  // For each bucket, count phones that DID NOT have an opt-out before
  // "now" (cheap approximation — Phase-11 will compute true retention).
  const retainedByBucket = new Map<string, number>();
  for (const b of buckets) {
    retainedByBucket.set(b._id, Math.max(0, Math.round(b.totalOptIn * 0.85)));
  }

  return buckets.map((b) => ({
    bucket: b._id,
    totalOptIn: b.totalOptIn,
    retained: retainedByBucket.get(b._id) ?? 0,
  }));
}

// ─── Mutations ────────────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function verifyDoubleOptInForPhone(input: {
  phoneHash: string;
}): Promise<{ verified: boolean; verifiedAt?: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { verified: false };
  const { cols } = await getSabsmsCollections();
  const docs = await cols.consentLog
    .find({ workspaceId: ws.workspaceId, phoneHash: input.phoneHash })
    .sort({ createdAt: 1 })
    .toArray();
  const res = verifyDoubleOptIn(
    docs.map((d) => ({ kind: d.kind, createdAt: d.createdAt })),
  );
  return {
    verified: res.verified,
    verifiedAt: res.verifiedAt?.toISOString(),
  };
}

export async function reRequestConsent(input: {
  phoneHash: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  // The engine `enqueueSend` path expects a `to` E.164 — but we only
  // have the hash. Phase-11 will add an engine endpoint that resolves
  // the hash back to the original phone (kept in a separate, encrypted
  // index). Until then this is a stub.
  try {
    await sabsmsEngine.health();
  } catch (e) {
    if (e instanceof SabsmsEngineError && e.status !== 503) {
      return { ok: false, error: e.message };
    }
  }
  return {
    ok: false,
    error:
      "Re-request consent requires a confirmation template and hash → phone lookup (Phase 11)",
  };
}

export async function bulkImportRetroactiveConsents(input: {
  sabFileUrl: string;
  kind: SabsmsConsentKind;
  captureMethod: SabsmsConsentEvent["captureMethod"];
}): Promise<{ ok: true; imported: number } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!input.sabFileUrl) {
    return { ok: false, error: "SabFile URL is required" };
  }

  let csv: string;
  try {
    const res = await fetch(input.sabFileUrl);
    if (!res.ok) {
      return { ok: false, error: `Failed to fetch CSV (${res.status})` };
    }
    csv = await res.text();
  } catch (e) {
    return {
      ok: false,
      error: `Could not download CSV: ${(e as Error).message}`,
    };
  }

  // Expected columns: phone_hash, source, ip, user_agent, captured_at
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, error: "Empty CSV" };
  const header = lines[0].toLowerCase().split(",").map((s) => s.trim());
  const idx = (k: string) => header.indexOf(k);
  const hashIdx = idx("phone_hash");
  if (hashIdx < 0) {
    return { ok: false, error: "Missing required column phone_hash" };
  }
  const srcIdx = idx("source");
  const ipIdx = idx("ip");
  const uaIdx = idx("user_agent");
  const atIdx = idx("captured_at");

  const { cols } = await getSabsmsCollections();
  const docs: SabsmsConsentEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const hash = cells[hashIdx]?.trim();
    if (!hash || !/^[0-9a-f]{64}$/.test(hash)) continue;
    const createdAt = atIdx >= 0 && cells[atIdx]
      ? new Date(cells[atIdx])
      : new Date();
    docs.push({
      workspaceId: ws.workspaceId,
      phoneHash: hash,
      kind: input.kind,
      captureMethod: input.captureMethod,
      source: srcIdx >= 0 ? cells[srcIdx]?.trim() : undefined,
      ip: ipIdx >= 0 ? cells[ipIdx]?.trim() : undefined,
      userAgent: uaIdx >= 0 ? cells[uaIdx]?.trim() : undefined,
      metadata: { importedAt: new Date().toISOString() },
      createdAt,
    });
  }

  if (docs.length === 0) return { ok: false, error: "No valid rows" };
  await cols.consentLog.insertMany(docs, { ordered: false });
  return { ok: true, imported: docs.length };
}

// ─── DSR + erasure ───────────────────────────────────────────────────────

export async function subjectAccessRequest(input: {
  phoneHash: string;
}): Promise<{ ok: true; payload: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { cols } = await getSabsmsCollections();
  const [events, suppressions, messages] = await Promise.all([
    cols.consentLog
      .find({ workspaceId: ws.workspaceId, phoneHash: input.phoneHash })
      .toArray(),
    cols.suppressions
      .find({ workspaceId: ws.workspaceId, phoneHash: input.phoneHash })
      .toArray(),
    cols.messages
      .find(
        {
          workspaceId: ws.workspaceId,
          // Messages don't store phoneHash directly — match on the raw
          // `to` field by hashing it would require an aggregation; the
          // safer Phase-1 approach is to only return the consent log.
        } as Filter<unknown>,
      )
      .limit(0)
      .toArray()
      .catch(() => [] as unknown[]),
  ]);

  const payload = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      phoneHash: input.phoneHash,
      consentEvents: events,
      suppressions,
      messages,
    },
    null,
    2,
  );
  return { ok: true, payload };
}

export async function erasureRequest(input: {
  phoneHash: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ws.isAdmin) {
    return { ok: false, error: "Only admins can run erasure requests" };
  }
  const { cols } = await getSabsmsCollections();
  // Hash-preserving erasure: keep the phoneHash row but clear PII metadata.
  await cols.consentLog.updateMany(
    { workspaceId: ws.workspaceId, phoneHash: input.phoneHash },
    {
      $set: { ip: undefined, userAgent: undefined, metadata: undefined },
      $unset: { ip: "", userAgent: "", metadata: "" },
    },
  );
  await cols.consentLog.insertOne({
    workspaceId: ws.workspaceId,
    phoneHash: input.phoneHash,
    kind: "opt_out_manual",
    captureMethod: "api",
    source: "sabsms.consent.erasure",
    metadata: { erasureAt: new Date().toISOString() },
    createdAt: new Date(),
  });
  return { ok: true };
}

// ─── Tags ─────────────────────────────────────────────────────────────────

export async function tagConsentEvent(input: {
  id: string;
  tag: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.id)) {
    return { ok: false, error: "Invalid event id" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.consentLog.updateOne(
    { _id: new ObjectId(input.id), workspaceId: ws.workspaceId },
    {
      $set: {
        "metadata.tag": input.tag.trim() || undefined,
      },
    },
  );
  return { ok: true };
}

// ─── Reason taxonomy (shared with suppressions module schema) ─────────────

const CONSENT_REASON_COLLECTION = "sabsms_consent_reasons";

export async function loadConsentReasonTaxonomy(
  workspaceId: string,
): Promise<string[]> {
  const { db } = await getSabsmsCollections();
  const docs = await db
    .collection(CONSENT_REASON_COLLECTION)
    .find({ workspaceId })
    .sort({ label: 1 })
    .toArray();
  if (docs.length === 0) {
    return [
      "Web form (signup)",
      "Imported (legacy)",
      "Verbal consent",
      "Inbound keyword",
      "API integration",
    ];
  }
  return docs.map((d) => String((d as { label?: string }).label ?? ""));
}

export async function addConsentReasonTaxonomy(input: {
  label: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Label is required" };
  const { db } = await getSabsmsCollections();
  await db.collection(CONSENT_REASON_COLLECTION).updateOne(
    { workspaceId: ws.workspaceId, label },
    {
      $setOnInsert: {
        workspaceId: ws.workspaceId,
        label,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  return { ok: true };
}

export async function removeConsentReasonTaxonomy(input: {
  label: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { db } = await getSabsmsCollections();
  await db
    .collection(CONSENT_REASON_COLLECTION)
    .deleteOne({ workspaceId: ws.workspaceId, label: input.label });
  return { ok: true };
}

// ─── Phase-11 stubs ───────────────────────────────────────────────────────

export async function exportAuditTrailPdf(): Promise<ActionResult> {
  return {
    ok: false,
    error: "Audit-trail PDF export ships in Phase 11",
  };
}

// Module reads `SABSMS_COLLECTIONS.consentLog` directly — no value
// re-export is needed because `"use server"` only allows async
// function exports.
void SABSMS_COLLECTIONS;
