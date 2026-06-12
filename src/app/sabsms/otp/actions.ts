"use server";

/**
 * /sabsms/otp server actions (V2.7).
 *
 * Three surfaces, one file:
 *   - config   — read/save the workspace's `sabsms_otp_configs` doc
 *                (engine cache invalidated on every save) + engine
 *                test-send/verify/resend/lookup pass-throughs;
 *   - stats    — `GET /v1/otp/stats` conversion window per (country,
 *                prefix);
 *   - fraud    — `sabsms_fraud_blocks` list + manual add/remove and the
 *                recent `fraudBlocked`/`fraudBlockAdded` rows from
 *                `sabsms_event_log`.
 *
 * Engine 4xx outcomes (fraud-blocked, cooldown, max_resends…) are
 * EXPECTED results for the test console — they come back as
 * `{ success: false, error }` strings, never thrown.
 */

import { ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  sabsmsEngine,
  SabsmsEngineError,
  type SabsmsLookupResult,
  type SabsmsOtpSendResult,
  type SabsmsOtpStats,
  type SabsmsOtpVerifyResult,
} from "@/lib/sabsms/engine-client";
import {
  clampOtpConfig,
  normalizeBlockPrefix,
  SABSMS_OTP_CONFIG_DEFAULTS,
  type SabsmsOtpConfig,
} from "@/lib/sabsms/otp";

const OTP_CONFIGS_COLLECTION = "sabsms_otp_configs";
const FRAUD_BLOCKS_COLLECTION = "sabsms_fraud_blocks";
const EVENT_LOG_COLLECTION = "sabsms_event_log";

type ActionResult<T> = ({ success: true } & T) | { success: false; error: string };

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown } | undefined)?._id ?? "");
  return workspaceId || null;
}

function engineErrorMessage(e: unknown): string {
  if (e instanceof SabsmsEngineError) {
    // The engine's structured denials carry extra context worth surfacing.
    const body = e.body as Record<string, unknown> | null;
    if (body && typeof body === "object") {
      if (body.error === "fraud_blocked") {
        return `Blocked by the fraud guard (${String(body.code ?? "unknown")})`;
      }
      if (body.error === "cooldown") {
        return "Resend cooldown active — wait a few seconds and retry";
      }
      if (body.error === "rate_limited") {
        return `Rate limited (${String(body.scope ?? "limit")})`;
      }
      if (body.error === "max_resends") {
        return "Resend budget spent for this code";
      }
      if (body.error === "suppressed") {
        return "Recipient is suppressed (opt-out / suppression list)";
      }
    }
    return e.message;
  }
  return e instanceof Error ? e.message : "Unexpected error";
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export async function getOtpConfigAction(): Promise<
  ActionResult<{ config: SabsmsOtpConfig; exists: boolean }>
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const { db } = await connectToDatabase();
  const doc = await db
    .collection(OTP_CONFIGS_COLLECTION)
    .findOne({ workspaceId });
  if (!doc) {
    return { success: true, config: { ...SABSMS_OTP_CONFIG_DEFAULTS }, exists: false };
  }
  return { success: true, config: clampOtpConfig(doc as Record<string, unknown>), exists: true };
}

export async function saveOtpConfigAction(
  input: Partial<Record<keyof SabsmsOtpConfig, unknown>>,
): Promise<ActionResult<{ config: SabsmsOtpConfig }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const config = clampOtpConfig(input);
  const { db } = await connectToDatabase();
  await db.collection(OTP_CONFIGS_COLLECTION).updateOne(
    { workspaceId },
    {
      $set: {
        ...config,
        senderId: config.senderId ?? null,
        brandName: config.brandName ?? null,
        updatedAt: new Date(),
      },
      $setOnInsert: { workspaceId, createdAt: new Date() },
    },
    { upsert: true },
  );
  // Drop the engine's 60s config cache so the next send uses this doc.
  await sabsmsEngine.invalidateOtpConfig(workspaceId);
  return { success: true, config };
}

// ---------------------------------------------------------------------------
// Test console (engine pass-throughs)
// ---------------------------------------------------------------------------

export async function testOtpSendAction(input: {
  to: string;
}): Promise<ActionResult<{ result: SabsmsOtpSendResult }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  if (!input.to.trim()) return { success: false, error: "Phone number required" };
  try {
    const result = await sabsmsEngine.otpSend({ workspaceId, to: input.to.trim() });
    return { success: true, result };
  } catch (e) {
    return { success: false, error: engineErrorMessage(e) };
  }
}

export async function testOtpVerifyAction(input: {
  to: string;
  code: string;
}): Promise<ActionResult<{ result: SabsmsOtpVerifyResult }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  if (!input.to.trim() || !input.code.trim()) {
    return { success: false, error: "Phone number and code required" };
  }
  try {
    const result = await sabsmsEngine.otpVerify({
      workspaceId,
      to: input.to.trim(),
      code: input.code.trim(),
    });
    return { success: true, result };
  } catch (e) {
    return { success: false, error: engineErrorMessage(e) };
  }
}

export async function testOtpResendAction(input: {
  to: string;
}): Promise<ActionResult<{ result: SabsmsOtpSendResult }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  if (!input.to.trim()) return { success: false, error: "Phone number required" };
  try {
    const result = await sabsmsEngine.otpResend({ workspaceId, to: input.to.trim() });
    return { success: true, result };
  } catch (e) {
    return { success: false, error: engineErrorMessage(e) };
  }
}

export async function lookupNumberAction(input: {
  to: string;
}): Promise<ActionResult<{ result: SabsmsLookupResult }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  if (!input.to.trim()) return { success: false, error: "Phone number required" };
  try {
    const result = await sabsmsEngine.lookupNumber({ workspaceId, to: input.to.trim() });
    return { success: true, result };
  } catch (e) {
    return { success: false, error: engineErrorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Conversion stats
// ---------------------------------------------------------------------------

export async function getOtpStatsAction(): Promise<ActionResult<{ stats: SabsmsOtpStats }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  try {
    const stats = await sabsmsEngine.otpStats(workspaceId);
    return { success: true, stats };
  } catch (e) {
    return { success: false, error: engineErrorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Fraud blocks + recent fraud events
// ---------------------------------------------------------------------------

export interface SabsmsFraudBlockRow {
  id: string;
  prefix: string;
  /** "workspace" = this tenant's manual row (removable); "global" = platform/auto row. */
  scope: "workspace" | "global";
  reason: string;
  hits: number;
  createdAt: string | null;
  /** null = never expires. */
  expiresAt: string | null;
}

export interface SabsmsFraudEventRow {
  kind: string;
  at: string;
  summary: string;
}

function toIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return null;
}

export async function listFraudBlocksAction(): Promise<
  ActionResult<{ blocks: SabsmsFraudBlockRow[] }>
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const { db } = await connectToDatabase();
  const now = new Date();
  const docs = await db
    .collection(FRAUD_BLOCKS_COLLECTION)
    .find({
      $and: [
        {
          $or: [
            { workspaceId },
            { workspaceId: null },
            { workspaceId: { $exists: false } },
          ],
        },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const blocks: SabsmsFraudBlockRow[] = docs.map((d) => ({
    id: String(d._id),
    prefix: String(d.prefix ?? ""),
    scope: d.workspaceId === workspaceId ? "workspace" : "global",
    reason: String(d.reason ?? "manual"),
    hits: Number(d.hits ?? 0),
    createdAt: toIso(d.createdAt),
    expiresAt: toIso(d.expiresAt),
  }));
  return { success: true, blocks };
}

export async function addFraudBlockAction(input: {
  prefix: string;
}): Promise<ActionResult<{ block: SabsmsFraudBlockRow }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const prefix = normalizeBlockPrefix(input.prefix);
  if (!prefix) {
    return { success: false, error: "Enter an E.164 prefix like +1415555 (digits only)" };
  }

  const { db } = await connectToDatabase();
  const col = db.collection(FRAUD_BLOCKS_COLLECTION);
  const existing = await col.findOne({ workspaceId, prefix });
  if (existing) return { success: false, error: `${prefix} is already blocked` };

  const now = new Date();
  const doc = {
    workspaceId,
    prefix,
    reason: "manual",
    hits: 0,
    createdAt: now,
    expiresAt: null as Date | null,
  };
  const res = await col.insertOne(doc);
  return {
    success: true,
    block: {
      id: String(res.insertedId),
      prefix,
      scope: "workspace",
      reason: "manual",
      hits: 0,
      createdAt: now.toISOString(),
      expiresAt: null,
    },
  };
}

export async function removeFraudBlockAction(input: {
  id: string;
}): Promise<ActionResult<{ removed: boolean }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  let id: ObjectId;
  try {
    id = new ObjectId(input.id);
  } catch {
    return { success: false, error: "Invalid block id" };
  }

  // Only this tenant's own manual rows are removable — global/auto rows
  // belong to the platform fraud ticker.
  const { db } = await connectToDatabase();
  const res = await db
    .collection(FRAUD_BLOCKS_COLLECTION)
    .deleteOne({ _id: id, workspaceId });
  if (res.deletedCount === 0) {
    return { success: false, error: "Block not found (platform rows can't be removed here)" };
  }
  return { success: true, removed: true };
}

export async function listFraudEventsAction(
  limit = 20,
): Promise<ActionResult<{ events: SabsmsFraudEventRow[] }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const { db } = await connectToDatabase();
  const docs = await db
    .collection(EVENT_LOG_COLLECTION)
    .find(
      {
        $or: [
          // fraudBlocked is workspace-scoped; fraudBlockAdded rows come
          // from the global zero-conversion ticker (no workspaceId).
          { workspaceId, kind: "fraudBlocked" },
          { kind: "fraudBlockAdded" },
        ],
      },
      { projection: { kind: 1, at: 1, payload: 1 } },
    )
    .sort({ at: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray();

  const events: SabsmsFraudEventRow[] = docs.map((d) => {
    const p = (d.payload ?? {}) as Record<string, unknown>;
    const summary =
      d.kind === "fraudBlocked"
        ? `Guard hit on ${String(p.toPrefix ?? "a destination")} (${String(p.code ?? "unknown")})`
        : `Auto-blocked prefix ${String(p.prefix ?? "?")} (${String(p.reason ?? "zero_conversion")})`;
    return {
      kind: String(d.kind ?? ""),
      at: d.at instanceof Date ? d.at.toISOString() : "",
      summary,
    };
  });
  return { success: true, events };
}
