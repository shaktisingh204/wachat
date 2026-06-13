"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

import { requirePermission } from "@/lib/rbac-server";
import {
  ensureSabsmsIndexes,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import {
  normalizeShortLinkDomain,
  resolveShortLinkBase,
} from "@/lib/sabsms/links-core";

async function requireWorkspaceId(): Promise<string | null> {
  return getSabsmsWorkspaceId();
}

export interface SabsmsSettingsView {
  /** Branded short-link domain (bare hostname) or null when unset. */
  shortLinkDomain: string | null;
  /** The base short URLs are actually minted under right now. */
  effectiveShortLinkBase: string;
  /** V2.11 — RCS composer gate (workspace boolean). */
  rcsEnabled: boolean;
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
      rcsEnabled: doc?.rcsEnabled ?? false,
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
    const cleared = await cols.settings.findOne({ workspaceId });
    return {
      success: true,
      settings: {
        shortLinkDomain: null,
        effectiveShortLinkBase: resolveShortLinkBase(),
        rcsEnabled: cleared?.rcsEnabled ?? false,
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
  const saved = await cols.settings.findOne({ workspaceId });
  return {
    success: true,
    settings: {
      shortLinkDomain: domain,
      effectiveShortLinkBase: resolveShortLinkBase({ workspaceDomain: domain }),
      rcsEnabled: saved?.rcsEnabled ?? false,
    },
  };
}

export type SaveRcsResult =
  | { success: true; rcsEnabled: boolean }
  | { success: false; error: string };

/**
 * V2.11 — toggle the workspace RCS composer gate. Persists
 * `settings.rcsEnabled`, which the send composer reads
 * (`send/actions.ts` getRcsComposerContext). Admin/owner-gated via the
 * same `sabsms_settings:edit` permission as the other settings writes.
 */
export async function saveRcsEnabledAction(input: {
  enabled: boolean;
}): Promise<SaveRcsResult> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "edit", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const enabled = Boolean(input?.enabled);
  await ensureSabsmsIndexes();
  const { cols } = await getSabsmsCollections();
  await cols.settings.updateOne(
    { workspaceId },
    {
      $set: { rcsEnabled: enabled, updatedAt: new Date() },
      $setOnInsert: { workspaceId },
    },
    { upsert: true },
  );
  return { success: true, rcsEnabled: enabled };
}
