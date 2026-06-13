/**
 * Pure default-config factory for the SabSMS notifications surface.
 *
 * Lives outside `actions.ts` because that module is `'use server'` and may only
 * export async functions. This sync factory is shared by the actions module
 * (to hydrate stored configs) and the page (to render a default shape without a
 * DB round-trip). `import type` of NotificationConfig is compile-time only, so
 * there is no runtime import cycle with the `'use server'` actions module.
 */
import type { NotificationConfig } from './actions';

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
