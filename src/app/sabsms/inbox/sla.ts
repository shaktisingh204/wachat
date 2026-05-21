/**
 * SLA + filter predicates for the inbox panes.
 *
 * Pure functions only — keeps the unit test under
 * `__tests__/segment.test.ts` cheap and side-effect free.
 */

import type { InboxConversationView, SlaState } from "./types";

/** First-response SLA window, in ms (1 hour). */
export const FIRST_RESPONSE_SLA_MS = 60 * 60 * 1000;

/** Resolution SLA window, in ms (24 hours). */
export const RESOLUTION_SLA_MS = 24 * 60 * 60 * 1000;

export function computeSlaState(
  c: InboxConversationView,
  now: Date,
): SlaState {
  const created = c.createdAt ? new Date(c.createdAt).getTime() : null;
  const firstResp = c.firstResponseAt
    ? new Date(c.firstResponseAt).getTime()
    : null;

  let firstResponseRemainingMs: number | null = null;
  let firstResponseBreached = false;
  if (created !== null && firstResp === null) {
    const elapsed = now.getTime() - created;
    firstResponseRemainingMs = FIRST_RESPONSE_SLA_MS - elapsed;
    firstResponseBreached = firstResponseRemainingMs < 0;
  }

  let resolutionRemainingMs: number | null = null;
  let resolutionBreached = false;
  if (created !== null && c.status !== "closed") {
    const elapsed = now.getTime() - created;
    resolutionRemainingMs = RESOLUTION_SLA_MS - elapsed;
    resolutionBreached = resolutionRemainingMs < 0;
  }

  return {
    firstResponseRemainingMs,
    resolutionRemainingMs,
    firstResponseBreached,
    resolutionBreached,
  };
}

/**
 * Filter predicate matching the left-rail scope facet. Used by the
 * client to do a final pass after the server query (e.g. when the user
 * flips scope without round-tripping).
 */
export function scopeMatches(
  c: InboxConversationView,
  scope: "all" | "mine" | "unassigned" | "closed" | "snoozed",
): boolean {
  switch (scope) {
    case "all":
      return c.status === "open" || c.status === "snoozed";
    case "closed":
      return c.status === "closed";
    case "snoozed":
      return c.status === "snoozed";
    case "unassigned":
      return c.status === "open" && !c.assignedAgentId;
    case "mine":
      return c.status === "open" && Boolean(c.assignedAgentId);
    default:
      return true;
  }
}

export function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const delta = Date.now() - d.getTime();
  const mins = Math.round(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

export function formatDeliveryStatusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "sending":
      return "Sending";
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Failed";
    case "undelivered":
      return "Undelivered";
    case "rejected":
      return "Rejected";
    case "suppressed":
      return "Suppressed";
    default:
      return status;
  }
}
