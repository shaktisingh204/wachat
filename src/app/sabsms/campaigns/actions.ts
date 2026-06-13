"use server";

/**
 * SabSMS campaigns — list-level server actions.
 *
 * Covers the cross-cutting mutations the list table fires from row /
 * bulk menus: status flips, duplicate, tag, archive, convert-to-drip,
 * convert-to-template, test send, compare two campaigns, etc.
 *
 * Every read + write is scoped to the requesting workspace
 * (`getCachedSession()` → `session.user._id`). Engine calls go through
 * `sabsmsEngine` — never raw `fetch`.
 */

import { ObjectId, type Filter, type WithId } from "mongodb";
import { z } from "zod";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import { sabsmsEngine, SabsmsEngineError } from "@/lib/sabsms/engine-client";
import {
  capabilityBatches,
  capabilityPercent,
  sampleForCapability,
} from "@/lib/sabsms/rcs";
// V2.10 smart send — identity-graph best-hour lookups.
import {
  phoneHashFor,
  SABSMS_IDENTITIES_COLLECTION,
  type SabsmsIdentityDoc,
} from "@/lib/sabsms/identity/graph";
import {
  nextOccurrenceUtcMs,
  smartSendDelayMs,
  workspaceMedianBestHourUtc,
} from "@/lib/sabsms/identity/smart-send";
import type {
  SabsmsCampaign,
  SabsmsCampaignAudience,
  SabsmsCampaignStatus,
  SabsmsDrip,
  SabsmsTemplate,
} from "@/lib/sabsms/types";

import {
  evaluatePredicate,
  type SegmentContact,
  type SegmentNode,
} from "../segments/new/evaluate";
import {
  buildRecipientDocs,
  chunkArray,
  csvRowsToContacts,
  dedupeContacts,
  estimateForContacts,
  parseCsv,
  resolveAudience,
  type AudienceContact,
  type AudienceDeps,
  type CampaignEstimate,
  type CampaignRecipientDoc,
  MAX_RECIPIENTS,
  RECIPIENT_CHUNK_SIZE,
} from "./launch-helpers";

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type VoidActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

// ─── Projection ───────────────────────────────────────────────────────────

/**
 * Plain-object form of a campaign for the list table — every field is
 * JSON-serialisable so the row can ship from the server component to
 * the client table without `<Date>` / `<ObjectId>` boundary noise.
 */
export interface CampaignRow {
  id: string;
  name: string;
  status: SabsmsCampaignStatus;
  category: string;
  createdBy?: string;
  templateId: string;
  templateName?: string;
  audienceSize: number;
  /** Engine-reported messages per second (lookback-based; 0 when idle). */
  velocity: number;
  progressPct: number;
  /** Best-effort ETA derived from velocity + remaining queued. */
  estimatedFinishAt?: string;
  costSoFar: number;
  costForecast: number;
  ctr: number;
  replyRate: number;
  optOutRate: number;
  tags: string[];
  archived?: boolean;
  stats: SabsmsCampaign["stats"];
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignListFilters {
  q?: string;
  status?: SabsmsCampaignStatus[];
  createdBy?: string[];
  templateId?: string[];
  tag?: string[];
  from?: string;
  to?: string;
  sort?: string;
  archived?: boolean;
}

interface CampaignDocExtras {
  createdBy?: string;
  tags?: string[];
  archived?: boolean;
}

function projectRow(
  doc: WithId<SabsmsCampaign & CampaignDocExtras>,
  templates: Map<string, string>,
): CampaignRow {
  const stats = doc.stats ?? {
    total: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    replied: 0,
    clicked: 0,
    unsubscribed: 0,
  };
  const audienceSize = stats.total ?? 0;
  const sent = stats.sent + stats.delivered + stats.failed;
  const progressPct = audienceSize > 0
    ? Math.min(100, Math.round((sent / audienceSize) * 100))
    : doc.status === "completed"
      ? 100
      : 0;

  // Velocity in messages/sec — engine sets `lastVelocity` on the doc when
  // the worker reports throughput. Fall back to 0 for idle / scheduled.
  const velocity =
    (doc as unknown as { lastVelocity?: number }).lastVelocity ?? 0;

  let estimatedFinishAt: string | undefined;
  if (doc.status === "running" && velocity > 0) {
    const remaining = Math.max(0, audienceSize - sent);
    const secsRemaining = Math.round(remaining / velocity);
    estimatedFinishAt = new Date(Date.now() + secsRemaining * 1000).toISOString();
  }

  const replyRate = sent > 0 ? Math.round((stats.replied / sent) * 1000) / 10 : 0;
  const optOutRate = sent > 0 ? Math.round((stats.unsubscribed / sent) * 1000) / 10 : 0;
  const ctr = sent > 0 ? Math.round((stats.clicked / sent) * 1000) / 10 : 0;

  // Cost estimate — `cost` is per-message; multiply by sent for so-far,
  // by audience for forecast. The actuals land on `sabsms_messages`;
  // exposing them as a list-level summary is the friendly view.
  const perMsgCost = (doc as unknown as { estimatedCostPerMsg?: number })
    .estimatedCostPerMsg ?? 0;
  const costSoFar = Math.round(perMsgCost * sent);
  const costForecast = Math.round(perMsgCost * audienceSize);

  return {
    id: String(doc._id),
    name: doc.name,
    status: doc.status,
    category: doc.category,
    createdBy: doc.createdBy,
    templateId: doc.templateId,
    templateName: templates.get(doc.templateId),
    audienceSize,
    velocity,
    progressPct,
    estimatedFinishAt,
    costSoFar,
    costForecast,
    ctr,
    replyRate,
    optOutRate,
    tags: doc.tags ?? [],
    archived: doc.archived,
    stats,
    scheduledAt: doc.scheduledAt ? doc.scheduledAt.toISOString() : undefined,
    startedAt: doc.startedAt ? doc.startedAt.toISOString() : undefined,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : undefined,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────

export async function loadCampaigns(
  workspaceId: string,
  filters: CampaignListFilters,
): Promise<{ rows: CampaignRow[]; total: number; chartSeries: VolumePoint[] }> {
  const { cols } = await getSabsmsCollections();

  const filter: Filter<SabsmsCampaign & CampaignDocExtras> = { workspaceId };
  if (filters.status && filters.status.length > 0) {
    filter.status = { $in: filters.status };
  }
  if (filters.createdBy && filters.createdBy.length > 0) {
    filter.createdBy = { $in: filters.createdBy };
  }
  if (filters.templateId && filters.templateId.length > 0) {
    filter.templateId = { $in: filters.templateId };
  }
  if (filters.tag && filters.tag.length > 0) {
    filter.tags = { $in: filters.tag } as never;
  }
  // Default: hide archived unless explicitly opted-in.
  if (!filters.archived) {
    filter.archived = { $ne: true } as never;
  }
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    (filter as Record<string, unknown>).name = rx;
  }
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);
    filter.createdAt = createdAt as never;
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name_asc: { name: 1 },
    name_desc: { name: -1 },
    audience_desc: { "stats.total": -1 },
    velocity_desc: { lastVelocity: -1 },
  };
  const sort = sortMap[filters.sort ?? "newest"] ?? sortMap.newest;

  const [docs, total] = await Promise.all([
    cols.campaigns
      .find(filter)
      .sort(sort)
      .limit(500)
      .toArray() as Promise<Array<WithId<SabsmsCampaign & CampaignDocExtras>>>,
    cols.campaigns.countDocuments(filter),
  ]);

  // Hydrate template names for the column (only the templates we
  // actually need — a single roundtrip avoids the N+1.)
  const templateIds = Array.from(
    new Set(docs.map((d) => d.templateId).filter(Boolean)),
  )
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const templates = templateIds.length
    ? await cols.templates
        .find({ _id: { $in: templateIds } })
        .project<{ _id: ObjectId; name: string }>({ name: 1 })
        .toArray()
    : [];
  const tmplMap = new Map<string, string>(
    templates.map((t) => [String(t._id), t.name]),
  );

  const rows = docs.map((d) => projectRow(d, tmplMap));

  // Chart series — bucket by createdAt day for the inline preview chart
  // on the list page. Cap to the most recent 30 buckets for snappy
  // rendering.
  const series = bucketByDay(rows.map((r) => r.createdAt));

  return { rows, total, chartSeries: series };
}

export interface VolumePoint {
  date: string;
  count: number;
}

function bucketByDay(isoStamps: string[]): VolumePoint[] {
  const buckets = new Map<string, number>();
  for (const iso of isoStamps) {
    const key = iso.slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, count]) => ({ date, count }));
}

export async function loadFilterOptions(workspaceId: string): Promise<{
  creators: { value: string; label: string }[];
  templates: { value: string; label: string }[];
}> {
  const { cols } = await getSabsmsCollections();
  const [creators, tplDocs] = await Promise.all([
    cols.campaigns.distinct("createdBy", { workspaceId } as never),
    cols.templates
      .find({ workspaceId })
      .project<{ _id: ObjectId; name: string }>({ name: 1 })
      .limit(200)
      .toArray() as Promise<Array<{ _id: ObjectId; name: string }>>,
  ]);
  return {
    creators: (creators as unknown as string[])
      .filter((c): c is string => Boolean(c))
      .map((c) => ({ value: c, label: c })),
    templates: tplDocs.map((t) => ({
      value: String(t._id),
      label: t.name,
    })),
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────

async function setStatus(
  campaignId: string,
  next: SabsmsCampaignStatus,
): Promise<VoidActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { cols } = await getSabsmsCollections();
  const res = await cols.campaigns.updateOne(
    { _id: new ObjectId(campaignId), workspaceId: ws.workspaceId },
    { $set: { status: next, updatedAt: new Date() } },
  );
  if (res.matchedCount === 0) return { ok: false, error: "Campaign not found" };
  return { ok: true };
}

/** True when the engine is intentionally off (local dev fallback). */
function engineDisabled(e: unknown): boolean {
  return (
    e instanceof SabsmsEngineError &&
    e.status === 503 &&
    e.message.includes("disabled")
  );
}

/**
 * Pause/resume/cancel go THROUGH the engine — it owns the status flip
 * (status-guarded, race-safe) plus side effects (recipient cancellation,
 * `campaignPaused` events). When the engine is disabled (dev), fall
 * back to a plain status write so the UI stays usable.
 */
async function engineStatusAction(
  campaignId: string,
  call: (id: string) => Promise<unknown>,
  fallback: SabsmsCampaignStatus,
): Promise<VoidActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  // Ownership check before touching the engine (the engine endpoint is
  // workspace-agnostic behind the service token).
  const { cols } = await getSabsmsCollections();
  const owned = await cols.campaigns.findOne(
    { _id: new ObjectId(campaignId), workspaceId: ws.workspaceId },
    { projection: { _id: 1 } },
  );
  if (!owned) return { ok: false, error: "Campaign not found" };

  try {
    await call(campaignId);
    return { ok: true };
  } catch (e) {
    if (engineDisabled(e)) return setStatus(campaignId, fallback);
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: (e as Error).message ?? "engine call failed" };
  }
}

export async function pauseCampaign(input: { campaignId: string }): Promise<VoidActionResult> {
  return engineStatusAction(
    input.campaignId,
    (id) => sabsmsEngine.pauseCampaign(id),
    "paused",
  );
}

export async function resumeCampaign(input: { campaignId: string }): Promise<VoidActionResult> {
  return engineStatusAction(
    input.campaignId,
    (id) => sabsmsEngine.resumeCampaign(id),
    "running",
  );
}

export async function cancelCampaign(input: { campaignId: string }): Promise<VoidActionResult> {
  return engineStatusAction(
    input.campaignId,
    (id) => sabsmsEngine.cancelCampaign(id),
    "cancelled",
  );
}

export async function archiveCampaign(input: { campaignId: string }): Promise<VoidActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.campaigns.updateOne(
    { _id: new ObjectId(input.campaignId), workspaceId: ws.workspaceId },
    { $set: { archived: true, updatedAt: new Date() } as never },
  );
  return { ok: true };
}

export async function duplicateCampaign(input: {
  campaignId: string;
}): Promise<ActionResult<{ newId: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { cols } = await getSabsmsCollections();
  const src = await cols.campaigns.findOne({
    _id: new ObjectId(input.campaignId),
    workspaceId: ws.workspaceId,
  });
  if (!src) return { ok: false, error: "Campaign not found" };
  const now = new Date();
  const { _id: _dropId, ...rest } = src;
  const clone: Omit<SabsmsCampaign, "_id"> = {
    ...rest,
    name: `${src.name} (copy)`,
    status: "draft",
    stats: {
      total: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      replied: 0,
      clicked: 0,
      unsubscribed: 0,
    },
    scheduledAt: undefined,
    startedAt: undefined,
    completedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
  const inserted = await cols.campaigns.insertOne(clone as SabsmsCampaign);
  return { ok: true, newId: String(inserted.insertedId) };
}

export async function addCampaignTag(input: {
  campaignId: string;
  tag: string;
}): Promise<VoidActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const tag = input.tag.trim();
  if (!tag) return { ok: false, error: "Tag cannot be empty" };
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.campaigns.updateOne(
    { _id: new ObjectId(input.campaignId), workspaceId: ws.workspaceId },
    {
      $addToSet: { tags: tag } as never,
      $set: { updatedAt: new Date() },
    },
  );
  return { ok: true };
}

export async function removeCampaignTag(input: {
  campaignId: string;
  tag: string;
}): Promise<VoidActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.campaigns.updateOne(
    { _id: new ObjectId(input.campaignId), workspaceId: ws.workspaceId },
    {
      $pull: { tags: input.tag } as never,
      $set: { updatedAt: new Date() },
    },
  );
  return { ok: true };
}

/**
 * Test-send from a campaign row — pulls the template body, replaces
 * variables with bracketed placeholders, and enqueues a single message
 * via `sabsmsEngine.enqueueSend`. Useful for sanity-checking copy
 * before pause/resume.
 */
export async function testSendFromCampaign(input: {
  campaignId: string;
  to: string;
}): Promise<ActionResult<{ id: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!input.to?.trim()) return { ok: false, error: "Recipient is required" };
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { cols } = await getSabsmsCollections();
  const campaign = await cols.campaigns.findOne({
    _id: new ObjectId(input.campaignId),
    workspaceId: ws.workspaceId,
  });
  if (!campaign) return { ok: false, error: "Campaign not found" };

  let body = "[no template body]";
  if (ObjectId.isValid(campaign.templateId)) {
    const tpl = await cols.templates.findOne({
      _id: new ObjectId(campaign.templateId),
    });
    body = tpl?.bodies?.[0]?.body ?? body;
  }
  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ws.workspaceId,
      to: input.to.trim(),
      body,
      category: campaign.category,
      templateId: campaign.templateId,
      eventKey: "sabsms.campaigns.testSend",
    });
    return { ok: true, id: res.id };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error).message ?? "send failed" };
  }
}

/**
 * Convert a campaign into a one-step drip — copies the template, marks
 * the drip enabled=false so the operator can tune it before flipping
 * it on.
 */
export async function convertCampaignToDrip(input: {
  campaignId: string;
}): Promise<ActionResult<{ dripId: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { cols } = await getSabsmsCollections();
  const campaign = await cols.campaigns.findOne({
    _id: new ObjectId(input.campaignId),
    workspaceId: ws.workspaceId,
  });
  if (!campaign) return { ok: false, error: "Campaign not found" };

  const now = new Date();
  const drip: Omit<SabsmsDrip, "_id"> = {
    workspaceId: ws.workspaceId,
    name: `${campaign.name} (drip)`,
    steps: [{ templateId: campaign.templateId, waitSeconds: 0 }],
    entryTrigger: { kind: "manual" },
    enabled: false,
    createdAt: now,
    updatedAt: now,
  };
  const inserted = await cols.drips.insertOne(drip as SabsmsDrip);
  return { ok: true, dripId: String(inserted.insertedId) };
}

/**
 * Convert a campaign body into a reusable template. Useful when an ad
 * hoc paste-list send produced copy worth saving.
 */
export async function convertCampaignToTemplate(input: {
  campaignId: string;
}): Promise<ActionResult<{ templateId: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { cols } = await getSabsmsCollections();
  const campaign = await cols.campaigns.findOne({
    _id: new ObjectId(input.campaignId),
    workspaceId: ws.workspaceId,
  });
  if (!campaign) return { ok: false, error: "Campaign not found" };

  let body = "";
  if (ObjectId.isValid(campaign.templateId)) {
    const src = await cols.templates.findOne({
      _id: new ObjectId(campaign.templateId),
    });
    body = src?.bodies?.[0]?.body ?? "";
  }

  const now = new Date();
  const tpl: Omit<SabsmsTemplate, "_id"> = {
    workspaceId: ws.workspaceId,
    name: `${campaign.name} (template)`,
    category: campaign.category,
    bodies: [{ locale: "en", body }],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  const inserted = await cols.templates.insertOne(tpl as SabsmsTemplate);
  return { ok: true, templateId: String(inserted.insertedId) };
}

// ─── Compare ───────────────────────────────────────────────────────────

export interface CampaignComparisonStat {
  metric: string;
  a: number;
  b: number;
}

export interface CampaignComparison {
  a: { id: string; name: string };
  b: { id: string; name: string };
  stats: CampaignComparisonStat[];
}

/**
 * Side-by-side compare of two campaign stat blocks. The list page mounts
 * the result inline so operators can A/B-judge two completed runs
 * without flipping between detail pages.
 *
 * TODO: extend with per-day overlay (sent / delivered) once Phase 11
 * adds an aggregation that returns dense time series per campaign id.
 */
export async function compareCampaigns(input: {
  aId: string;
  bId: string;
}): Promise<ActionResult<{ comparison: CampaignComparison }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.aId) || !ObjectId.isValid(input.bId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  if (input.aId === input.bId) {
    return { ok: false, error: "Pick two distinct campaigns" };
  }
  const { cols } = await getSabsmsCollections();
  const [a, b] = await Promise.all([
    cols.campaigns.findOne({
      _id: new ObjectId(input.aId),
      workspaceId: ws.workspaceId,
    }),
    cols.campaigns.findOne({
      _id: new ObjectId(input.bId),
      workspaceId: ws.workspaceId,
    }),
  ]);
  if (!a || !b) return { ok: false, error: "Campaign not found" };

  const stats: CampaignComparisonStat[] = [
    { metric: "Audience", a: a.stats.total, b: b.stats.total },
    { metric: "Sent", a: a.stats.sent, b: b.stats.sent },
    { metric: "Delivered", a: a.stats.delivered, b: b.stats.delivered },
    { metric: "Failed", a: a.stats.failed, b: b.stats.failed },
    { metric: "Replied", a: a.stats.replied, b: b.stats.replied },
    { metric: "Clicked", a: a.stats.clicked, b: b.stats.clicked },
    { metric: "Unsubscribed", a: a.stats.unsubscribed, b: b.stats.unsubscribed },
  ];

  return {
    ok: true,
    comparison: {
      a: { id: String(a._id), name: a.name },
      b: { id: String(b._id), name: b.name },
      stats,
    },
  };
}

// ─── V2.3: create / estimate / launch ─────────────────────────────────────

const AudienceSchema = z.union([
  z.object({ kind: z.literal("segment"), segmentId: z.string().min(1) }),
  z.object({ kind: z.literal("list"), listId: z.string().min(1) }),
  z.object({
    kind: z.literal("contacts"),
    contactIds: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("phones"),
    phones: z.array(z.string()).min(1).max(MAX_RECIPIENTS),
  }),
  z.object({
    kind: z.literal("csv"),
    importId: z.string().min(1),
    sabFileId: z.string().optional(),
  }),
]);

const ScheduleSchema = z.union([
  z.object({ kind: z.literal("now") }),
  z.object({
    kind: z.literal("scheduledAt"),
    at: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: "Invalid scheduledAt timestamp",
    }),
  }),
]);

const CreateCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    templateId: z.string().optional(),
    /** Inline body for quick broadcasts without a saved template. */
    body: z.string().max(1600).optional(),
    /** Campaign-level template vars applied to every recipient. */
    vars: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    category: z.enum(["transactional", "otp", "marketing", "alert", "service"]),
    audience: AudienceSchema,
    schedule: ScheduleSchema,
    throttlePerSec: z.number().int().min(1).max(100).optional(),
    from: z.string().optional(),
    senderNumberIds: z.array(z.string()).optional(),
    /**
     * V2.10 smart send — schedule into recipients' best engagement hours
     * (identity-graph histograms). See the comment on
     * `applySmartSendSchedule` for the dual campaign/recipient design.
     */
    smartSend: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.templateId || v.body?.trim()), {
    message: "Pick a template or write a message body",
  });

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;

/** Campaign doc extras not (yet) in the canonical schema. */
interface CampaignLaunchExtras {
  bodyOverride?: string;
  templateVars?: Record<string, string | number>;
  defaultFrom?: string;
  recipientCount?: number;
  statusReason?: string;
  /** V2.10 — recipients get per-contact `notBeforeEpochMs` at launch. */
  smartSend?: boolean;
}

/**
 * Create a campaign doc in `draft` status from a validated wizard
 * payload. Launch is a separate, explicit step
 * ([`launchCampaignAction`]) so review/estimate can sit in between.
 */
export async function createCampaignAction(
  input: CreateCampaignInput,
): Promise<ActionResult<{ id: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  const parsed = CreateCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const v = parsed.data;
  const now = new Date();
  let scheduledAt =
    v.schedule.kind === "scheduledAt" ? new Date(v.schedule.at) : undefined;

  // ── V2.10 smart send, campaign level (works TODAY) ──────────────────
  // When smart send is on and the user picked no explicit schedule, set
  // the campaign-level `scheduledAt` to the next occurrence of the
  // WORKSPACE-MEDIAN best hour from the identity graph — the existing
  // engine scheduled-campaign ticker honours `scheduledAt` already, so
  // this needs zero engine changes. Per-recipient precision is layered
  // on top at launch via `notBeforeEpochMs` (forward contract — see
  // `launchCampaignAction`). No identity signal yet → stay immediate.
  if (v.smartSend && !scheduledAt) {
    try {
      const { db } = await connectToDatabase();
      const medianHour = await workspaceMedianBestHourUtc(db, ws.workspaceId);
      if (medianHour !== null) {
        scheduledAt = new Date(nextOccurrenceUtcMs(medianHour, now));
      }
    } catch {
      // Smart send is best-effort sugar — never block campaign creation.
    }
  }

  const doc: Omit<SabsmsCampaign, "_id"> & CampaignLaunchExtras = {
    workspaceId: ws.workspaceId,
    name: v.name,
    templateId: v.templateId ?? "",
    audience: v.audience as SabsmsCampaignAudience,
    schedule: scheduledAt
      ? { kind: "scheduled", sendAt: scheduledAt }
      : { kind: "immediate" },
    throttlePerSecond: v.throttlePerSec ?? 10,
    senderStrategy: "single",
    senderNumberIds: v.senderNumberIds,
    category: v.category,
    status: "draft",
    stats: {
      total: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      replied: 0,
      clicked: 0,
      unsubscribed: 0,
    },
    scheduledAt,
    createdAt: now,
    updatedAt: now,
    ...(v.body?.trim() ? { bodyOverride: v.body.trim() } : {}),
    ...(v.vars ? { templateVars: v.vars } : {}),
    ...(v.from ? { defaultFrom: v.from } : {}),
    ...(v.smartSend ? { smartSend: true } : {}),
  };

  const { cols } = await getSabsmsCollections();
  const res = await cols.campaigns.insertOne(doc as SabsmsCampaign);
  return { ok: true, id: res.insertedId.toHexString() };
}

// ── Audience data sources (the AudienceDeps implementation) ──────────────

function contactToAudience(c: SegmentContact & { _id?: unknown }): AudienceContact {
  const vars: Record<string, string | number> = {};
  for (const [k, val] of Object.entries(c)) {
    if (k === "_id" || k === "workspaceId") continue;
    if (typeof val === "string" || typeof val === "number") vars[k] = val;
  }
  if (typeof c.name === "string" && !vars.first_name) {
    vars.first_name = c.name.split(/\s+/)[0];
  }
  return {
    to: (c.e164 ?? c.phone ?? "").trim(),
    contactId: c._id ? String(c._id) : undefined,
    vars,
  };
}

interface SegmentDocLite {
  _id?: ObjectId;
  workspaceId: string;
  kind: "static" | "dynamic";
  predicate: SegmentNode | null;
  contactIds?: string[];
}

function audienceDepsFor(workspaceId: string): AudienceDeps {
  return {
    async loadSegmentContacts(segmentId) {
      if (!ObjectId.isValid(segmentId)) {
        throw new Error("Invalid segment id");
      }
      const { db } = await connectToDatabase();
      const segment = await db
        .collection<SegmentDocLite>("sabsms_segments")
        .findOne({ _id: new ObjectId(segmentId), workspaceId });
      if (!segment) throw new Error("Segment not found");

      const contactsCol = db.collection<SegmentContact>("sabsms_contacts");
      if (segment.kind === "static") {
        const ids = (segment.contactIds ?? [])
          .filter((id) => ObjectId.isValid(id))
          .map((id) => new ObjectId(id));
        if (ids.length === 0) return [];
        const contacts = await contactsCol
          .find({ workspaceId, _id: { $in: ids } } as never)
          .limit(MAX_RECIPIENTS)
          .toArray();
        return contacts.map(contactToAudience);
      }
      // Dynamic — same evaluator + scan cap as the segments module.
      const contacts = await contactsCol
        .find({ workspaceId } as never)
        .limit(MAX_RECIPIENTS)
        .toArray();
      return contacts
        .filter((c) => evaluatePredicate(segment.predicate, c))
        .map(contactToAudience);
    },

    async loadListPhones(listId) {
      if (!ObjectId.isValid(listId)) throw new Error("Invalid list id");
      const { db } = await connectToDatabase();
      const list = await db
        .collection<{ workspaceId: string; members?: string[] }>("sabsms_lists")
        .findOne({ _id: new ObjectId(listId), workspaceId } as never);
      if (!list) throw new Error("List not found");
      return list.members ?? [];
    },

    async loadContactsByIds(contactIds) {
      const ids = contactIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
      if (ids.length === 0) return [];
      const { db } = await connectToDatabase();
      const contacts = await db
        .collection<SegmentContact>("sabsms_contacts")
        .find({ workspaceId, _id: { $in: ids } } as never)
        .limit(MAX_RECIPIENTS)
        .toArray();
      return contacts.map(contactToAudience);
    },

    async loadImportContacts(importId) {
      if (!ObjectId.isValid(importId)) throw new Error("Invalid import id");
      const { db } = await connectToDatabase();
      const imp = await db
        .collection<{ workspaceId: string; sabFileUrl?: string; mapping?: { phone?: string; name?: string; email?: string; tags?: string } }>(
          "sabsms_imports",
        )
        .findOne({ _id: new ObjectId(importId), workspaceId } as never);
      if (!imp) throw new Error("Import not found");
      if (!imp.sabFileUrl) throw new Error("Import has no source file");
      const res = await fetch(imp.sabFileUrl);
      if (!res.ok) throw new Error(`Failed to fetch import CSV (${res.status})`);
      const text = await res.text();
      return csvRowsToContacts(parseCsv(text), imp.mapping ?? {});
    },
  };
}

/** Resolve the body to render: saved template first, inline override second. */
async function resolveTemplateBody(
  workspaceId: string,
  templateId: string | undefined,
  bodyOverride: string | undefined,
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  if (templateId && ObjectId.isValid(templateId)) {
    const { cols } = await getSabsmsCollections();
    const tpl = await cols.templates.findOne({
      _id: new ObjectId(templateId),
      workspaceId,
    });
    const body = tpl?.bodies?.[0]?.body;
    if (body) return { ok: true, body };
  }
  if (bodyOverride?.trim()) return { ok: true, body: bodyOverride.trim() };
  return { ok: false, error: "Campaign has no template body" };
}

export interface EstimateCampaignInput {
  templateId?: string;
  body?: string;
  vars?: Record<string, string | number>;
  category: SabsmsCampaign["category"];
  audience: SabsmsCampaignAudience;
}

/**
 * Resolve the audience (via the SAME deps launch uses) and price the
 * campaign: exact recipient count, engine-parity segment math, the
 * credit rate card per destination country, plus quiet-hours /
 * missing-vars warnings. Read-only — nothing is persisted.
 */
export async function estimateCampaignAction(
  input: EstimateCampaignInput,
): Promise<ActionResult<{ estimate: CampaignEstimate }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  const audience = AudienceSchema.safeParse(input.audience);
  if (!audience.success) return { ok: false, error: "Invalid audience" };

  const body = await resolveTemplateBody(ws.workspaceId, input.templateId, input.body);
  if (!body.ok) return body;

  try {
    const contacts = await resolveAudience(
      audience.data as SabsmsCampaignAudience,
      audienceDepsFor(ws.workspaceId),
    );
    const estimate = estimateForContacts(
      contacts,
      body.body,
      input.category,
      input.vars,
    );
    return { ok: true, estimate };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "estimate failed" };
  }
}

/**
 * V2.11 — "~N% RCS-capable" audience hint for the campaign wizard.
 * Samples ≤200 audience phones (deterministic even-spread) against the
 * engine's batch capability endpoint (≤100/call, identity-graph
 * cached). Read-only; failures degrade to `ok: false` and the wizard
 * simply hides the hint.
 */
export async function rcsCapabilityEstimateAction(input: {
  audience: SabsmsCampaignAudience;
}): Promise<
  ActionResult<{ percent: number; sampled: number; capable: number }>
> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const audience = AudienceSchema.safeParse(input.audience);
  if (!audience.success) return { ok: false, error: "Invalid audience" };

  try {
    const contacts = await resolveAudience(
      audience.data as SabsmsCampaignAudience,
      audienceDepsFor(ws.workspaceId),
    );
    const sample = sampleForCapability(contacts.map((c) => c.to));
    if (sample.length === 0) {
      return { ok: false, error: "Audience resolved to zero phones" };
    }
    const merged: Record<string, { capable: boolean }> = {};
    for (const batch of capabilityBatches(sample)) {
      const res = await sabsmsEngine.rcsCapability(ws.workspaceId, batch);
      Object.assign(merged, res.capabilities);
    }
    const capable = Object.values(merged).filter((e) => e.capable).length;
    return {
      ok: true,
      percent: capabilityPercent(merged),
      sampled: Object.keys(merged).length,
      capable,
    };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return {
      ok: false,
      error: (e as Error).message ?? "capability estimate failed",
    };
  }
}

/**
 * Launch a draft/scheduled campaign:
 *
 *  1. resolve the audience to concrete contacts (dedupe + E.164),
 *  2. render the template PER RECIPIENT (`render.ts`, contact vars),
 *  3. bulk-insert `sabsms_campaign_recipients` in 1000-doc chunks with
 *     chunk numbers and `{campaignId}:{contactIdOrPhone}` idempotency
 *     keys (unordered inserts — duplicate keys from a previous partial
 *     launch are skipped, making relaunch-after-failure safe),
 *  4. immediate → `POST /v1/campaigns/{id}/launch`; future-dated →
 *     leave status `scheduled` for the engine ticker to promote.
 */
export async function launchCampaignAction(input: {
  campaignId: string;
}): Promise<ActionResult<{ recipients: number; scheduled: boolean }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }

  const { db } = await connectToDatabase();
  const { cols } = await getSabsmsCollections();
  const campaign = (await cols.campaigns.findOne({
    _id: new ObjectId(input.campaignId),
    workspaceId: ws.workspaceId,
  })) as (WithId<SabsmsCampaign> & CampaignLaunchExtras) | null;
  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    return {
      ok: false,
      error: `Campaign is ${campaign.status} — only draft or scheduled campaigns can launch`,
    };
  }

  const body = await resolveTemplateBody(
    ws.workspaceId,
    campaign.templateId,
    campaign.bodyOverride,
  );
  if (!body.ok) return body;

  let contacts: AudienceContact[];
  try {
    contacts = await resolveAudience(
      campaign.audience,
      audienceDepsFor(ws.workspaceId),
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "audience resolution failed" };
  }
  if (contacts.length === 0) {
    return { ok: false, error: "Audience resolved to zero valid recipients" };
  }

  let recipientDocs: SmartSendRecipientDoc[] = buildRecipientDocs(contacts, {
    campaignId: input.campaignId,
    workspaceId: ws.workspaceId,
    templateBody: body.body,
    category: campaign.category,
    from: campaign.defaultFrom,
    baseVars: campaign.templateVars,
  });

  // ── V2.10 smart send, recipient level (FORWARD CONTRACT) ────────────
  // Stamp `notBeforeEpochMs` per recipient from the identity graph's
  // best-hour histogram (one chunked `$in` lookup by phoneHash). The
  // engine ticker does NOT read this field yet — engine support lands
  // next phase; until then it is inert data the engine ignores, and the
  // campaign-level median `scheduledAt` (set at create time) is what
  // actually shifts delivery today.
  if (campaign.smartSend) {
    try {
      recipientDocs = await stampSmartSendWindows(ws.workspaceId, recipientDocs);
    } catch {
      // Best-effort: a failed identity lookup must never block launch.
    }
  }

  // Bulk insert, 1000 docs per insertMany. `ordered: false` lets Mongo
  // keep going past E11000 duplicates (idempotency keys from a previous
  // partial launch) — those recipients already exist and are skipped.
  const recipientsCol = db.collection<SmartSendRecipientDoc>(
    "sabsms_campaign_recipients",
  );
  for (const chunk of chunkArray(recipientDocs, RECIPIENT_CHUNK_SIZE)) {
    try {
      await recipientsCol.insertMany(chunk, { ordered: false });
    } catch (e) {
      const isDup =
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        ((e as { code?: number }).code === 11000 ||
          /E11000/.test(String((e as { message?: unknown }).message)));
      if (!isDup) {
        return {
          ok: false,
          error: (e as Error).message ?? "recipient insert failed",
        };
      }
    }
  }

  const scheduled =
    campaign.schedule?.kind === "scheduled" &&
    Boolean(campaign.scheduledAt) &&
    campaign.scheduledAt!.getTime() > Date.now();

  await cols.campaigns.updateOne(
    { _id: campaign._id },
    {
      $set: {
        "stats.total": recipientDocs.length,
        recipientCount: recipientDocs.length,
        ...(scheduled ? { status: "scheduled" as const } : {}),
        updatedAt: new Date(),
      } as never,
    },
  );

  if (scheduled) {
    // The engine's campaign ticker promotes `scheduled` campaigns when
    // `scheduledAt` comes due — no launch call needed.
    return { ok: true, recipients: recipientDocs.length, scheduled: true };
  }

  try {
    const res = await sabsmsEngine.launchCampaign(input.campaignId);
    return { ok: true, recipients: res.recipients, scheduled: false };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return {
        ok: false,
        error: `Engine launch failed: ${e.message}. The campaign stays ${campaign.status}; relaunching is safe (duplicate recipients are skipped).`,
      };
    }
    return { ok: false, error: (e as Error).message ?? "launch failed" };
  }
}

// ─── V2.10 smart send helpers ─────────────────────────────────────────────

/**
 * Recipient doc + the V2.10 smart-send forward contract: an optional
 * epoch-ms floor before which the engine should not claim the
 * recipient. The engine ignores the field until the next phase wires
 * it into the campaign chunk claimer — writing it now means already-
 * launched campaigns pick up per-recipient windows the moment the
 * engine ships support.
 */
type SmartSendRecipientDoc = CampaignRecipientDoc & {
  notBeforeEpochMs?: number;
};

const SMART_SEND_LOOKUP_CHUNK = 10_000;

/**
 * Batch-resolve identities for the launch list (chunked `$in` on the
 * unique `{workspaceId, phoneHash}` index) and stamp `notBeforeEpochMs`
 * on every recipient whose histogram clears the signal bar and whose
 * best hour is more than ±1h away. Recipients without identity signal
 * are returned untouched (sent on the campaign's own schedule).
 */
async function stampSmartSendWindows(
  workspaceId: string,
  docs: SmartSendRecipientDoc[],
): Promise<SmartSendRecipientDoc[]> {
  if (docs.length === 0) return docs;
  const { db } = await connectToDatabase();
  const identities = db.collection<SabsmsIdentityDoc>(
    SABSMS_IDENTITIES_COLLECTION,
  );

  const hashes = docs.map((d) => phoneHashFor(d.to));
  const byHash = new Map<string, Pick<SabsmsIdentityDoc, "sendTimeHistogram">>();
  for (let i = 0; i < hashes.length; i += SMART_SEND_LOOKUP_CHUNK) {
    const chunk = hashes.slice(i, i + SMART_SEND_LOOKUP_CHUNK);
    const found = await identities
      .find(
        { workspaceId, phoneHash: { $in: chunk } },
        { projection: { phoneHash: 1, sendTimeHistogram: 1 } },
      )
      .toArray();
    for (const id of found) {
      byHash.set(id.phoneHash, { sendTimeHistogram: id.sendTimeHistogram });
    }
  }

  const now = new Date();
  return docs.map((doc, i) => {
    const identity = byHash.get(hashes[i]);
    if (!identity) return doc;
    const delay = smartSendDelayMs(identity, now);
    return delay > 0 ? { ...doc, notBeforeEpochMs: now.getTime() + delay } : doc;
  });
}

// ─── Misc ─────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
