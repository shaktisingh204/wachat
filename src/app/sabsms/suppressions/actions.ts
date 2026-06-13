"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

/**
 * SabSMS suppressions — server actions + read paths.
 *
 * Mirrors the inbox pattern (`src/app/sabsms/inbox/actions.ts`). Every
 * mutation runs through `getCachedSession()` to resolve the workspace
 * and goes through `getSabsmsCollections()` for typed Mongo access.
 *
 * Phone numbers are NEVER stored in plain text — only the SHA-256 hex
 * hash lives in `sabsms_suppressions`. Search accepts either an E.164
 * phone (auto-hashed) or a 64-char hex hash (passed through).
 */

import { ObjectId, type Filter } from "mongodb";
import { after } from "next/server";

import { getCachedSession } from "@/lib/server-cache";
import {
  SABSMS_COLLECTIONS,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import { sabsmsEngine, SabsmsEngineError } from "@/lib/sabsms/engine-client";
import type {
  SabsmsSuppression,
  SabsmsSuppressionSource,
} from "@/lib/sabsms/types";

import { hashPhone, normalizeSearchTerm } from "./lib";
export type { SearchTerm } from "./lib";

// ─── View types ───────────────────────────────────────────────────────────

export interface SuppressionRow {
  id: string;
  phoneHash: string;
  source: SabsmsSuppressionSource;
  reason?: string;
  tag?: string;
  createdAt: string;
  lastTouchedAt?: string;
  expiresAt?: string;
}

export interface SuppressionFilters {
  q?: string;
  source?: SabsmsSuppressionSource[];
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "source";
  page?: number;
  pageSize?: number;
}

export interface SuppressionsListResult {
  rows: SuppressionRow[];
  total: number;
}

export interface SuppressionCoverage {
  workspaceContacts: number;
  suppressed: number;
  coveragePct: number;
}

export interface AuditTrailEntry {
  id: string;
  at: string;
  kind: string;
  reason?: string;
  source?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

type WorkspaceResolution =
  | { ok: true; workspaceId: string; userId: string; isAdmin: boolean }
  | { ok: false; error: string };

async function resolveWorkspace(): Promise<WorkspaceResolution> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown; role?: unknown } | undefined)
    ?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  const role = String(
    (session?.user as { role?: unknown } | undefined)?.role ?? "",
  );
  return {
    ok: true,
    workspaceId: (await getSabsmsWorkspaceId()) ?? "",
    userId: String(userId),
    isAdmin: role === "admin",
  };
}

function toIso(d?: Date | string): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

function projectSuppression(
  doc: SabsmsSuppression & {
    _id?: ObjectId;
    tag?: string;
    lastTouchedAt?: Date;
  },
): SuppressionRow {
  return {
    id: String(doc._id),
    phoneHash: doc.phoneHash,
    source: doc.source,
    reason: doc.reason,
    tag: doc.tag,
    createdAt: toIso(doc.createdAt) ?? new Date().toISOString(),
    lastTouchedAt: toIso(doc.lastTouchedAt),
    expiresAt: toIso(doc.expiresAt),
  };
}

// ─── Read paths ───────────────────────────────────────────────────────────

export async function loadSuppressions(
  workspaceId: string,
  filters: SuppressionFilters,
): Promise<SuppressionsListResult> {
  const { cols } = await getSabsmsCollections();
  const filter: Filter<SabsmsSuppression> = { workspaceId };

  const term = normalizeSearchTerm(filters.q);
  if (term.kind === "hash") {
    filter.phoneHash = term.hash;
  } else if (term.kind === "text") {
    // Reason free-text search is case-insensitive.
    (filter as Record<string, unknown>).reason = {
      $regex: term.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  }

  if (filters.source && filters.source.length > 0) {
    filter.source = { $in: filters.source };
  }
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);
    filter.createdAt = createdAt as never;
  }

  const sortMap: Record<NonNullable<SuppressionFilters["sort"]>, Record<string, 1 | -1>> =
    {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      source: { source: 1, createdAt: -1 },
    };
  const sort = sortMap[filters.sort ?? "newest"];

  const page = Math.max(0, filters.page ?? 0);
  const pageSize = Math.max(1, Math.min(250, filters.pageSize ?? 50));

  const [docs, total] = await Promise.all([
    cols.suppressions
      .find(filter)
      .sort(sort)
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray(),
    cols.suppressions.countDocuments(filter),
  ]);

  return {
    rows: docs.map((d) => projectSuppression(d as never)),
    total,
  };
}

export async function loadCoverage(
  workspaceId: string,
): Promise<SuppressionCoverage> {
  const { cols, db } = await getSabsmsCollections();
  const [suppressed, contacts] = await Promise.all([
    cols.suppressions.countDocuments({ workspaceId }),
    // Workspace contacts are owned by the CRM module — we read the
    // existing `crm_contacts` collection (if present) for the % math.
    db
      .collection("crm_contacts")
      .countDocuments({ workspaceId })
      .catch(() => 0),
  ]);
  const coveragePct = contacts > 0 ? (suppressed / contacts) * 100 : 0;
  return {
    workspaceContacts: contacts,
    suppressed,
    coveragePct: Math.round(coveragePct * 10) / 10,
  };
}

export async function loadCostAvoided24h(workspaceId: string): Promise<number> {
  // Cost avoided = number of `suppressed`-status outbound messages in
  // the last 24 h × average segment cost. We approximate by counting
  // suppressed messages and multiplying by a conservative $0.0075 per
  // message (the engine's default Twilio US rate).
  const { cols } = await getSabsmsCollections();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await cols.messages.countDocuments({
    workspaceId,
    status: "suppressed",
    createdAt: { $gte: since },
  });
  return count * 0.0075;
}

export async function loadAuditTrail(
  _workspaceId: string,
  phoneHash: string,
): Promise<AuditTrailEntry[]> {
  // Server-action callers from the client pass an empty workspaceId —
  // we always resolve it from the session here so the audit log stays
  // tenant-scoped no matter how it's invoked.
  const ws = await resolveWorkspace();
  if (!ws.ok) return [];
  const { cols } = await getSabsmsCollections();
  const events = await cols.consentLog
    .find({ workspaceId: ws.workspaceId, phoneHash })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return events.map((e) => ({
    id: String(e._id),
    at: toIso(e.createdAt) ?? new Date().toISOString(),
    kind: e.kind,
    reason: (e.metadata as { reason?: string } | undefined)?.reason,
    source: e.source,
  }));
}

export async function loadCampaignsForOverlap(
  workspaceId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { cols } = await getSabsmsCollections();
  const docs = await cols.campaigns
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return docs.map((c) => ({ id: String(c._id), name: c.name }));
}

export async function computeCampaignOverlap(
  _workspaceId: string,
  campaignId: string,
): Promise<{ recipients: number; suppressed: number; pct: number }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { recipients: 0, suppressed: 0, pct: 0 };
  const workspaceId = ws.workspaceId;
  if (!ObjectId.isValid(campaignId)) {
    return { recipients: 0, suppressed: 0, pct: 0 };
  }
  const { cols } = await getSabsmsCollections();
  const messages = await cols.messages
    .find(
      { workspaceId, campaignId },
      { projection: { to: 1 } },
    )
    .toArray();
  const recipients = messages.length;
  if (recipients === 0) return { recipients: 0, suppressed: 0, pct: 0 };

  const targetHashes = new Set(messages.map((m) => hashPhone(String(m.to))));
  const suppressedDocs = await cols.suppressions
    .find(
      { workspaceId, phoneHash: { $in: Array.from(targetHashes) } },
      { projection: { phoneHash: 1 } },
    )
    .toArray();
  const suppressed = suppressedDocs.length;
  return {
    recipients,
    suppressed,
    pct: Math.round((suppressed / recipients) * 1000) / 10,
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Bulk-import suppressions from a CSV blob staged in SabFiles.
 *
 * Uses `after()` to process the CSV in the background to avoid blocking
 * the event loop, and writes an audit log entry for each suppression.
 */
export async function bulkImportSuppressions(input: {
  sabFileUrl: string;
  source?: SabsmsSuppressionSource;
  reason?: string;
  expiresInDays?: number;
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

  const phones = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^phone\b/i.test(line))
    .map((line) => line.split(",")[0]?.trim())
    .filter((p): p is string => !!p);

  if (phones.length === 0) {
    return { ok: false, error: "No phones found in CSV" };
  }

  const { cols } = await getSabsmsCollections();
  const source = input.source ?? "import";

  let expiresAt: Date | undefined;
  if (input.expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);
  }

  after(async () => {
    // Process in chunks to prevent blocking event loop for too long
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < phones.length; i += CHUNK_SIZE) {
      const chunk = phones.slice(i, i + CHUNK_SIZE);
      const now = new Date();
      
      const ops = chunk.map((phone) => {
        const phoneHash = hashPhone(phone);
        return {
          updateOne: {
            filter: { workspaceId: ws.workspaceId, phoneHash },
            update: {
              $setOnInsert: {
                workspaceId: ws.workspaceId,
                phoneHash,
                source,
                reason: input.reason,
                createdAt: now,
                ...(expiresAt ? { expiresAt } : {}),
              },
              $set: { lastTouchedAt: now },
            },
            upsert: true,
          },
        };
      });

      const auditOps = chunk.map((phone) => ({
        workspaceId: ws.workspaceId,
        phoneHash: hashPhone(phone),
        kind: "opt_out_manual" as const,
        captureMethod: "import" as const,
        source: "sabsms.suppressions.import",
        metadata: { 
          reason: input.reason,
          suppressedByUserId: ws.userId
        },
        createdAt: now,
      }));

      await Promise.all([
        cols.suppressions.bulkWrite(ops, { ordered: false }),
        cols.consentLog.insertMany(auditOps, { ordered: false })
      ]);

      // Yield event loop
      await new Promise(r => setTimeout(r, 0));
    }
  });

  return { ok: true, imported: phones.length };
}

export async function addSuppression(input: {
  phone: string;
  source: SabsmsSuppressionSource;
  reason?: string;
  expiresInDays?: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  const phoneHash = hashPhone(input.phone);
  const now = new Date();
  
  let expiresAt: Date | undefined;
  if (input.expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);
  }

  const { cols } = await getSabsmsCollections();
  
  const res = await cols.suppressions.findOneAndUpdate(
    { workspaceId: ws.workspaceId, phoneHash },
    {
      $setOnInsert: {
        workspaceId: ws.workspaceId,
        phoneHash,
        source: input.source,
        reason: input.reason,
        createdAt: now,
        ...(expiresAt ? { expiresAt } : {}),
      },
      $set: { lastTouchedAt: now },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (!res) {
    return { ok: false, error: "Failed to create suppression" };
  }

  await cols.consentLog.insertOne({
    workspaceId: ws.workspaceId,
    phoneHash,
    kind: "opt_out_manual",
    captureMethod: "api",
    source: "sabsms.suppressions.add",
    metadata: { 
      reason: input.reason,
      suppressedByUserId: ws.userId
    },
    createdAt: now,
  });

  return { ok: true, id: String(res._id) };
}

export async function updateSuppressionReason(input: {
  id: string;
  reason: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.id)) {
    return { ok: false, error: "Invalid suppression id" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.suppressions.updateOne(
    { _id: new ObjectId(input.id), workspaceId: ws.workspaceId },
    {
      $set: {
        reason: input.reason.trim() || undefined,
        lastTouchedAt: new Date(),
      },
    },
  );
  return { ok: true };
}

export async function tagSuppression(input: {
  id: string;
  tag: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.id)) {
    return { ok: false, error: "Invalid suppression id" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.suppressions.updateOne(
    { _id: new ObjectId(input.id), workspaceId: ws.workspaceId },
    { $set: { tag: input.tag.trim() || undefined, lastTouchedAt: new Date() } },
  );
  return { ok: true };
}

export async function unsuppressOne(input: {
  id: string;
  reason: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ws.isAdmin) {
    return { ok: false, error: "Only admins can unsuppress entries" };
  }
  if (!input.reason?.trim()) {
    return { ok: false, error: "Reason is required" };
  }
  if (!ObjectId.isValid(input.id)) {
    return { ok: false, error: "Invalid suppression id" };
  }
  const { cols } = await getSabsmsCollections();
  const doc = await cols.suppressions.findOne({
    _id: new ObjectId(input.id),
    workspaceId: ws.workspaceId,
  });
  if (!doc) return { ok: false, error: "Suppression not found" };
  const now = new Date();
  await cols.suppressions.deleteOne({ _id: new ObjectId(input.id) });
  // Audit-trail: write an `opt_in_restart` event tied to the same hash.
  await cols.consentLog.insertOne({
    workspaceId: ws.workspaceId,
    phoneHash: doc.phoneHash,
    kind: "opt_in_restart",
    captureMethod: "api",
    source: "sabsms.suppressions.unsuppress",
    metadata: { reason: input.reason.trim(), removedSuppressionId: String(input.id) },
    createdAt: now,
  });
  return { ok: true };
}

export async function bulkUnsuppress(input: {
  ids: string[];
  reason: string;
}): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ws.isAdmin) {
    return { ok: false, error: "Only admins can unsuppress entries" };
  }
  if (!input.reason?.trim()) {
    return { ok: false, error: "Reason is required" };
  }
  const ids = input.ids.filter((i) => ObjectId.isValid(i));
  if (ids.length === 0) return { ok: false, error: "No valid ids" };
  const { cols } = await getSabsmsCollections();
  const objectIds = ids.map((i) => new ObjectId(i));
  const docs = await cols.suppressions
    .find({ workspaceId: ws.workspaceId, _id: { $in: objectIds } })
    .toArray();
  if (docs.length === 0) return { ok: false, error: "Nothing found" };
  const now = new Date();
  await cols.suppressions.deleteMany({
    workspaceId: ws.workspaceId,
    _id: { $in: objectIds },
  });
  await cols.consentLog.insertMany(
    docs.map((d) => ({
      workspaceId: ws.workspaceId,
      phoneHash: d.phoneHash,
      kind: "opt_in_restart" as const,
      captureMethod: "api" as const,
      source: "sabsms.suppressions.bulkUnsuppress",
      metadata: { reason: input.reason.trim() },
      createdAt: now,
    })),
  );
  return { ok: true, removed: docs.length };
}

// ─── Auto-suppress rules (persisted JSON list) ────────────────────────────

export interface AutoSuppressRule {
  id: string;
  /** e.g. "failure_count" */
  metric: "failure_count" | "complaint_count" | "stop_count";
  /** e.g. "gte" */
  op: "gte" | "gt";
  threshold: number;
  windowDays: number;
  enabled: boolean;
}

const AUTO_RULES_COLLECTION = "sabsms_auto_suppress_rules";

export async function loadAutoSuppressRules(
  workspaceId: string,
): Promise<AutoSuppressRule[]> {
  const { db } = await getSabsmsCollections();
  const docs = await db
    .collection(AUTO_RULES_COLLECTION)
    .find({ workspaceId })
    .toArray();
  return docs.map((d) => ({
    id: String((d as { _id?: ObjectId })._id),
    metric: (d as { metric?: AutoSuppressRule["metric"] }).metric ?? "failure_count",
    op: (d as { op?: AutoSuppressRule["op"] }).op ?? "gte",
    threshold: Number((d as { threshold?: number }).threshold ?? 3),
    windowDays: Number((d as { windowDays?: number }).windowDays ?? 7),
    enabled: Boolean((d as { enabled?: boolean }).enabled ?? true),
  }));
}

export async function upsertAutoSuppressRule(input: {
  id?: string;
  metric: AutoSuppressRule["metric"];
  op: AutoSuppressRule["op"];
  threshold: number;
  windowDays: number;
  enabled: boolean;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { db } = await getSabsmsCollections();
  const col = db.collection(AUTO_RULES_COLLECTION);
  if (input.id && ObjectId.isValid(input.id)) {
    await col.updateOne(
      { _id: new ObjectId(input.id), workspaceId: ws.workspaceId },
      {
        $set: {
          metric: input.metric,
          op: input.op,
          threshold: input.threshold,
          windowDays: input.windowDays,
          enabled: input.enabled,
          updatedAt: new Date(),
        },
      },
    );
  } else {
    await col.insertOne({
      workspaceId: ws.workspaceId,
      metric: input.metric,
      op: input.op,
      threshold: input.threshold,
      windowDays: input.windowDays,
      enabled: input.enabled,
      createdAt: new Date(),
    });
  }
  return { ok: true };
}

export async function deleteAutoSuppressRule(input: {
  id: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.id)) {
    return { ok: false, error: "Invalid rule id" };
  }
  const { db } = await getSabsmsCollections();
  await db
    .collection(AUTO_RULES_COLLECTION)
    .deleteOne({
      _id: new ObjectId(input.id),
      workspaceId: ws.workspaceId,
    });
  return { ok: true };
}

// ─── Reason taxonomy (persisted JSON list) ────────────────────────────────

const REASON_TAXONOMY_COLLECTION = "sabsms_suppression_reasons";

export async function loadReasonTaxonomy(
  workspaceId: string,
): Promise<string[]> {
  const { db } = await getSabsmsCollections();
  const docs = await db
    .collection(REASON_TAXONOMY_COLLECTION)
    .find({ workspaceId })
    .sort({ label: 1 })
    .toArray();
  if (docs.length === 0) {
    // Built-in defaults — every workspace gets a sensible starting set.
    return [
      "User replied STOP",
      "Carrier complaint",
      "Hard bounce",
      "Manual block (support request)",
      "Imported from previous platform",
    ];
  }
  return docs.map((d) => String((d as { label?: string }).label ?? ""));
}

export async function addReasonTaxonomy(input: {
  label: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Label is required" };
  const { db } = await getSabsmsCollections();
  await db
    .collection(REASON_TAXONOMY_COLLECTION)
    .updateOne(
      { workspaceId: ws.workspaceId, label },
      { $setOnInsert: { workspaceId: ws.workspaceId, label, createdAt: new Date() } },
      { upsert: true },
    );
  return { ok: true };
}

export async function removeReasonTaxonomy(input: {
  label: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { db } = await getSabsmsCollections();
  await db
    .collection(REASON_TAXONOMY_COLLECTION)
    .deleteOne({ workspaceId: ws.workspaceId, label: input.label });
  return { ok: true };
}

// ─── Phase-11 stubs ───────────────────────────────────────────────────────

export async function exportCompliancePdf(): Promise<ActionResult> {
  // PDF rendering lives in Phase 11 — return a clear "not yet" until the
  // shared PDF renderer ships.
  return {
    ok: false,
    error: "Compliance-trail PDF export ships in Phase 11",
  };
}

export async function requestSharedSuppressionList(): Promise<ActionResult> {
  // Cross-workspace shared suppression lists are an admin-only Phase 11
  // feature — this is a placeholder so the menu entry is wired.
  return {
    ok: false,
    error: "Cross-workspace shared suppression lists ship in Phase 11",
  };
}

// ─── Engine ping (used by the page's refresh button) ──────────────────────

export async function pingEngine(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await sabsmsEngine.health();
    return { ok: res.ok };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: (e as Error).message };
  }
}

// Module reads the canonical collection name via the imported
// `SABSMS_COLLECTIONS.suppressions` — no value re-export is needed
// because `"use server"` only allows async function exports.
void SABSMS_COLLECTIONS;
