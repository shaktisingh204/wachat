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

import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import { sabsmsEngine, SabsmsEngineError } from "@/lib/sabsms/engine-client";
import type {
  SabsmsCampaign,
  SabsmsCampaignStatus,
  SabsmsDrip,
  SabsmsTemplate,
} from "@/lib/sabsms/types";

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

export async function pauseCampaign(input: { campaignId: string }): Promise<VoidActionResult> {
  return setStatus(input.campaignId, "paused");
}

export async function resumeCampaign(input: { campaignId: string }): Promise<VoidActionResult> {
  return setStatus(input.campaignId, "running");
}

export async function cancelCampaign(input: { campaignId: string }): Promise<VoidActionResult> {
  return setStatus(input.campaignId, "cancelled");
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

// ─── Misc ─────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
