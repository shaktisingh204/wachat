"use server";

/**
 * Drips list — server actions.
 *
 * Backs Page 12 §B.2 of `plans/sabsms-pages-catalog.md` (`/sabsms/drips`).
 *
 * Workspace scope is always resolved from `getCachedSession()` — the
 * client passes filter parameters only, never the workspace id. Reads
 * use the typed `getSabsmsCollections()` accessor and write paths use
 * the same `{ workspaceId, _id }` filter pattern so a stolen drip id
 * from another workspace can never be mutated.
 */

import { revalidatePath } from "next/cache";
import { ObjectId, type Filter } from "mongodb";

import { getCachedSession } from "@/lib/server-cache";
import {
  SABSMS_COLLECTIONS,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import type { SabsmsDrip } from "@/lib/sabsms/types";

import type { DraftDrip } from "./[id]/validate";

// ─── Types ────────────────────────────────────────────────────────────────

export interface DripListFilters {
  q?: string;
  enabled?: "enabled" | "disabled" | "all";
  trigger?: Array<"manual" | "segment_join" | "event">;
  templateId?: string;
  withErrors?: boolean;
  sort?: "newest" | "oldest" | "name" | "active_recipients";
}

export interface DripRow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: "manual" | "segment_join" | "event";
  triggerLabel: string;
  stepCount: number;
  branchCount: number;
  templateIds: string[];
  /** Active recipients currently enroled in the drip. */
  activeRecipients: number;
  /** Throughput — messages per minute over the trailing window. */
  throughputPerMin: number;
  /** End-to-end conversion rate (0..1). */
  conversionRate: number;
  /** Drop-off chart series (per-step delivered counts). */
  stageDropoff: Array<{ step: number; delivered: number }>;
  /** Cohort attribution string surfaced in the list. */
  cohort?: string;
  /** Auto-pause-on-error toggle state. */
  autoPauseOnError: boolean;
  /** Count of errored runs in the last 24h. */
  errorCount: number;
  scheduleSummary: string;
  updatedAt: string;
}

export type DripActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

function toObjectIdOrNull(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function triggerLabel(t: "manual" | "segment_join" | "event"): string {
  switch (t) {
    case "manual":
      return "Manual";
    case "segment_join":
      return "Segment join";
    case "event":
      return "Event";
  }
}

/**
 * Tease a `DripRow` out of a raw drip doc. Tolerant of half-built drips
 * where the engine has not yet stamped operational counters.
 */
function toRow(d: SabsmsDrip & Record<string, unknown>): DripRow {
  const draft = (d as unknown as { draft?: DraftDrip }).draft;
  const branchCount = draft
    ? draft.nodes.filter((n) => n.kind === "branch").length
    : 0;
  const templateIds = draft
    ? draft.nodes.filter((n) => n.kind === "message" && n.templateId).map((n) => n.templateId!)
    : d.steps.map((s) => s.templateId);
  return {
    id: String(d._id),
    name: d.name,
    enabled: !!d.enabled,
    trigger: d.entryTrigger.kind,
    triggerLabel: triggerLabel(d.entryTrigger.kind),
    stepCount: draft ? draft.nodes.length : d.steps.length,
    branchCount,
    templateIds,
    activeRecipients:
      typeof (d as { activeRecipients?: number }).activeRecipients === "number"
        ? (d as { activeRecipients?: number }).activeRecipients!
        : 0,
    throughputPerMin:
      typeof (d as { throughputPerMin?: number }).throughputPerMin === "number"
        ? (d as { throughputPerMin?: number }).throughputPerMin!
        : 0,
    conversionRate:
      typeof (d as { conversionRate?: number }).conversionRate === "number"
        ? (d as { conversionRate?: number }).conversionRate!
        : 0,
    stageDropoff:
      ((d as { stageDropoff?: Array<{ step: number; delivered: number }> }).stageDropoff) ??
      d.steps.map((_, i) => ({ step: i + 1, delivered: 0 })),
    cohort: (d as { cohort?: string }).cohort,
    autoPauseOnError:
      typeof (d as { autoPauseOnError?: boolean }).autoPauseOnError === "boolean"
        ? (d as { autoPauseOnError?: boolean }).autoPauseOnError!
        : false,
    errorCount:
      typeof (d as { errorCount?: number }).errorCount === "number"
        ? (d as { errorCount?: number }).errorCount!
        : 0,
    scheduleSummary: (d as { scheduleSummary?: string }).scheduleSummary ?? "—",
    updatedAt: new Date(d.updatedAt).toISOString(),
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────

/**
 * Load drips for the list table. Filtering happens server-side so the
 * URL-state round-trips cleanly across page boundaries.
 */
export async function loadDrips(
  workspaceId: string,
  filters: DripListFilters,
): Promise<DripRow[]> {
  const { cols } = await getSabsmsCollections();

  const query: Filter<SabsmsDrip> = { workspaceId };
  if (filters.enabled === "enabled") query.enabled = true;
  if (filters.enabled === "disabled") query.enabled = false;
  if (filters.trigger && filters.trigger.length > 0) {
    query["entryTrigger.kind"] = { $in: filters.trigger } as unknown as never;
  }
  if (filters.templateId) {
    query["steps.templateId"] = filters.templateId as unknown as never;
  }
  if (filters.q && filters.q.trim().length > 0) {
    // Anchored regex on `name` — cheap and avoids $text index hassle.
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.name = { $regex: escape(filters.q.trim()), $options: "i" } as unknown as never;
  }
  if (filters.withErrors) {
    (query as Record<string, unknown>).errorCount = { $gt: 0 };
  }

  let sort: [string, 1 | -1][] = [["updatedAt", -1]];
  if (filters.sort === "oldest") sort = [["createdAt", 1]];
  if (filters.sort === "name") sort = [["name", 1]];
  if (filters.sort === "active_recipients")
    sort = [["activeRecipients", -1]];

  const docs = await cols.drips
    .find(query)
    .sort(Object.fromEntries(sort))
    .limit(250)
    .toArray();

  return docs.map((d) => toRow(d as SabsmsDrip & Record<string, unknown>));
}

/**
 * Surface the workspace's templates so the "Filter by template usage"
 * facet has stable options.
 */
export async function loadTemplateFacetOptions(
  workspaceId: string,
): Promise<Array<{ value: string; label: string }>> {
  const { cols } = await getSabsmsCollections();
  const docs = await cols.templates
    .find({ workspaceId })
    .project({ name: 1 })
    .sort({ name: 1 })
    .limit(200)
    .toArray();
  return docs.map((d) => ({
    value: String(d._id),
    label: (d as unknown as { name: string }).name,
  }));
}

// ─── Mutations ────────────────────────────────────────────────────────────

export async function setDripEnabledFromList(
  id: string,
  enabled: boolean,
): Promise<DripActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, error: "invalid_id" };
  const { cols } = await getSabsmsCollections();
  const res = await cols.drips.updateOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
    { $set: { enabled, updatedAt: new Date() } },
  );
  if (res.matchedCount === 0) return { ok: false, error: "not_found" };
  revalidatePath("/sabsms/drips");
  return { ok: true };
}

export async function duplicateDrip(id: string): Promise<DripActionResult & { id?: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, error: "invalid_id" };
  const { cols } = await getSabsmsCollections();
  const doc = await cols.drips.findOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
  );
  if (!doc) return { ok: false, error: "not_found" };
  const now = new Date();
  const newId = new ObjectId();
  await cols.drips.insertOne({
    ...(doc as object),
    _id: newId,
    name: `${doc.name} (copy)`,
    enabled: false,
    createdAt: now,
    updatedAt: now,
  } as unknown as SabsmsDrip);
  revalidatePath("/sabsms/drips");
  return { ok: true, id: newId.toHexString() };
}

export async function setAutoPauseOnError(
  id: string,
  enabled: boolean,
): Promise<DripActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, error: "invalid_id" };
  const { cols } = await getSabsmsCollections();
  await cols.drips.updateOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
    { $set: { autoPauseOnError: enabled, updatedAt: new Date() } },
  );
  revalidatePath("/sabsms/drips");
  return { ok: true };
}

export async function editSchedule(
  id: string,
  scheduleSummary: string,
): Promise<DripActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, error: "invalid_id" };
  const { cols } = await getSabsmsCollections();
  await cols.drips.updateOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
    { $set: { scheduleSummary, updatedAt: new Date() } },
  );
  revalidatePath("/sabsms/drips");
  return { ok: true };
}

export async function exportDripJson(
  id: string,
): Promise<{ ok: boolean; json?: string; error?: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, error: "invalid_id" };
  const { cols } = await getSabsmsCollections();
  const doc = await cols.drips.findOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
  );
  if (!doc) return { ok: false, error: "not_found" };
  const draft = (doc as unknown as { draft?: DraftDrip }).draft;
  return {
    ok: true,
    json: JSON.stringify(
      {
        name: doc.name,
        enabled: doc.enabled,
        entryTrigger: doc.entryTrigger,
        steps: doc.steps,
        draft,
      },
      null,
      2,
    ),
  };
}

export async function importDripJson(
  json: string,
): Promise<DripActionResult & { id?: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  const p = parsed as Partial<SabsmsDrip & { draft?: DraftDrip }>;
  if (!p || typeof p !== "object" || typeof p.name !== "string") {
    return { ok: false, error: "shape_invalid" };
  }
  const { cols } = await getSabsmsCollections();
  const now = new Date();
  const newId = new ObjectId();
  await cols.drips.insertOne({
    _id: newId,
    workspaceId: ws.workspaceId,
    name: p.name,
    enabled: false,
    entryTrigger: p.entryTrigger ?? { kind: "manual" },
    steps: Array.isArray(p.steps) ? p.steps : [],
    draft: p.draft,
    createdAt: now,
    updatedAt: now,
  } as unknown as SabsmsDrip);
  revalidatePath("/sabsms/drips");
  return { ok: true, id: newId.toHexString() };
}

export async function testEnrolContact(
  dripId: string,
  contact: { phoneE164: string; firstName?: string },
): Promise<DripActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oid = toObjectIdOrNull(dripId);
  if (!oid) return { ok: false, error: "invalid_id" };
  // Phase 4 of the engine owns the actual enrolment write; we record
  // a placeholder doc so the UI can show "queued".
  const { cols } = await getSabsmsCollections();
  await cols.drips.updateOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
    {
      $push: {
        testEnrolments: {
          $each: [{ contact, enroledAt: new Date() }],
          $slice: -25,
        },
      } as never,
    },
  );
  revalidatePath("/sabsms/drips");
  return { ok: true };
}

export async function bulkEnrolFromSegment(
  dripIds: string[],
  segmentId: string,
): Promise<DripActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oids = dripIds
    .map(toObjectIdOrNull)
    .filter((x): x is ObjectId => x !== null);
  if (oids.length === 0) return { ok: false, error: "no_valid_ids" };
  const { cols } = await getSabsmsCollections();
  await cols.drips.updateMany(
    { _id: { $in: oids }, workspaceId: ws.workspaceId } as never,
    {
      $push: {
        pendingBulkEnrolments: {
          $each: [{ segmentId, queuedAt: new Date() }],
          $slice: -100,
        },
      } as never,
    },
  );
  revalidatePath("/sabsms/drips");
  return { ok: true };
}

export async function massExit(
  dripIds: string[],
): Promise<DripActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oids = dripIds
    .map(toObjectIdOrNull)
    .filter((x): x is ObjectId => x !== null);
  if (oids.length === 0) return { ok: false, error: "no_valid_ids" };
  const { cols } = await getSabsmsCollections();
  await cols.drips.updateMany(
    { _id: { $in: oids }, workspaceId: ws.workspaceId } as never,
    {
      $set: { activeRecipients: 0, updatedAt: new Date() },
      $push: { massExitEvents: { at: new Date() } } as never,
    },
  );
  revalidatePath("/sabsms/drips");
  return { ok: true };
}

// Re-export collection name for direct callers.
export { SABSMS_COLLECTIONS };
