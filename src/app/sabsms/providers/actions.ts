"use server";

import { randomBytes } from "node:crypto";
import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS, SabsmsProviderIdSchema } from "@/lib/sabsms/db/collections";
import { encryptProviderCreds, decryptProviderCreds } from "@/lib/sabsms/credentials";
import { sabsmsEngine, SabsmsEngineError } from "@/lib/sabsms/engine-client";
import { buildSabsmsWebhookUrls, maskCredentialValue, type SabsmsWebhookUrls } from "@/lib/sabsms/webhook-urls";
import { ObjectId } from "mongodb";

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  return workspaceId || null;
}

function newWebhookSecret(): string {
  return randomBytes(16).toString("hex");
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value ?? "");
}

/**
 * Live-test every configured account against the real engine
 * (`POST /v1/internal/providers/test`) and persist the resulting
 * statuses. Returns the refreshed account rows.
 */
export async function pingProvidersAction() {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.providerAccounts);
  const docs = await col.find({ workspaceId }).limit(50).toArray();

  for (const doc of docs) {
    const accountId = String(doc._id);
    try {
      const res = await sabsmsEngine.testProviderConnection({ workspaceId, accountId });
      if (res.ok) {
        await col.updateOne(
          { _id: doc._id },
          { $set: { status: "active", lastError: null, lastPing: new Date() } },
        );
      } else {
        await col.updateOne(
          { _id: doc._id },
          {
            $set: {
              status: "error",
              lastError: res.error ?? "Connection test failed",
              lastErrorAt: new Date(),
              lastPing: new Date(),
            },
          },
        );
      }
    } catch (e) {
      // Engine disabled / unreachable — leave the stored status untouched.
      if (!(e instanceof SabsmsEngineError)) throw e;
    }
  }

  const updatedDocs = await col
    .find({ workspaceId }, { projection: { credentialsCipher: 0 } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const rows = updatedDocs.map((d: any) => ({
    id: String(d._id),
    provider: d.provider as string,
    region: (d.region as string | undefined) ?? undefined,
    isDefault: !!d.isDefault,
    status: (d.status as string) ?? "active",
    lastError: (d.lastError as string | undefined) ?? undefined,
    createdAt: toIso(d.createdAt),
    webhookUrls: d.webhookSecret
      ? buildSabsmsWebhookUrls(String(d.provider), String(d._id), String(d.webhookSecret))
      : null,
  }));

  return { success: true as const, rows };
}

/**
 * Create or update a provider account for the current workspace.
 *
 * Credentials are encrypted with the v1 workspace-bound cipher
 * (`@/lib/sabsms/credentials`) before they touch Mongo — the plaintext
 * and the cipher are NEVER returned to the client or logged.
 *
 * A plain `webhookSecret` (NOT inside the cipher — the engine reads it
 * to authenticate inbound/DLR webhooks) is generated on create and
 * backfilled for older docs that predate it.
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

  await col.updateOne(
    { workspaceId, provider: provider.data },
    {
      $set: {
        credentialsCipher,
        ...(input.region !== undefined ? { region: input.region } : {}),
        isDefault,
        status: "active",
        updatedAt: now,
      },
      $setOnInsert: {
        workspaceId,
        provider: provider.data,
        createdAt: now,
        webhookSecret: newWebhookSecret(),
      },
      $unset: { lastError: "", lastErrorAt: "" },
    },
    { upsert: true },
  );

  // Drop the engine's decrypted-credential cache (tolerates engine down).
  await sabsmsEngine.invalidateCreds(workspaceId);

  let doc = await col.findOne(
    { workspaceId, provider: provider.data },
    { projection: { _id: 1, webhookSecret: 1 } },
  );
  if (!doc) {
    return { success: false as const, error: "Account not found after save" };
  }

  // Backfill a webhookSecret for pre-existing docs that were created
  // before the webhook scheme existed.
  if (!doc.webhookSecret) {
    const secret = newWebhookSecret();
    await col.updateOne({ _id: doc._id }, { $set: { webhookSecret: secret } });
    doc = { ...doc, webhookSecret: secret } as typeof doc & { webhookSecret: string };
  }

  const id = String(doc._id);
  const webhookUrls = buildSabsmsWebhookUrls(provider.data, id, String(doc.webhookSecret));

  return { success: true as const, id, webhookUrls };
}

/**
 * List provider accounts for the workspace — NEVER includes the cipher.
 * The plain webhook secret is only surfaced embedded inside the webhook
 * URLs (that is its purpose), never as a separate field.
 */
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
      lastError: (d.lastError as string | undefined) ?? undefined,
      createdAt: toIso(d.createdAt),
      webhookUrls: d.webhookSecret
        ? buildSabsmsWebhookUrls(String(d.provider), String(d._id), String(d.webhookSecret))
        : null,
    })),
  };
}

export interface ProviderAccountDetail {
  id: string;
  provider: string;
  region?: string;
  isDefault: boolean;
  status: string;
  lastError?: string;
  createdAt: string;
  webhookUrls: SabsmsWebhookUrls | null;
  /** Credential keys with masked values — plaintext NEVER leaves the server. */
  maskedCredentials: Record<string, string>;
}

/**
 * Load one provider account with masked credentials (first 2 + last 4
 * chars; shorter values fully masked). The plaintext is decrypted
 * server-side only and never returned.
 */
export async function getProviderAccountAction(id: string): Promise<
  | { success: true; account: ProviderAccountDetail }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };
  if (!ObjectId.isValid(id)) return { success: false as const, error: "Invalid id" };

  const { db } = await connectToDatabase();
  const doc: any = await db
    .collection(SABSMS_COLLECTIONS.providerAccounts)
    .findOne({ _id: new ObjectId(id), workspaceId });
  if (!doc) return { success: false as const, error: "Not found" };

  let maskedCredentials: Record<string, string> = {};
  if (typeof doc.credentialsCipher === "string" && doc.credentialsCipher) {
    try {
      const creds = decryptProviderCreds(workspaceId, doc.credentialsCipher);
      maskedCredentials = Object.fromEntries(
        Object.entries(creds).map(([k, v]) => [k, maskCredentialValue(String(v ?? ""))]),
      );
    } catch {
      // Wrong key / tampered cipher — show nothing rather than leak errors.
      maskedCredentials = {};
    }
  }

  return {
    success: true as const,
    account: {
      id: String(doc._id),
      provider: String(doc.provider),
      region: (doc.region as string | undefined) ?? undefined,
      isDefault: !!doc.isDefault,
      status: (doc.status as string) ?? "active",
      lastError: (doc.lastError as string | undefined) ?? undefined,
      createdAt: toIso(doc.createdAt),
      webhookUrls: doc.webhookSecret
        ? buildSabsmsWebhookUrls(String(doc.provider), String(doc._id), String(doc.webhookSecret))
        : null,
      maskedCredentials,
    },
  };
}

/**
 * Make this account the default for its provider within the workspace
 * (unsets `isDefault` on siblings first).
 */
export async function setDefaultProviderAccountAction(id: string) {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };
  if (!ObjectId.isValid(id)) return { success: false as const, error: "Invalid id" };

  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.providerAccounts);
  const target = await col.findOne(
    { _id: new ObjectId(id), workspaceId },
    { projection: { provider: 1 } },
  );
  if (!target) return { success: false as const, error: "Not found" };

  const now = new Date();
  await col.updateMany(
    { workspaceId, provider: target.provider, isDefault: true, _id: { $ne: target._id } },
    { $set: { isDefault: false, updatedAt: now } },
  );
  await col.updateOne(
    { _id: target._id },
    { $set: { isDefault: true, updatedAt: now } },
  );

  await sabsmsEngine.invalidateCreds(workspaceId);

  return { success: true as const };
}

/**
 * Test one account's credentials against the live provider API. On a
 * definitive engine answer the stored status is updated; when the
 * engine itself is unreachable/disabled the status is left untouched.
 */
export async function testProviderConnectionAction(id: string): Promise<{
  ok: boolean;
  provider?: string;
  detail?: string;
  error?: string;
}> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { ok: false, error: "Unauthorized" };
  if (!ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };

  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.providerAccounts);
  const doc = await col.findOne(
    { _id: new ObjectId(id), workspaceId },
    { projection: { _id: 1 } },
  );
  if (!doc) return { ok: false, error: "Not found" };

  let result: { ok: boolean; provider?: string; detail?: string; error?: string };
  try {
    result = await sabsmsEngine.testProviderConnection({ workspaceId, accountId: id });
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      // Engine down/disabled — do NOT mutate the account status.
      return { ok: false, error: "engine unreachable" };
    }
    throw e;
  }

  if (result.ok) {
    await col.updateOne(
      { _id: doc._id },
      { $set: { status: "active", lastError: null, updatedAt: new Date() } },
    );
  } else {
    await col.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: "error",
          lastError: result.error ?? "Connection test failed",
          lastErrorAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  }

  return result;
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
