/**
 * SabCRM webhook event vocabulary — framework-neutral constants.
 *
 * Lives in a plain (NOT `server-only`) module so it can be imported by both
 * Client Components (the webhook manager UI) and server modules
 * (`webhooks.server.ts`) without dragging Mongo / node:crypto into the client
 * bundle. The runtime logic stays in `webhooks.server.ts`; only this closed
 * value set + its type are shared.
 */

/** The closed set of SabCRM events an outbound webhook may subscribe to. */
export type SabcrmWebhookEvent =
  | "record.created"
  | "record.updated"
  | "record.deleted"
  | "activity.created";

/** Every supported event, in display order. Used for validation + UI. */
export const SABCRM_WEBHOOK_EVENTS: readonly SabcrmWebhookEvent[] = [
  "record.created",
  "record.updated",
  "record.deleted",
  "activity.created",
] as const;

const WEBHOOK_EVENT_SET: ReadonlySet<string> = new Set<string>(
  SABCRM_WEBHOOK_EVENTS,
);

/** Narrows an arbitrary string to a known {@link SabcrmWebhookEvent}. */
export function isSabcrmWebhookEvent(v: unknown): v is SabcrmWebhookEvent {
  return typeof v === "string" && WEBHOOK_EVENT_SET.has(v);
}
