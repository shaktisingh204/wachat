"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

import { connectToDatabase } from "@/lib/mongodb";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

/**
 * SabSMS — numbers list bulk/row actions.
 *
 * The old `syncNumbersWithProvider` (simulated a provider sync and
 * force-set every selected number to `active`) and `bulkUpdateNumbersConfig`
 * (wrote `webhookUrl`/`routingUrl` fields nothing in the engine ever read)
 * were removed — they toasted success while doing nothing real.
 *
 * The one genuine destructive action is releasing a number, which the
 * engine performs AT THE PROVIDER via `POST /v1/numbers/release`
 * (Twilio `DELETE …/IncomingPhoneNumbers/{sid}.json`,
 * Telnyx `DELETE /v2/phone_numbers/{id}`) and then marks the
 * `sabsms_numbers` doc `released`. msg91 / gupshup have no number
 * inventory, so this is a no-op those provider rows can't reach.
 */

async function requireWorkspaceId(): Promise<string | null> {
  return getSabsmsWorkspaceId();
}

// ── Engine call (inline; engine-client lives outside this cluster) ──────────

const DEFAULT_ENGINE_URL = "http://localhost:4002";

function engineEnabled(): boolean {
  return (process.env.SABSMS_ENABLED ?? "false").toLowerCase() === "true";
}

interface EngineReleaseResponse {
  ok: boolean;
  numberId: string;
  e164: string;
  status: string;
}

/**
 * Release one number through the engine. Returns the engine result, or a
 * structured error. The engine only flips the doc to `released` after the
 * provider release succeeds, so we never lie about the outcome.
 */
async function engineReleaseNumber(
  workspaceId: string,
  numberId: string,
): Promise<{ ok: true; e164: string } | { ok: false; error: string }> {
  if (!engineEnabled()) {
    return { ok: false, error: "SabSMS engine is disabled (SABSMS_ENABLED=false)" };
  }
  const base = (process.env.SABSMS_ENGINE_URL ?? DEFAULT_ENGINE_URL).replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${base}/v1/numbers/release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Sabsms-Service-Token": process.env.SABSMS_ENGINE_TOKEN ?? "",
      },
      body: JSON.stringify({ workspaceId, numberId }),
      signal: controller.signal,
    });
    const payload = (await res.json().catch(() => null)) as
      | EngineReleaseResponse
      | { error?: string }
      | null;
    if (!res.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload && payload.error
          ? String(payload.error)
          : `SabSMS engine ${res.status}`;
      return { ok: false, error: message };
    }
    return { ok: true, e164: (payload as EngineReleaseResponse)?.e164 ?? "" };
  } catch (e) {
    const err = e as Error;
    if (err?.name === "AbortError") {
      return { ok: false, error: "SabSMS engine request timed out" };
    }
    return { ok: false, error: "SabSMS engine is unreachable — try again shortly" };
  } finally {
    clearTimeout(timeout);
  }
}

export interface ReleaseNumbersResult {
  released: string[];
  errors: Array<{ id: string; error: string }>;
}

/**
 * Release one or more numbers at the provider via the engine. Each is
 * released independently so a single bad number doesn't block the rest.
 */
export async function releaseNumbersAction(
  numberIds: string[],
): Promise<
  | { success: true; result: ReleaseNumbersResult }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  const ids = Array.from(
    new Set(numberIds.filter((id) => typeof id === "string" && ObjectId.isValid(id))),
  );
  if (ids.length === 0) {
    return { success: false as const, error: "No valid numbers selected" };
  }

  const { db } = await connectToDatabase();
  const auditCol = db.collection("sabsms_audit_log");

  const released: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    const res = await engineReleaseNumber(workspaceId, id);
    if (res.ok) {
      released.push(id);
      await auditCol.insertOne({
        workspaceId,
        action: "sabsms.number.release",
        detail: { numberId: id, e164: res.e164, source: "numbers-list" },
        createdAt: new Date(),
      });
    } else {
      errors.push({ id, error: res.error });
    }
  }

  revalidatePath("/sabsms/numbers");
  return { success: true as const, result: { released, errors } };
}
