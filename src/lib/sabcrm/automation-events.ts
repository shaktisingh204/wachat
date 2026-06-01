/**
 * SabCRM automation event vocabulary — framework-neutral constants.
 *
 * Lives in a plain (NOT `server-only`) module so the automations settings UI
 * (a Client Component) can import the event list without pulling the
 * Mongo-backed automation engine (`automation.server.ts`) into the client
 * bundle. Runtime evaluation stays server-side; only this value set + type
 * are shared.
 */

/** The lifecycle events that can trigger an automation rule. */
export type AutomationEvent =
  | "record_created"
  | "record_updated"
  | "record_deleted"
  | "activity_created"
  | "field_changed";

/** The set of all recognised automation events, in display order. */
export const AUTOMATION_EVENTS: readonly AutomationEvent[] = [
  "record_created",
  "record_updated",
  "record_deleted",
  "activity_created",
  "field_changed",
] as const;

/** Narrows an arbitrary string to a known {@link AutomationEvent}. */
export function isAutomationEvent(value: unknown): value is AutomationEvent {
  return (
    typeof value === "string" &&
    (AUTOMATION_EVENTS as readonly string[]).includes(value)
  );
}
