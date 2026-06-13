"use server";

import { revalidatePath } from "next/cache";

import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_API_SCOPES, isSabsmsApiScope } from "@/lib/sabsms/apikeys/core";
import {
  createSabsmsApiKey,
  listSabsmsApiKeys,
  revokeSabsmsApiKey,
  usageSparkline,
} from "@/lib/sabsms/apikeys/store";

/**
 * /sabsms/api-keys server actions (V2.13) — real `sabsms_api_keys`
 * store. The raw key is returned EXACTLY ONCE from `createApiKeyAction`
 * and never again (only its sha-256 hash is persisted).
 */

export interface SabsmsApiKeyRow {
  id: string;
  name: string;
  /** Display prefix only — the raw key is never recoverable. */
  prefix: string;
  scopes: string[];
  rateLimitPerMin: number;
  ipAllowlist: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

type ActionResult<T> = ({ success: true } & T) | { success: false; error: string };

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown } | undefined)?._id ?? "");
  return workspaceId || null;
}

export async function listApiKeysAction(): Promise<ActionResult<{ keys: SabsmsApiKeyRow[] }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const docs = await listSabsmsApiKeys(workspaceId);
  return {
    success: true,
    keys: docs.map((d) => ({
      id: d._id ? d._id.toHexString() : "",
      name: d.name,
      prefix: d.prefix,
      scopes: d.scopes,
      rateLimitPerMin: d.rateLimitPerMin,
      ipAllowlist: d.ipAllowlist ?? [],
      lastUsedAt: d.lastUsedAt ? d.lastUsedAt.toISOString() : null,
      revokedAt: d.revokedAt ? d.revokedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

export async function createApiKeyAction(input: {
  name: string;
  scopes: string[];
  rateLimitPerMin?: number;
  ipAllowlist?: string[];
}): Promise<ActionResult<{ id: string; rawKey: string; prefix: string }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const scopes = (input.scopes ?? []).filter(isSabsmsApiScope);
  if (scopes.length === 0) {
    return {
      success: false,
      error: `Pick at least one scope (${SABSMS_API_SCOPES.join(", ")})`,
    };
  }
  if (!input.name.trim()) return { success: false, error: "Name is required" };

  try {
    const created = await createSabsmsApiKey({
      workspaceId,
      name: input.name,
      scopes,
      rateLimitPerMin: input.rateLimitPerMin,
      ipAllowlist: input.ipAllowlist,
    });
    revalidatePath("/sabsms/api-keys");
    return { success: true, ...created };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Key creation failed" };
  }
}

export async function revokeApiKeyAction(
  keyId: string,
): Promise<ActionResult<{ revoked: boolean }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const revoked = await revokeSabsmsApiKey(workspaceId, keyId);
  if (!revoked) return { success: false, error: "Key not found or already revoked" };
  revalidatePath("/sabsms/api-keys");
  return { success: true, revoked };
}

export async function keyUsageAction(
  keyId: string,
): Promise<ActionResult<{ points: Array<{ hour: string; count: number }> }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  // Ownership check: the sparkline only reads counters, but never leak
  // another workspace's traffic shape.
  const docs = await listSabsmsApiKeys(workspaceId);
  if (!docs.some((d) => d._id?.toHexString() === keyId)) {
    return { success: false, error: "Key not found" };
  }

  const points = await usageSparkline(keyId, 24);
  return { success: true, points };
}
