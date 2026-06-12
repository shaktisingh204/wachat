"use server";

import { requirePermission } from "@/lib/rbac-server";
import { getCachedSession } from "@/lib/server-cache";
import {
  ensureSabsmsIndexes,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import {
  normalizeShortLinkDomain,
  resolveShortLinkBase,
} from "@/lib/sabsms/links-core";

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  return workspaceId || null;
}

export interface SabsmsSettingsView {
  /** Branded short-link domain (bare hostname) or null when unset. */
  shortLinkDomain: string | null;
  /** The base short URLs are actually minted under right now. */
  effectiveShortLinkBase: string;
}

export type GetSettingsResult =
  | { success: true; settings: SabsmsSettingsView }
  | { success: false; error: string };

export async function getSabsmsSettingsAction(): Promise<GetSettingsResult> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "view", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const { cols } = await getSabsmsCollections();
  const doc = await cols.settings.findOne({ workspaceId });
  const shortLinkDomain = doc?.shortLinkDomain ?? null;
  return {
    success: true,
    settings: {
      shortLinkDomain,
      effectiveShortLinkBase: resolveShortLinkBase({
        workspaceDomain: shortLinkDomain,
      }),
    },
  };
}

export type SaveDomainResult =
  | { success: true; settings: SabsmsSettingsView }
  | { success: false; error: string };

/**
 * Set (or clear, with an empty string) the workspace's branded
 * short-link domain. Accepts "sab.sm" or "https://sab.sm/" — normalized
 * to a bare lowercase hostname before it touches Mongo.
 */
export async function saveShortLinkDomainAction(input: {
  domain: string;
}): Promise<SaveDomainResult> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "edit", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const raw = (input?.domain ?? "").trim();
  const now = new Date();
  await ensureSabsmsIndexes();
  const { cols } = await getSabsmsCollections();

  if (!raw) {
    await cols.settings.updateOne(
      { workspaceId },
      {
        $unset: { shortLinkDomain: "" },
        $set: { updatedAt: now },
        $setOnInsert: { workspaceId },
      },
      { upsert: true },
    );
    return {
      success: true,
      settings: {
        shortLinkDomain: null,
        effectiveShortLinkBase: resolveShortLinkBase(),
      },
    };
  }

  const domain = normalizeShortLinkDomain(raw);
  if (!domain) {
    return {
      success: false,
      error:
        'Enter a bare domain like "sab.sm" (no path, port, or spaces). An https:// prefix is fine — it is stripped.',
    };
  }

  await cols.settings.updateOne(
    { workspaceId },
    {
      $set: { shortLinkDomain: domain, updatedAt: now },
      $setOnInsert: { workspaceId },
    },
    { upsert: true },
  );
  return {
    success: true,
    settings: {
      shortLinkDomain: domain,
      effectiveShortLinkBase: resolveShortLinkBase({ workspaceDomain: domain }),
    },
  };
}
