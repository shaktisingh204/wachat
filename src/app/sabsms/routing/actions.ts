"use server";

import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  SABSMS_COLLECTIONS,
  SabsmsRoutingRuleSchema,
} from "@/lib/sabsms/db/collections";
import {
  sabsmsEngine,
  SabsmsEngineError,
  type SabsmsProviderHealthAccount,
  type SabsmsRoutePreview,
} from "@/lib/sabsms/engine-client";

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  return workspaceId || null;
}

/** Client-facing rule shape (already validated camelCase wire form). */
export interface RoutingRuleInput {
  id: string;
  match: {
    country?: string;
    category?: string;
    channel?: string;
    prefix?: string;
  };
  routes: Array<{ providerAccountId: string; weight: number }>;
  stickySender: boolean;
  pool?: {
    numberIds: string[];
    strategy: "round_robin" | "sticky" | "least_used";
  };
}

const SaveRulesSchema = z.array(SabsmsRoutingRuleSchema).max(100);

/** Load the workspace's routing policy (rules in priority order). */
export async function getRoutingPolicyAction(): Promise<
  | { success: true; rules: RoutingRuleInput[]; updatedAt: string | null }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  const { db } = await connectToDatabase();
  const doc: any = await db
    .collection(SABSMS_COLLECTIONS.routingPolicies)
    .findOne({ workspaceId });
  if (!doc) return { success: true as const, rules: [], updatedAt: null };

  const parsed = SaveRulesSchema.safeParse(doc.rules ?? []);
  return {
    success: true as const,
    rules: (parsed.success ? parsed.data : []) as RoutingRuleInput[],
    updatedAt:
      doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
  };
}

/**
 * Validate + persist the full rule list (the policy doc is replaced
 * whole — rule order IS priority), then drop the engine's policy cache
 * so the change applies within one message instead of one cache TTL.
 */
export async function saveRoutingPolicyAction(rules: unknown): Promise<
  { success: true } | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  const parsed = SaveRulesSchema.safeParse(rules);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false as const,
      error: issue
        ? `Invalid rule at ${issue.path.join(".") || "root"}: ${issue.message}`
        : "Invalid rules",
    };
  }

  // Cross-rule sanity: unique rule ids.
  const ids = new Set(parsed.data.map((r) => r.id));
  if (ids.size !== parsed.data.length) {
    return { success: false as const, error: "Rule ids must be unique" };
  }

  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection(SABSMS_COLLECTIONS.routingPolicies).updateOne(
    { workspaceId },
    {
      $set: { rules: parsed.data, updatedAt: now },
      $setOnInsert: { workspaceId, createdAt: now },
    },
    { upsert: true },
  );

  // Best-effort cache drop (tolerates engine down — TTL covers it).
  await sabsmsEngine.invalidateRouting(workspaceId);

  return { success: true as const };
}

/**
 * "Where would this message route?" — dry-runs the engine's real
 * selector. Returns the ordered candidates with health + circuit info.
 */
export async function previewRouteAction(input: {
  to: string;
  category?: string;
  channel?: string;
}): Promise<
  | { success: true; preview: SabsmsRoutePreview }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };
  const to = String(input.to ?? "").trim();
  if (!to) return { success: false as const, error: "Destination number required" };

  try {
    const preview = await sabsmsEngine.previewRoute({
      workspaceId,
      to,
      category: input.category,
      channel: input.channel,
    });
    return { success: true as const, preview };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { success: false as const, error: e.message };
    }
    throw e;
  }
}

/** One active sender number, for the rule editor's pool multi-select. */
export interface PoolNumberOption {
  id: string;
  e164: string;
  provider: string;
  country: string;
}

/**
 * Active workspace numbers the sender-pool picker chooses a `from` out of.
 * The engine's pool strategies (round_robin / sticky / least_used) index
 * into exactly these `sabsms_numbers` ids.
 */
export async function listNumbersForPoolAction(): Promise<
  | { success: true; numbers: PoolNumberOption[] }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  const { db } = await connectToDatabase();
  const docs = await db
    .collection(SABSMS_COLLECTIONS.numbers)
    .find(
      { workspaceId, status: "active" },
      { projection: { e164: 1, provider: 1, country: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  return {
    success: true as const,
    numbers: docs.map((d: any) => ({
      id: String(d._id),
      e164: String(d.e164 ?? ""),
      provider: String(d.provider ?? ""),
      country: String(d.country ?? ""),
    })),
  };
}

/** Live per-account health for the route-row badges. */
export async function getRoutingHealthAction(): Promise<
  | { success: true; accounts: SabsmsProviderHealthAccount[] }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };
  try {
    const res = await sabsmsEngine.getProviderHealth(workspaceId);
    return { success: true as const, accounts: res.accounts ?? [] };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { success: false as const, error: e.message };
    }
    throw e;
  }
}
