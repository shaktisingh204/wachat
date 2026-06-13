"use server";

/**
 * SabSMS — campaign detail (Page 8) server actions + aggregations.
 *
 * The detail page reads every chart series, funnel step, and webhook
 * log directly from Mongo so the dashboard stays correct without a
 * pre-computed materialised view. The Rust engine owns the canonical
 * documents — Next reads + writes UX layer state (shares, schedule
 * edits) and dispatches mutations (pause / resume / cancel / clone /
 * convert-to-drip) by flipping `status` / cloning docs.
 */

import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Db, type Filter, type WithId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  SABSMS_COLLECTIONS,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import type {
  SabsmsCampaign,
  SabsmsCampaignStatus,
  SabsmsDrip,
  SabsmsLinkClick,
  SabsmsMessage,
  SabsmsMessageStatus,
  SabsmsWebhookDelivery,
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

// ─── View models ──────────────────────────────────────────────────────────

export interface CampaignDetail {
  id: string;
  name: string;
  status: SabsmsCampaignStatus;
  category: string;
  templateId: string;
  templateName?: string;
  audienceSize: number;
  stats: SabsmsCampaign["stats"];
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  scheduleKind: string;
  senderStrategy: SabsmsCampaign["senderStrategy"];
  abVariant?: string;
}

export interface TimelinePoint {
  bucket: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface FunnelStep {
  label: string;
  count: number;
}

export interface ProviderBreakdown {
  provider: string;
  count: number;
}

export interface CountryBreakdown {
  country: string;
  count: number;
}

export interface SenderRotation {
  sender: string;
  count: number;
}

export interface ReplyPoint {
  bucket: string;
  count: number;
}

export interface OptOutPoint {
  bucket: string;
  count: number;
}

export interface RecipientRow {
  id: string;
  to: string;
  status: SabsmsMessageStatus;
  provider: string;
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
  segments?: number;
  cost?: number;
  variant?: string;
}

export interface CostMargin {
  cost: number; // cents — wholesale
  price: number; // cents — retail
  margin: number; // cents
  marginPct: number;
}

export interface AbComparison {
  variants: Array<{
    label: string;
    sent: number;
    delivered: number;
    clicked: number;
    replied: number;
  }>;
}

export interface ClickHeatRow {
  url: string;
  clicks: number;
  uniqueContacts: number;
}

export interface WebhookFireRow {
  id: string;
  event: string;
  status: SabsmsWebhookDelivery["status"];
  attempts: number;
  createdAt?: string;
  deliveredAt?: string;
  lastResponseSnippet?: string;
}

export interface CampaignDetailBundle {
  detail: CampaignDetail | null;
  timeline: TimelinePoint[];
  funnel: FunnelStep[];
  providers: ProviderBreakdown[];
  countries: CountryBreakdown[];
  senderRotation: SenderRotation[];
  replies: ReplyPoint[];
  optOuts: OptOutPoint[];
  clickHeat: ClickHeatRow[];
  recipients: RecipientRow[];
  webhookFires: WebhookFireRow[];
  costMargin: CostMargin;
  ab: AbComparison;
}

// ─── Projection helpers ──────────────────────────────────────────────────

function projectDetail(
  doc: WithId<SabsmsCampaign & { abVariant?: string }>,
  templateName?: string,
): CampaignDetail {
  return {
    id: String(doc._id),
    name: doc.name,
    status: doc.status,
    category: doc.category,
    templateId: doc.templateId,
    templateName,
    audienceSize: doc.stats?.total ?? 0,
    stats: doc.stats ?? {
      total: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      replied: 0,
      clicked: 0,
      unsubscribed: 0,
    },
    scheduledAt: doc.scheduledAt?.toISOString(),
    startedAt: doc.startedAt?.toISOString(),
    completedAt: doc.completedAt?.toISOString(),
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
    scheduleKind: doc.schedule?.kind ?? "immediate",
    senderStrategy: doc.senderStrategy,
    abVariant: doc.abVariant,
  };
}

function projectRecipient(
  doc: WithId<SabsmsMessage & { variant?: string }>,
): RecipientRow {
  return {
    id: String(doc._id),
    to: doc.to,
    status: doc.status,
    provider: doc.provider,
    sentAt: doc.sentAt?.toISOString(),
    deliveredAt: doc.deliveredAt?.toISOString(),
    errorMessage: doc.errorMessage,
    segments: doc.segmentsCount,
    cost: doc.cost,
    variant: doc.variant,
  };
}

// ─── Public bundle loader ────────────────────────────────────────────────

export async function loadCampaignDetail(
  workspaceId: string,
  campaignId: string,
): Promise<CampaignDetailBundle> {
  const empty: CampaignDetailBundle = {
    detail: null,
    timeline: [],
    funnel: [],
    providers: [],
    countries: [],
    senderRotation: [],
    replies: [],
    optOuts: [],
    clickHeat: [],
    recipients: [],
    webhookFires: [],
    costMargin: { cost: 0, price: 0, margin: 0, marginPct: 0 },
    ab: { variants: [] },
  };

  if (!ObjectId.isValid(campaignId)) return empty;

  const { db, cols } = await getSabsmsCollections();
  const campaign = (await cols.campaigns.findOne({
    _id: new ObjectId(campaignId),
    workspaceId,
  })) as WithId<SabsmsCampaign & { abVariant?: string }> | null;
  if (!campaign) return empty;

  let templateName: string | undefined;
  if (ObjectId.isValid(campaign.templateId)) {
    const t = await cols.templates.findOne({
      _id: new ObjectId(campaign.templateId),
    });
    templateName = t?.name;
  }

  const messageFilter: Filter<SabsmsMessage> = { workspaceId, campaignId };

  const [
    timeline,
    providers,
    countries,
    senderRotation,
    replies,
    optOuts,
    clickHeat,
    recipients,
    webhookFires,
    costMargin,
    ab,
  ] = await Promise.all([
    runTimeline(db, messageFilter),
    runProviders(db, messageFilter),
    runCountries(db, messageFilter),
    runSenderRotation(db, messageFilter),
    runReplies(db, workspaceId, campaignId),
    runOptOuts(db, workspaceId, campaignId),
    runClickHeat(db, workspaceId, campaignId),
    runRecipients(db, messageFilter),
    runWebhookFires(db, workspaceId, campaignId),
    runCostMargin(db, messageFilter),
    runAbComparison(db, messageFilter),
  ]);

  const stats = campaign.stats ?? {
    total: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    replied: 0,
    clicked: 0,
    unsubscribed: 0,
  };
  const funnel: FunnelStep[] = [
    { label: "queued", count: stats.queued + stats.sent + stats.delivered + stats.failed },
    { label: "sent", count: stats.sent + stats.delivered },
    { label: "delivered", count: stats.delivered },
    { label: "clicked", count: stats.clicked },
    { label: "converted", count: 0 },
  ];

  return {
    detail: projectDetail(campaign, templateName),
    timeline,
    funnel,
    providers,
    countries,
    senderRotation,
    replies,
    optOuts,
    clickHeat,
    recipients,
    webhookFires,
    costMargin,
    ab,
  };
}

// ─── Aggregations ────────────────────────────────────────────────────────

async function runTimeline(
  db: Db,
  filter: Filter<SabsmsMessage>,
): Promise<TimelinePoint[]> {
  const rows = await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .aggregate<{
      _id: string;
      sent: number;
      delivered: number;
      failed: number;
    }>([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%dT%H:%M",
              date: { $ifNull: ["$sentAt", "$createdAt"] },
            },
          },
          sent: {
            $sum: { $cond: [{ $in: ["$status", ["sent", "delivered"]] }, 1, 0] },
          },
          delivered: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 200 },
    ])
    .toArray();
  return rows.map((r) => ({
    bucket: r._id,
    sent: r.sent,
    delivered: r.delivered,
    failed: r.failed,
  }));
}

async function runProviders(
  db: Db,
  filter: Filter<SabsmsMessage>,
): Promise<ProviderBreakdown[]> {
  const rows = await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: "$provider", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ])
    .toArray();
  return rows.map((r) => ({ provider: r._id ?? "unknown", count: r.count }));
}

async function runCountries(
  db: Db,
  filter: Filter<SabsmsMessage>,
): Promise<CountryBreakdown[]> {
  // Country bucket — derived from the destination prefix. Real ISO
  // mapping happens server-side once the engine writes a `destCountry`
  // field; until then we group by the leading "+CC" prefix.
  const rows = await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .aggregate<{ _id: string; count: number }>([
      { $match: filter },
      {
        $group: {
          _id: { $substrBytes: ["$to", 0, 3] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ])
    .toArray();
  return rows.map((r) => ({ country: r._id ?? "unknown", count: r.count }));
}

async function runSenderRotation(
  db: Db,
  filter: Filter<SabsmsMessage>,
): Promise<SenderRotation[]> {
  const rows = await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: "$from", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])
    .toArray();
  return rows.map((r) => ({ sender: r._id ?? "unknown", count: r.count }));
}

async function runReplies(
  db: Db,
  workspaceId: string,
  campaignId: string,
): Promise<ReplyPoint[]> {
  const rows = await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          workspaceId,
          campaignId,
          direction: "inbound",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%dT%H:%M",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 200 },
    ])
    .toArray();
  return rows.map((r) => ({ bucket: r._id, count: r.count }));
}

async function runOptOuts(
  db: Db,
  workspaceId: string,
  campaignId: string,
): Promise<OptOutPoint[]> {
  // Opt-outs are stamped as "suppressed" status on the outbound row plus
  // a consent log entry. For per-campaign timeline we read consentLog
  // joined to messages by phoneHash + campaign id.
  const rows = await db
    .collection(SABSMS_COLLECTIONS.consentLog)
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          workspaceId,
          kind: { $in: ["opt_out_stop", "opt_out_manual"] },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%dT%H:%M",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 200 },
    ])
    .toArray();
  // The filter above isn't campaign-scoped because consentLog doesn't
  // carry a campaignId today — a follow-up will join through
  // phoneHash → messages.campaignId. For Phase 1 we surface the
  // workspace-wide opt-out timeline so the chart is never blank.
  void campaignId;
  return rows.map((r) => ({ bucket: r._id, count: r.count }));
}

async function runClickHeat(
  db: Db,
  workspaceId: string,
  campaignId: string,
): Promise<ClickHeatRow[]> {
  const rows = await db
    .collection<SabsmsLinkClick>(SABSMS_COLLECTIONS.linkClicks)
    .aggregate<{
      _id: string;
      clicks: number;
      uniqueContacts: number;
    }>([
      { $match: { workspaceId, campaignId } },
      {
        $group: {
          _id: "$shortLinkId",
          clicks: { $sum: 1 },
          uniqueContacts: { $addToSet: "$contactId" },
        },
      },
      {
        $project: {
          clicks: 1,
          uniqueContacts: { $size: "$uniqueContacts" },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 20 },
    ])
    .toArray();
  return rows.map((r) => ({
    url: r._id ?? "unknown",
    clicks: r.clicks,
    uniqueContacts: r.uniqueContacts,
  }));
}

async function runRecipients(
  db: Db,
  filter: Filter<SabsmsMessage>,
): Promise<RecipientRow[]> {
  const docs = (await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()) as Array<WithId<SabsmsMessage & { variant?: string }>>;
  return docs.map(projectRecipient);
}

async function runWebhookFires(
  db: Db,
  workspaceId: string,
  campaignId: string,
): Promise<WebhookFireRow[]> {
  // `sabsms_webhook_deliveries` carries `payload` opaquely; for the
  // detail view we surface the most recent fires that mention this
  // campaign id anywhere in the payload tree. Indexing on payload
  // fields would be wasteful — string match keeps the query simple.
  const docs = (await db
    .collection<SabsmsWebhookDelivery>(SABSMS_COLLECTIONS.webhookDeliveries)
    .find({
      workspaceId,
      $or: [
        { "payload.campaignId": campaignId } as never,
        { "payload.campaign_id": campaignId } as never,
      ],
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()) as Array<WithId<SabsmsWebhookDelivery>>;
  return docs.map((d) => ({
    id: String(d._id),
    event: d.event,
    status: d.status,
    attempts: d.attempts?.length ?? 0,
    createdAt: d.createdAt?.toISOString(),
    deliveredAt: d.deliveredAt?.toISOString(),
    lastResponseSnippet:
      d.attempts && d.attempts.length > 0
        ? d.attempts[d.attempts.length - 1].responseSnippet
        : undefined,
  }));
}

async function runCostMargin(
  db: Db,
  filter: Filter<SabsmsMessage>,
): Promise<CostMargin> {
  const rows = await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .aggregate<{ _id: null; cost: number; price: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          cost: { $sum: { $ifNull: ["$cost", 0] } },
          price: { $sum: { $ifNull: ["$price", 0] } },
        },
      },
    ])
    .toArray();
  const row = rows[0];
  const cost = row?.cost ?? 0;
  const price = row?.price ?? 0;
  const margin = price - cost;
  const marginPct = price > 0 ? Math.round((margin / price) * 1000) / 10 : 0;
  return { cost, price, margin, marginPct };
}

async function runAbComparison(
  db: Db,
  filter: Filter<SabsmsMessage>,
): Promise<AbComparison> {
  const rows = await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .aggregate<{
      _id: string | null;
      sent: number;
      delivered: number;
      clicked: number;
      replied: number;
    }>([
      { $match: filter },
      {
        $group: {
          _id: "$variant",
          sent: {
            $sum: { $cond: [{ $in: ["$status", ["sent", "delivered"]] }, 1, 0] },
          },
          delivered: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          clicked: { $sum: 0 },
          replied: { $sum: 0 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 5 },
    ])
    .toArray();
  return {
    variants: rows.map((r) => ({
      label: r._id ?? "A",
      sent: r.sent,
      delivered: r.delivered,
      clicked: r.clicked,
      replied: r.replied,
    })),
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────

/**
 * Pause / resume / cancel go THROUGH the engine (status-guarded, race-safe,
 * with side effects — recipient cancellation, `campaignPaused` events). The
 * list-level `../actions` implementations own that engine plumbing with a
 * dev-mode plain-status fallback when the engine is disabled; we delegate to
 * them so the detail page no longer bypasses the engine with a bare Mongo
 * status flip (which left recipients pending and skipped transition guards).
 */
export {
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
} from "../actions";

export async function editSchedule(input: {
  campaignId: string;
  sendAtIso: string;
}): Promise<VoidActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const when = new Date(input.sendAtIso);
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: "Invalid date" };
  }
  const { cols } = await getSabsmsCollections();
  const target = await cols.campaigns.findOne({
    _id: new ObjectId(input.campaignId),
    workspaceId: ws.workspaceId,
  });
  if (!target) return { ok: false, error: "Campaign not found" };
  if (target.status === "running" || target.status === "completed") {
    return { ok: false, error: "Cannot edit schedule once running or completed" };
  }
  await cols.campaigns.updateOne(
    { _id: new ObjectId(input.campaignId), workspaceId: ws.workspaceId },
    {
      $set: {
        schedule: { kind: "scheduled", sendAt: when },
        scheduledAt: when,
        status: "scheduled",
        updatedAt: new Date(),
      },
    },
  );
  return { ok: true };
}

export async function cloneCampaign(input: {
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
  const inserted = await cols.campaigns.insertOne({
    ...rest,
    name: `${src.name} (clone)`,
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
  } as SabsmsCampaign);
  return { ok: true, newId: String(inserted.insertedId) };
}

export async function convertToDrip(input: {
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

// ─── Export helpers ──────────────────────────────────────────────────────

export async function exportRecipientsCsv(input: {
  campaignId: string;
}): Promise<ActionResult<{ csv: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .find({ workspaceId: ws.workspaceId, campaignId: input.campaignId })
    .limit(10_000)
    .toArray()) as Array<WithId<SabsmsMessage>>;
  const head = "id,to,status,provider,sentAt,deliveredAt,errorMessage";
  const body = docs
    .map((d) =>
      [
        String(d._id),
        d.to,
        d.status,
        d.provider,
        d.sentAt?.toISOString() ?? "",
        d.deliveredAt?.toISOString() ?? "",
        (d.errorMessage ?? "").replace(/[",\n]/g, " "),
      ].join(","),
    )
    .join("\n");
  return { ok: true, csv: `${head}\n${body}` };
}

export async function exportEventsJsonl(input: {
  campaignId: string;
}): Promise<ActionResult<{ jsonl: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .find({ workspaceId: ws.workspaceId, campaignId: input.campaignId })
    .limit(10_000)
    .toArray()) as Array<WithId<SabsmsMessage>>;
  const jsonl = docs.map((d) => JSON.stringify(d)).join("\n");
  return { ok: true, jsonl };
}

export async function resendFailures(input: {
  campaignId: string;
}): Promise<ActionResult<{ csv: string; count: number }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .find({
      workspaceId: ws.workspaceId,
      campaignId: input.campaignId,
      status: { $in: ["failed", "undelivered", "rejected"] },
    })
    .limit(10_000)
    .toArray()) as Array<WithId<SabsmsMessage>>;
  const csv = `to,errorMessage\n${docs
    .map((d) => `${d.to},${(d.errorMessage ?? "").replace(/[",\n]/g, " ")}`)
    .join("\n")}`;
  return { ok: true, csv, count: docs.length };
}

// ─── Public share ───────────────────────────────────────────────────────

/**
 * Mint a read-only share token for the campaign analytics. The token is
 * persisted to `sabsms_analytics_shares` (best-effort — the collection
 * is created on first write).
 *
 * TODO: build the read-side route at `/sabsms/share/[token]` that
 * resolves the token, scopes by the embedded `campaignId`, and renders
 * the same charts as this page but without the mutation surface.
 */
export async function createPublicShare(input: {
  campaignId: string;
}): Promise<ActionResult<{ url: string; token: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.campaignId)) {
    return { ok: false, error: "Invalid campaignId" };
  }
  const token = randomBytes(16).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { db } = await connectToDatabase();
  await db.collection("sabsms_analytics_shares").insertOne({
    workspaceId: ws.workspaceId,
    campaignId: input.campaignId,
    tokenHash,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  // The viewer route is a stub today; the token is still useful for
  // copy + audit. See TODO above.
  return { ok: true, token, url: `/sabsms/share/${token}` };
}
