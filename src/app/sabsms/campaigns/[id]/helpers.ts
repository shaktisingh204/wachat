/**
 * SabSMS — campaign detail pure helpers.
 *
 * Sync, deterministic utilities used by the detail page client + tests.
 * Anything that needs Mongo lives in `./actions.ts`.
 */

import type { CampaignDetail, FunnelStep } from "./actions";

/**
 * Derive the five-step funnel from a campaign's stats block. Mirrors
 * the inline computation in `loadCampaignDetail` so callers can reuse
 * the same math outside the server-action boundary.
 */
export function buildFunnelFromStats(
  stats: CampaignDetail["stats"],
): FunnelStep[] {
  return [
    {
      label: "queued",
      count:
        (stats.queued ?? 0) +
        (stats.sent ?? 0) +
        (stats.delivered ?? 0) +
        (stats.failed ?? 0),
    },
    { label: "sent", count: (stats.sent ?? 0) + (stats.delivered ?? 0) },
    { label: "delivered", count: stats.delivered ?? 0 },
    { label: "clicked", count: stats.clicked ?? 0 },
    { label: "converted", count: 0 },
  ];
}

/**
 * Funnel steps must monotonically decrease (or stay equal) — useful as
 * a sanity check for tests + for surfacing dashboard warnings when a
 * provider posts a delivered count higher than sent.
 */
export function funnelIsMonotonic(steps: FunnelStep[]): boolean {
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].count > steps[i - 1].count) return false;
  }
  return true;
}

/**
 * Margin % from raw cents — clamped to `0` when price is zero so the
 * card doesn't display NaN%.
 */
export function marginPct(costCents: number, priceCents: number): number {
  if (priceCents <= 0) return 0;
  return Math.round(((priceCents - costCents) / priceCents) * 1000) / 10;
}

/**
 * Best-effort country bucket key from an E.164 number — returns the
 * leading "+CC" three-byte slice. Matches the Mongo `$substrBytes`
 * group used in the aggregation so client + server agree.
 */
export function bucketCountry(e164: string): string {
  return e164.slice(0, 3);
}
