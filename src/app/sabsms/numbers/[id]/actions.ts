"use server";

/**
 * SabSMS — number detail server actions.
 *
 * Page 26 (`/sabsms/numbers/[id]`) — exposes server actions for:
 *   1. Loading detail-page data (the number doc + send/inbound history,
 *      template names for the per-template aggregator).
 *   2. Updating per-number overrides (throttle, quiet hours, webhooks,
 *      sender id, pool membership).
 *   3. Releasing the number with a grace period.
 *   4. Filing a port-out request (stub).
 *   5. Triggering a test send from this number.
 *
 * Mutations write an audit-log entry; the audit-log drawer on the
 * detail page reads from `sabsms_audit_log`. All work is scoped by
 * `workspaceId` (resolved from `getCachedSession()`).
 */

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

import { getCachedSession } from "@/lib/server-cache";
import { connectToDatabase } from "@/lib/mongodb";
import {
  SABSMS_COLLECTIONS,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import {
  sabsmsEngine,
  SabsmsEngineError,
} from "@/lib/sabsms/engine-client";
import type { SabsmsMessage, SabsmsNumber } from "@/lib/sabsms/types";

import type {
  ComplianceStatus,
  DestinationCountryRow,
  NumberCostPoint,
  NumberHealthPoint,
  NumberVolumePoint,
  QuietHoursConfig,
  SendHistoryRow,
  TemplatePerformanceRow,
  ThrottleConfig,
  NumberWebhooks,
} from "./helpers";
import {
  aggregateByCountry,
  aggregateByTemplate,
  aggregateCost,
  aggregateHealth,
  aggregateVolume,
  deriveComplianceStatus,
  projectSendHistory,
} from "./helpers";

export type ActionResult<
  T extends Record<string, unknown> = Record<string, never>,
> = ({ ok: true } & T) | { ok: false; error: string };

// ─── Workspace helpers ────────────────────────────────────────────────────

async function resolveWorkspaceOk(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

async function writeAuditLog(entry: {
  workspaceId: string;
  action: string;
  detail: Record<string, unknown>;
}): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabsms_audit_log");
  await col.insertOne({
    workspaceId: entry.workspaceId,
    action: entry.action,
    detail: entry.detail,
    createdAt: new Date(),
  });
}

// ─── Detail view shape ───────────────────────────────────────────────────

export interface NumberDetailView {
  id: string;
  e164: string;
  country: string;
  type: SabsmsNumber["type"];
  provider: SabsmsNumber["provider"];
  status: SabsmsNumber["status"];
  monthlyCost: number; // cents
  createdAt: string;
  capabilities: SabsmsNumber["capabilities"];
  throttle: ThrottleConfig;
  quietHours: QuietHoursConfig;
  webhooks: NumberWebhooks;
  senderIdAlpha?: string;
  poolId?: string;
  campaigns: Array<{ id: string; name: string }>;
  pools: Array<{ id: string; name: string }>;
  health: NumberHealthPoint[];
  volume: NumberVolumePoint[];
  cost: NumberCostPoint[];
  countries: DestinationCountryRow[];
  templatePerformance: TemplatePerformanceRow[];
  sendHistory: SendHistoryRow[];
  inboundHistory: SendHistoryRow[];
  compliance: ComplianceStatus;
  audit: Array<{
    action: string;
    createdAt: string;
    detail: Record<string, unknown>;
  }>;
  carrier: {
    operator: string;
    country: string;
    lineType: string;
    stub: boolean;
  };
}

const DEFAULT_THROTTLE: ThrottleConfig = { perSecond: 10, perMinute: 600 };
const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: false,
  timezone: "UTC",
  startHour: 22,
  endHour: 8,
};

// ─── Loader ───────────────────────────────────────────────────────────────

export async function loadNumberDetail(
  numberId: string,
): Promise<NumberDetailView | null> {
  const ws = await resolveWorkspaceOk();
  if (!ws.ok) return null;
  if (!ObjectId.isValid(numberId)) return null;

  const { db, cols } = await getSabsmsCollections();
  const doc = await cols.numbers.findOne({
    _id: new ObjectId(numberId),
    workspaceId: ws.workspaceId,
  });
  if (!doc) return null;

  const messageWindowStart = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const messages = await cols.messages
    .find({
      workspaceId: ws.workspaceId,
      $or: [{ from: doc.e164 }, { to: doc.e164 }],
      createdAt: { $gte: messageWindowStart },
    })
    .sort({ createdAt: -1 })
    .limit(1000)
    .toArray();

  const outbound = messages.filter((m) => m.direction === "outbound");
  const inbound = messages.filter((m) => m.direction === "inbound");

  // Template name lookup for the per-template aggregator.
  const templateIds = Array.from(
    new Set(
      outbound
        .map((m) => m.templateId)
        .filter((v): v is string => Boolean(v) && ObjectId.isValid(v ?? "")),
    ),
  );
  const templates = templateIds.length
    ? await cols.templates
        .find(
          { _id: { $in: templateIds.map((id) => new ObjectId(id)) } },
          { projection: { name: 1 } },
        )
        .toArray()
    : [];
  const templateNames = new Map<string, string>(
    templates.map((t) => [String(t._id), t.name]),
  );

  const campaigns = await cols.campaigns
    .find(
      {
        workspaceId: ws.workspaceId,
        senderNumberIds: String(doc._id),
      },
      { projection: { name: 1 } },
    )
    .limit(20)
    .toArray();

  // 10DLC / DLT readiness — Phase 1 stub: piggyback on the Twilio
  // provider-account row's presence.
  const providerAccounts = await cols.providerAccounts
    .find({ workspaceId: ws.workspaceId }, { projection: { provider: 1 } })
    .toArray();
  const hasConsentLog =
    (await cols.consentLog.countDocuments(
      { workspaceId: ws.workspaceId },
      { limit: 1 },
    )) > 0;

  // Audit log entries scoped to this number.
  const audit = await db
    .collection("sabsms_audit_log")
    .find({
      workspaceId: ws.workspaceId,
      $or: [
        { "detail.numberId": String(doc._id) },
        { "detail.e164": doc.e164 },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const now = new Date();
  const docAny = doc as unknown as Record<string, unknown>;

  return {
    id: String(doc._id),
    e164: doc.e164,
    country: doc.country,
    type: doc.type,
    provider: doc.provider,
    status: doc.status,
    monthlyCost: doc.monthlyCost ?? 0,
    createdAt: (doc.createdAt instanceof Date
      ? doc.createdAt
      : new Date(doc.createdAt as never)
    ).toISOString(),
    capabilities: doc.capabilities,
    throttle:
      (docAny.throttle as ThrottleConfig | undefined) ?? DEFAULT_THROTTLE,
    quietHours:
      (docAny.quietHours as QuietHoursConfig | undefined) ??
      DEFAULT_QUIET_HOURS,
    webhooks: (docAny.webhooks as NumberWebhooks | undefined) ?? {},
    senderIdAlpha: docAny.senderIdAlpha as string | undefined,
    poolId: docAny.poolId as string | undefined,
    campaigns: campaigns.map((c) => ({
      id: String(c._id),
      name: c.name ?? "Untitled",
    })),
    pools: [{ id: "default", name: "Default pool" }],
    health: aggregateHealth(outbound as never, now, 30),
    volume: aggregateVolume(outbound as never, now, 30),
    cost: aggregateCost(outbound as never, now, 30),
    countries: aggregateByCountry(outbound as never),
    templatePerformance: aggregateByTemplate(outbound as never, templateNames),
    sendHistory: outbound
      .slice(0, 200)
      .map((m) => projectSendHistory(m as never)),
    inboundHistory: inbound
      .slice(0, 200)
      .map((m) => projectSendHistory(m as never)),
    compliance: deriveComplianceStatus({
      country: doc.country,
      type: doc.type,
      tendlcRegistered: providerAccounts.some((p) => p.provider === "twilio"),
      dltRegistered: false,
      hasConsentLog,
    }),
    audit: audit.map((a) => ({
      action: a.action as string,
      createdAt: (a.createdAt instanceof Date
        ? a.createdAt
        : new Date(a.createdAt as never)
      ).toISOString(),
      detail: (a.detail as Record<string, unknown>) ?? {},
    })),
    // TODO(engine): carrier lookup ships with the HLR feature — Phase 7.
    carrier: {
      operator: "—",
      country: doc.country,
      lineType: doc.type,
      stub: true,
    },
  };
}

// ─── Mutations: per-number overrides ─────────────────────────────────────

interface OverridePatch {
  numberId: string;
  throttle?: ThrottleConfig;
  quietHours?: QuietHoursConfig;
  webhooks?: NumberWebhooks;
  senderIdAlpha?: string | null;
  poolId?: string | null;
}

export async function saveNumberOverrides(
  patch: OverridePatch,
): Promise<ActionResult> {
  const ws = await resolveWorkspaceOk();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(patch.numberId)) {
    return { ok: false, error: "Invalid numberId" };
  }

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  const $unset: Record<string, "" > = {};
  if (patch.throttle) $set.throttle = patch.throttle;
  if (patch.quietHours) $set.quietHours = patch.quietHours;
  if (patch.webhooks) $set.webhooks = patch.webhooks;
  if (patch.senderIdAlpha === null) $unset.senderIdAlpha = "";
  else if (patch.senderIdAlpha !== undefined)
    $set.senderIdAlpha = patch.senderIdAlpha;
  if (patch.poolId === null) $unset.poolId = "";
  else if (patch.poolId !== undefined) $set.poolId = patch.poolId;

  const { cols } = await getSabsmsCollections();
  const updateDoc: Record<string, unknown> = { $set };
  if (Object.keys($unset).length > 0) updateDoc.$unset = $unset;

  await cols.numbers.updateOne(
    {
      _id: new ObjectId(patch.numberId),
      workspaceId: ws.workspaceId,
    },
    updateDoc,
  );

  await writeAuditLog({
    workspaceId: ws.workspaceId,
    action: "sabsms.number.override",
    detail: { numberId: patch.numberId, patch },
  });

  revalidatePath(`/sabsms/numbers/${patch.numberId}`);
  return { ok: true };
}

// ─── Mutation: release with grace ────────────────────────────────────────

export async function releaseNumber(input: {
  numberId: string;
  graceHours: number;
}): Promise<ActionResult> {
  const ws = await resolveWorkspaceOk();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.numberId)) {
    return { ok: false, error: "Invalid numberId" };
  }
  if (input.graceHours < 0 || input.graceHours > 24 * 30) {
    return { ok: false, error: "Grace must be 0–720 hours" };
  }
  const { cols } = await getSabsmsCollections();
  const releaseAt = new Date(Date.now() + input.graceHours * 3600 * 1000);

  await cols.numbers.updateOne(
    {
      _id: new ObjectId(input.numberId),
      workspaceId: ws.workspaceId,
    },
    {
      $set: {
        status: "releasing",
        updatedAt: new Date(),
        ...({ scheduledReleaseAt: releaseAt } as Record<string, unknown>),
      },
    },
  );

  await writeAuditLog({
    workspaceId: ws.workspaceId,
    action: "sabsms.number.release",
    detail: {
      numberId: input.numberId,
      graceHours: input.graceHours,
      releaseAt: releaseAt.toISOString(),
    },
  });

  revalidatePath(`/sabsms/numbers/${input.numberId}`);
  revalidatePath("/sabsms/numbers");
  return { ok: true };
}

// ─── Mutation: port-out (stub) ───────────────────────────────────────────

export async function requestPortOut(input: {
  numberId: string;
  newCarrier: string;
  contactEmail: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspaceOk();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.numberId)) {
    return { ok: false, error: "Invalid numberId" };
  }
  if (!input.newCarrier.trim()) {
    return { ok: false, error: "Target carrier is required" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
    return { ok: false, error: "A valid contact email is required" };
  }

  // TODO(engine): the engine doesn't yet support carrier port-outs.
  // Phase 7+ will introduce `/v1/numbers/{id}/port-out`. For now we
  // queue the request in the audit log so support can pick it up.
  await writeAuditLog({
    workspaceId: ws.workspaceId,
    action: "sabsms.number.port_out_request",
    detail: { ...input, stub: true },
  });
  return { ok: true };
}

// ─── Mutation: reassign to sender pool ──────────────────────────────────

export async function reassignToPool(input: {
  numberId: string;
  poolId: string;
}): Promise<ActionResult> {
  return saveNumberOverrides({
    numberId: input.numberId,
    poolId: input.poolId,
  });
}

// ─── Mutation: test send ─────────────────────────────────────────────────

export async function testSendFromNumber(input: {
  numberId: string;
  toE164: string;
  body: string;
}): Promise<ActionResult<{ messageId: string }>> {
  const ws = await resolveWorkspaceOk();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.numberId)) {
    return { ok: false, error: "Invalid numberId" };
  }
  if (!input.body.trim()) {
    return { ok: false, error: "Body cannot be empty" };
  }
  if (!input.toE164.startsWith("+")) {
    return { ok: false, error: "Target must be E.164 (start with +)" };
  }

  const { cols } = await getSabsmsCollections();
  const num = await cols.numbers.findOne({
    _id: new ObjectId(input.numberId),
    workspaceId: ws.workspaceId,
  });
  if (!num) return { ok: false, error: "Number not found" };

  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ws.workspaceId,
      to: input.toE164,
      from: num.e164,
      body: input.body,
      category: "service",
      eventKey: "sabsms.number.test_send",
    });
    await writeAuditLog({
      workspaceId: ws.workspaceId,
      action: "sabsms.number.test_send",
      detail: {
        numberId: input.numberId,
        e164: num.e164,
        toE164: input.toE164,
        engineStatus: res.status,
      },
    });
    return { ok: true, messageId: res.id };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return {
      ok: false,
      error: (e as Error)?.message ?? "Engine send failed",
    };
  }
}

export { SABSMS_COLLECTIONS };
