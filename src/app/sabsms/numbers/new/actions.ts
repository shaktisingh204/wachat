"use server";

/**
 * SabSMS — number provisioning server actions.
 *
 * Page 25 (`/sabsms/numbers/new`) — exposes server actions for:
 *   1. Searching available numbers from a provider (mocked for Phase 1
 *      — the engine doesn't have a search endpoint yet).
 *   2. Provisioning one or more numbers + writing the audit log.
 *   3. Saving the draft for admin approval.
 *   4. Triggering a stub test-call (voice-capable lookup).
 *
 * All work is scoped by `workspaceId` (resolved from
 * `getCachedSession()`). Phase 1 only Twilio is wired through —
 * other providers come in Phase 7. Pure helpers (validators, mock
 * data) live in `./helpers.ts` so the unit suite can import them
 * without dragging in `server-only`.
 */

import { revalidatePath } from "next/cache";

import { getCachedSession } from "@/lib/server-cache";
import { connectToDatabase } from "@/lib/mongodb";
import {
  SABSMS_COLLECTIONS,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import type { SabsmsNumber } from "@/lib/sabsms/types";

import {
  SUPPORTED_PROVIDERS,
  generateMockAvailableNumbers,
  providerLabel,
  validateProvisionInput,
  type AvailableNumber,
  type ProvisionInput,
  type SearchAvailableInput,
} from "./helpers";

export type ActionResult<
  T extends Record<string, unknown> = Record<string, never>,
> = ({ ok: true } & T) | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspaceOk(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

// ─── Mutation: search ─────────────────────────────────────────────────────

export async function searchAvailableNumbers(
  input: SearchAvailableInput,
): Promise<ActionResult<{ numbers: AvailableNumber[] }>> {
  const ws = await resolveWorkspaceOk();
  if (!ws.ok) return ws;
  if (!SUPPORTED_PROVIDERS.includes(input.provider)) {
    return {
      ok: false,
      error: `${providerLabel(input.provider)} is not available yet (Phase 7)`,
    };
  }
  if (!input.country || input.country.length !== 2) {
    return { ok: false, error: "Country must be ISO-3166-1 alpha-2" };
  }
  // TODO(engine): replace with `sabsmsEngine.searchAvailable(...)`
  // when the Rust side exposes the endpoint.
  const numbers = generateMockAvailableNumbers(input);
  return { ok: true, numbers };
}

// ─── Mutation: provision ─────────────────────────────────────────────────

export async function provisionNumbers(
  input: ProvisionInput,
): Promise<ActionResult<{ ids: string[] }>> {
  const ws = await resolveWorkspaceOk();
  if (!ws.ok) return ws;

  const issues = validateProvisionInput(input);
  if (issues.length > 0) {
    return { ok: false, error: issues.map((i) => i.message).join("; ") };
  }

  const { cols } = await getSabsmsCollections();
  const now = new Date();

  const docs: SabsmsNumber[] = input.numbers.map((e164) => ({
    workspaceId: ws.workspaceId,
    e164,
    country: input.country.toUpperCase(),
    type: input.type,
    provider: input.provider,
    capabilities: input.capabilities,
    status: "pending",
    monthlyCost: Math.round(
      input.monthlyCostEstimate / Math.max(input.numbers.length, 1),
    ),
    createdAt: now,
  }));

  // TODO(engine): when `/v1/numbers/provision` lands, call the engine
  // here instead of inserting directly. The engine writes the canonical
  // doc; we'd then refresh the audit log only.
  const insertRes = await cols.numbers.insertMany(docs);
  const ids = Object.values(insertRes.insertedIds).map((id) => id.toString());

  await writeAuditLog({
    workspaceId: ws.workspaceId,
    action: "sabsms.number.provision",
    detail: {
      provider: input.provider,
      country: input.country,
      type: input.type,
      e164: input.numbers,
      campaignId: input.campaignId,
      poolId: input.poolId,
      useCase: input.useCase,
      draft: Boolean(input.draft),
      monthlyCostEstimate: input.monthlyCostEstimate,
    },
  });

  revalidatePath("/sabsms/numbers");
  return { ok: true, ids };
}

// ─── Mutation: test call (stub) ──────────────────────────────────────────

export async function startTestCall(input: {
  numberId: string;
  targetE164: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspaceOk();
  if (!ws.ok) return ws;
  if (!input.targetE164.trim()) {
    return { ok: false, error: "Target phone is required" };
  }
  // TODO(engine): wire to `/v1/voice/test-call` once Phase 7 lands.
  await writeAuditLog({
    workspaceId: ws.workspaceId,
    action: "sabsms.number.test_call",
    detail: { ...input, stub: true },
  });
  return { ok: true };
}

// ─── Audit log ────────────────────────────────────────────────────────────

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

// ─── Read helpers exposed for the page ───────────────────────────────────

export interface CampaignOption {
  id: string;
  name: string;
}

export interface PoolOption {
  id: string;
  name: string;
}

export async function loadProvisioningContext(): Promise<{
  workspaceId: string;
  campaigns: CampaignOption[];
  pools: PoolOption[];
  complianceReady: { tendlc: boolean; dlt: boolean };
}> {
  const ws = await resolveWorkspaceOk();
  const workspaceId = ws.ok ? ws.workspaceId : "";
  if (!workspaceId) {
    return {
      workspaceId,
      campaigns: [],
      pools: [],
      complianceReady: { tendlc: false, dlt: false },
    };
  }
  const { cols } = await getSabsmsCollections();
  const campaigns = await cols.campaigns
    .find(
      { workspaceId, status: { $in: ["scheduled", "running", "draft"] } },
      { projection: { name: 1 } },
    )
    .limit(50)
    .toArray();

  // Sender-pool collection ships in Phase 5 — stub with a placeholder
  // "Default pool" so the dropdown renders.
  const pools: PoolOption[] = [{ id: "default", name: "Default pool" }];

  // TODO(compliance): when the 10DLC/DLT registry tables land, read the
  // workspace's actual approval state. For now, mark "ready" iff the
  // provider account has a Twilio credential recorded.
  const providerAccounts = await cols.providerAccounts
    .find({ workspaceId }, { projection: { provider: 1 } })
    .limit(20)
    .toArray();
  const hasTwilio = providerAccounts.some((p) => p.provider === "twilio");

  return {
    workspaceId,
    campaigns: campaigns.map((c) => ({
      id: String(c._id),
      name: c.name ?? "Untitled",
    })),
    pools,
    complianceReady: { tendlc: hasTwilio, dlt: false },
  };
}

export { SABSMS_COLLECTIONS };
