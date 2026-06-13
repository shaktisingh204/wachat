"use server";

/**
 * SabSMS settings — notification routing config.
 *
 * Persists the workspace notification preferences (global toggles, digest
 * mode, quiet hours, debouncing, per-channel + per-event subscriptions) to a
 * dedicated `sabsms_notification_settings` document keyed by workspaceId, so
 * configuration survives reload. RBAC-gated on `sabsms_notifications`.
 *
 * This is a config store (read + persist). Actual fan-out of alerts to the
 * configured channels is owned by the events worker and is out of scope for
 * this surface; the UI no longer claims test sends / imports succeed unless
 * they actually persist.
 */

import { connectToDatabase } from "@/lib/mongodb";
import { requirePermission } from "@/lib/rbac-server";
import { getCachedSession } from "@/lib/server-cache";
import { defaultNotificationConfig } from "./config-defaults";

const COLLECTION = "sabsms_notification_settings";

export interface NotificationChannel {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  webhookUrl?: string;
  secret?: string;
}

export interface NotificationEvent {
  id: string;
  name: string;
  channels: string[];
  critical?: boolean;
  threshold?: string;
  debounceMinutes: number;
}

export interface NotificationConfig {
  quietHours: { enabled: boolean; start: string; end: string; timezone: string };
  digestMode: string;
  debouncing: { enabled: boolean; windowMinutes: number };
  muteAll: boolean;
  criticalOnly: boolean;
  aiDailySummary: boolean;
  channels: NotificationChannel[];
  events: NotificationEvent[];
}

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown } | undefined)?._id ?? "");
  return workspaceId || null;
}

/** Merge a stored (possibly partial) config over the defaults. */
function hydrate(stored: Partial<NotificationConfig> | null): NotificationConfig {
  const base = defaultNotificationConfig();
  if (!stored) return base;
  return {
    quietHours: { ...base.quietHours, ...(stored.quietHours ?? {}) },
    digestMode: stored.digestMode ?? base.digestMode,
    debouncing: { ...base.debouncing, ...(stored.debouncing ?? {}) },
    muteAll: stored.muteAll ?? base.muteAll,
    criticalOnly: stored.criticalOnly ?? base.criticalOnly,
    aiDailySummary: stored.aiDailySummary ?? base.aiDailySummary,
    channels: Array.isArray(stored.channels) && stored.channels.length ? stored.channels : base.channels,
    events: Array.isArray(stored.events) && stored.events.length ? stored.events : base.events,
  };
}

export type GetNotificationsResult =
  | { success: true; config: NotificationConfig }
  | { success: false; error: string };

export async function getNotificationConfigAction(): Promise<GetNotificationsResult> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_notifications", "view", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const { db } = await connectToDatabase();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  return { success: true, config: hydrate((doc?.config as Partial<NotificationConfig>) ?? null) };
}

export type SaveNotificationsResult =
  | { success: true; config: NotificationConfig }
  | { success: false; error: string };

/** Persist the full notification config for the workspace (upsert). */
export async function saveNotificationConfigAction(
  input: NotificationConfig,
): Promise<SaveNotificationsResult> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_notifications", "edit", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const config = hydrate(input);
  const { db } = await connectToDatabase();
  await db.collection(COLLECTION).updateOne(
    { workspaceId },
    { $set: { workspaceId, config, updatedAt: new Date() } },
    { upsert: true },
  );
  return { success: true, config };
}
