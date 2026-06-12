"use server";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS, SabsmsProviderIdSchema } from "@/lib/sabsms/db/collections";
import { encryptProviderCreds } from "@/lib/sabsms/credentials";
import { sabsmsEngine } from "@/lib/sabsms/engine-client";
import { ObjectId } from "mongodb";

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  return workspaceId || null;
}

export async function pingProvidersAction() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.providerAccounts);
  const docs = await col.find({ workspaceId }).toArray();

  for (const doc of docs) {
    // Simulate pinging provider API (e.g. Twilio, Vonage)
    // In a real scenario, we'd use their SDKs or fetch to their status endpoints
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const rand = Math.random();
    let newStatus = "active";
    let lastError = null;
    
    if (rand > 0.9) {
      newStatus = "outage";
      lastError = "Connection Timeout";
    } else if (rand > 0.7) {
      newStatus = "degraded";
      lastError = "High Latency Detected";
    }

    await col.updateOne(
      { _id: new ObjectId(doc._id) },
      { $set: { status: newStatus, lastError, lastPing: new Date() } }
    );
  }

  // Refetch to return updated data
  const updatedDocs = await col.find({ workspaceId }).limit(50).toArray();
  const rows = updatedDocs.map((d: any) => ({
    id: String(d._id),
    provider: d.provider,
    region: d.region,
    isDefault: !!d.isDefault,
    status: d.status ?? "active",
    lastError: d.lastError,
    sendVolume24h: Math.floor(Math.random() * 10000),
    lastSuccessfulSend: d.lastSuccessfulSend || "Just now",
    pricingTier: "Enterprise",
  }));

  return { success: true, rows };
}

/**
 * Create or update a provider account for the current workspace.
 *
 * Credentials are encrypted with the v1 workspace-bound cipher
 * (`@/lib/sabsms/credentials`) before they touch Mongo — the plaintext
 * and the cipher are NEVER returned to the client or logged.
 */
export async function saveProviderAccountAction(input: {
  provider: string;
  credentials: Record<string, string>;
  region?: string;
  isDefault?: boolean;
}) {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  const provider = SabsmsProviderIdSchema.safeParse(input.provider);
  if (!provider.success) {
    return { success: false as const, error: "Unknown provider" };
  }
  if (
    !input.credentials ||
    typeof input.credentials !== "object" ||
    Object.keys(input.credentials).length === 0 ||
    Object.values(input.credentials).some((v) => typeof v !== "string" || !v.trim())
  ) {
    return { success: false as const, error: "Credentials are required" };
  }

  let credentialsCipher: string;
  try {
    credentialsCipher = encryptProviderCreds(workspaceId, input.credentials);
  } catch {
    // Configuration error (e.g. missing SABSMS_CREDS_KEY) — never echo details
    // that could include key material.
    console.error("[sabsms/providers] credential encryption failed");
    return { success: false as const, error: "Credential encryption is not configured" };
  }

  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.providerAccounts);
  const now = new Date();
  const isDefault = !!input.isDefault;

  if (isDefault) {
    await col.updateMany(
      { workspaceId, provider: provider.data, isDefault: true },
      { $set: { isDefault: false, updatedAt: now } },
    );
  }

  const result = await col.updateOne(
    { workspaceId, provider: provider.data },
    {
      $set: {
        credentialsCipher,
        ...(input.region !== undefined ? { region: input.region } : {}),
        isDefault,
        status: "active",
        updatedAt: now,
      },
      $setOnInsert: { workspaceId, provider: provider.data, createdAt: now },
      $unset: { lastError: "", lastErrorAt: "" },
    },
    { upsert: true },
  );

  // Drop the engine's decrypted-credential cache (tolerates engine down).
  await sabsmsEngine.invalidateCreds(workspaceId);

  const id = result.upsertedId
    ? String(result.upsertedId)
    : String(
        (await col.findOne({ workspaceId, provider: provider.data }, { projection: { _id: 1 } }))
          ?._id ?? "",
      );

  return { success: true as const, id };
}

/** List provider accounts for the workspace — NEVER includes the cipher. */
export async function listProviderAccountsAction() {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  const { db } = await connectToDatabase();
  const docs = await db
    .collection(SABSMS_COLLECTIONS.providerAccounts)
    .find({ workspaceId }, { projection: { credentialsCipher: 0 } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  return {
    success: true as const,
    accounts: docs.map((d: any) => ({
      id: String(d._id),
      provider: d.provider as string,
      region: (d.region as string | undefined) ?? undefined,
      isDefault: !!d.isDefault,
      status: (d.status as string) ?? "active",
      createdAt:
        d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt ?? ""),
    })),
  };
}

/** Delete a provider account (workspace-scoped) and invalidate engine creds. */
export async function deleteProviderAccountAction(id: string) {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };
  if (!ObjectId.isValid(id)) return { success: false as const, error: "Invalid id" };

  const { db } = await connectToDatabase();
  const result = await db
    .collection(SABSMS_COLLECTIONS.providerAccounts)
    .deleteOne({ _id: new ObjectId(id), workspaceId });

  await sabsmsEngine.invalidateCreds(workspaceId);

  if (result.deletedCount === 0) {
    return { success: false as const, error: "Not found" };
  }
  return { success: true as const };
}
