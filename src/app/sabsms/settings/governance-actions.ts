"use server";

/**
 * SabSMS v3 governance settings — the config surface for the channel
 * pre-flight gate and the WhatsApp channel linkage.
 *
 * Persists onto the shared `sabsms_settings` doc (the same place the
 * dispatcher's pre-flight and the WhatsApp adapter read from):
 *   - `geoPermissions`  (V3.4) — country allow/deny
 *   - `frequencyCap`    (V3.4) — per-contact global send budget
 *   - `whatsapp`        (V3.1) — WaChat project + WABA linkage
 *
 * RBAC-gated on `sabsms_settings` (same key as the other settings cards).
 */

import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import { requirePermission } from "@/lib/rbac-server";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import type {
  SabsmsFrequencyCap,
  SabsmsGeoPermissions,
  SabsmsWhatsappChannelConfig,
} from "@/lib/sabsms/types";

export interface GovernanceSettings {
  geoPermissions: SabsmsGeoPermissions;
  frequencyCap: SabsmsFrequencyCap;
  whatsapp: SabsmsWhatsappChannelConfig | null;
}

const GEO_MODES: SabsmsGeoPermissions["mode"][] = ["allow_all", "allowlist", "denylist"];

const DEFAULTS: GovernanceSettings = {
  geoPermissions: { mode: "allow_all", countries: [] },
  frequencyCap: {},
  whatsapp: null,
};

export type GetGovernanceResult =
  | { success: true; settings: GovernanceSettings }
  | { success: false; error: string };

export async function getGovernanceSettingsAction(): Promise<GetGovernanceResult> {
  const workspaceId = await getSabsmsWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "view", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const { cols } = await getSabsmsCollections();
  const doc = await cols.settings.findOne({ workspaceId });
  return {
    success: true,
    settings: {
      geoPermissions: doc?.geoPermissions ?? DEFAULTS.geoPermissions,
      frequencyCap: doc?.frequencyCap ?? DEFAULTS.frequencyCap,
      whatsapp: doc?.whatsapp ?? null,
    },
  };
}

// ─── normalization ─────────────────────────────────────────────────────────

function normGeo(input: SabsmsGeoPermissions | undefined): SabsmsGeoPermissions {
  const mode = GEO_MODES.includes(input?.mode as SabsmsGeoPermissions["mode"])
    ? (input!.mode as SabsmsGeoPermissions["mode"])
    : "allow_all";
  const countries = Array.isArray(input?.countries)
    ? Array.from(
        new Set(
          input!.countries
            .map((c) => String(c).trim().toUpperCase())
            .filter((c) => /^[A-Z]{2}$/.test(c)),
        ),
      )
    : [];
  return { mode, countries };
}

function clampPositiveInt(v: unknown): number | undefined {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function normFrequency(input: SabsmsFrequencyCap | undefined): SabsmsFrequencyCap {
  const out: SabsmsFrequencyCap = {};
  const perHour = clampPositiveInt(input?.perHour);
  const perDay = clampPositiveInt(input?.perDay);
  if (perHour != null) out.perHour = perHour;
  if (perDay != null) out.perDay = perDay;
  return out;
}

function normWhatsapp(
  input: SabsmsWhatsappChannelConfig | null | undefined,
): SabsmsWhatsappChannelConfig | null {
  const projectId = input?.wachatProjectId?.trim();
  const phoneNumberId = input?.phoneNumberId?.trim();
  if (!projectId || !phoneNumberId) return null;
  const cfg: SabsmsWhatsappChannelConfig = {
    wachatProjectId: projectId,
    phoneNumberId,
  };
  const tenantId = input?.tenantId?.trim();
  const otpTemplateId = input?.otpTemplateId?.trim();
  if (tenantId) cfg.tenantId = tenantId;
  if (otpTemplateId) cfg.otpTemplateId = otpTemplateId;
  return cfg;
}

export type SaveGovernanceResult =
  | { success: true; settings: GovernanceSettings }
  | { success: false; error: string };

export async function saveGovernanceSettingsAction(
  input: GovernanceSettings,
): Promise<SaveGovernanceResult> {
  const workspaceId = await getSabsmsWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "edit", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const settings: GovernanceSettings = {
    geoPermissions: normGeo(input.geoPermissions),
    frequencyCap: normFrequency(input.frequencyCap),
    whatsapp: normWhatsapp(input.whatsapp),
  };

  const { cols } = await getSabsmsCollections();
  const now = new Date();
  if (settings.whatsapp) {
    await cols.settings.updateOne(
      { workspaceId },
      {
        $set: {
          workspaceId,
          geoPermissions: settings.geoPermissions,
          frequencyCap: settings.frequencyCap,
          whatsapp: settings.whatsapp,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  } else {
    await cols.settings.updateOne(
      { workspaceId },
      {
        $set: {
          workspaceId,
          geoPermissions: settings.geoPermissions,
          frequencyCap: settings.frequencyCap,
          updatedAt: now,
        },
        $unset: { whatsapp: "" },
      },
      { upsert: true },
    );
  }
  return { success: true, settings };
}
