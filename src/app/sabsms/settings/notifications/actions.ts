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

export function defaultNotificationConfig(): NotificationConfig {
  return {
    quietHours: { enabled: false, start: "22:00", end: "08:00", timezone: "UTC" },
    digestMode: "immediate",
    debouncing: { enabled: false, windowMinutes: 60 },
    muteAll: false,
    criticalOnly: false,
    aiDailySummary: false,
    channels: [
      { id: "in-app", name: "In-App", type: "in-app", enabled: true },
      { id: "email", name: "Email", type: "email", enabled: true },
      { id: "slack", name: "Slack", type: "slack", enabled: false, webhookUrl: "" },
      { id: "discord", name: "Discord", type: "discord", enabled: false, webhookUrl: "" },
      { id: "sabflow", name: "SabFlow", type: "sabflow", enabled: true },
      { id: "webhook", name: "Webhook", type: "webhook", enabled: false, secret: "" },
      { id: "push", name: "Mobile Push", type: "push", enabled: false },
    ],
    events: [
      { id: "campaign.started", name: "Campaign Started", channels: ["in-app"], debounceMinutes: 0 },
      {
        id: "campaign.completed",
        name: "Campaign Completed",
        channels: ["in-app", "email"],
        debounceMinutes: 0,
      },
      {
        id: "delivery.failed",
        name: "Delivery Failed",
        channels: ["in-app", "slack"],
        threshold: "spike",
        debounceMinutes: 60,
      },
      {
        id: "billing.limit_reached",
        name: "Billing Limit Reached",
        channels: ["in-app", "email", "slack"],
        critical: true,
        debounceMinutes: 0,
      },
    ],
  };
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
