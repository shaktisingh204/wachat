"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

import { connectToDatabase } from "@/lib/mongodb";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { sabsmsEngine, SabsmsEngineError } from "@/lib/sabsms/engine-client";
import type { SabsmsAvailableNumber } from "@/lib/sabsms/types";

/**
 * Server actions for /sabsms/numbers/buy.
 *
 * Number search + provisioning go through the Rust engine
 * (`POST /v1/numbers/search`, `POST /v1/numbers/provision`) — the
 * engine talks to Twilio/Telnyx with the workspace's stored
 * credentials and inserts the `sabsms_numbers` doc itself on
 * provision. Alphanumeric sender IDs (MSG91 / Gupshup) are registered
 * manually with the provider, so we only record them Next-side.
 */

async function requireWorkspaceId(): Promise<string | null> {
  return getSabsmsWorkspaceId();
}

const SEARCHABLE_PROVIDERS = ["twilio", "telnyx"] as const;
type SearchableProvider = (typeof SEARCHABLE_PROVIDERS)[number];

const SENDER_ID_PROVIDERS = ["msg91", "gupshup"] as const;
type SenderIdProvider = (typeof SENDER_ID_PROVIDERS)[number];

const SENDER_ID_RE = /^[A-Za-z0-9]{3,11}$/;

export async function searchAvailableNumbersAction(input: {
  provider: string;
  country: string;
  capabilities?: string[];
}): Promise<
  | { success: true; numbers: SabsmsAvailableNumber[] }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  if (!SEARCHABLE_PROVIDERS.includes(input.provider as SearchableProvider)) {
    return { success: false as const, error: "Number search is only available for Twilio and Telnyx" };
  }
  const country = String(input.country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return { success: false as const, error: "Country must be an ISO alpha-2 code" };
  }
  const capabilities = (input.capabilities ?? []).filter((c) =>
    ["sms", "mms", "voice"].includes(c),
  );

  try {
    const res = await sabsmsEngine.searchNumbers({
      workspaceId,
      provider: input.provider as SearchableProvider,
      country,
      ...(capabilities.length > 0 ? { capabilities } : {}),
    });
    return { success: true as const, numbers: res.numbers ?? [] };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      // 400s carry the engine's message (e.g. provider not configured);
      // 0/503 means engine disabled or unreachable.
      const error =
        e.status === 0 || e.status === 503
          ? "SabSMS engine is unreachable — try again shortly"
          : e.message;
      return { success: false as const, error };
    }
    throw e;
  }
}

export async function provisionNumberAction(input: {
  provider: string;
  phoneNumber: string;
}): Promise<
  | { success: true; e164: string; numberId: string }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  if (!SEARCHABLE_PROVIDERS.includes(input.provider as SearchableProvider)) {
    return { success: false as const, error: "Provisioning is only available for Twilio and Telnyx" };
  }
  const phoneNumber = String(input.phoneNumber ?? "").trim();
  if (!phoneNumber) {
    return { success: false as const, error: "Phone number is required" };
  }

  try {
    const res = await sabsmsEngine.provisionNumber({
      workspaceId,
      provider: input.provider as SearchableProvider,
      phoneNumber,
    });
    if (!res.ok) {
      return { success: false as const, error: "Provider declined the purchase" };
    }
    // The engine inserts the sabsms_numbers doc itself — do NOT insert again.
    return { success: true as const, e164: res.e164, numberId: res.numberId };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      const error =
        e.status === 0 || e.status === 503
          ? "SabSMS engine is unreachable — try again shortly"
          : e.message;
      return { success: false as const, error };
    }
    throw e;
  }
}

export async function registerSenderIdAction(input: {
  provider: string;
  senderId: string;
  dltHeaderId?: string;
  country: string;
}): Promise<
  | { success: true; senderId: string }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  if (!SENDER_ID_PROVIDERS.includes(input.provider as SenderIdProvider)) {
    return { success: false as const, error: "Sender IDs are supported for MSG91 and Gupshup" };
  }
  const senderIdRaw = String(input.senderId ?? "").trim();
  if (!SENDER_ID_RE.test(senderIdRaw)) {
    return {
      success: false as const,
      error: "Sender ID must be 3-11 alphanumeric characters",
    };
  }
  const senderId = senderIdRaw.toUpperCase();
  const country = String(input.country ?? "IN").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return { success: false as const, error: "Country must be an ISO alpha-2 code" };
  }
  const dltHeaderId = String(input.dltHeaderId ?? "").trim();

  const { db } = await connectToDatabase();
  try {
    await db.collection(SABSMS_COLLECTIONS.numbers).insertOne({
      workspaceId,
      e164: senderId,
      country,
      type: "alphanumeric",
      provider: input.provider as SenderIdProvider,
      senderId,
      ...(dltHeaderId ? { dltHeaderId } : {}),
      capabilities: { sms: true, mms: false, rcs: false, voice: false },
      status: "active",
      createdAt: new Date(),
    } as any);
  } catch (e: any) {
    if (e?.code === 11000) {
      return { success: false as const, error: "Sender ID already registered" };
    }
    console.error("[sabsms/numbers] sender ID registration failed", e?.message ?? e);
    return { success: false as const, error: "Failed to register sender ID" };
  }

  return { success: true as const, senderId };
}
