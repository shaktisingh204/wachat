/**
 * SabSMS campaigns — pure helpers.
 *
 * Anything that needs to be sync, deterministic, or test-friendly lives
 * here so it can be imported from both the server actions (`"use server"`,
 * async-only) and the client table without pulling in Mongo.
 */

import type { CampaignRow } from "./actions";

export interface CampaignRollup {
  total: number;
  running: number;
  scheduled: number;
  completed: number;
  failed: number;
  audience: number;
  delivered: number;
}

export function rollupCampaigns(rows: CampaignRow[]): CampaignRollup {
  let audience = 0;
  let delivered = 0;
  let running = 0;
  let scheduled = 0;
  let completed = 0;
  let failed = 0;
  for (const r of rows) {
    audience += r.audienceSize;
    delivered += r.stats.delivered;
    if (r.status === "running") running += 1;
    else if (r.status === "scheduled") scheduled += 1;
    else if (r.status === "completed") completed += 1;
    else if (r.status === "failed") failed += 1;
  }
  return {
    total: rows.length,
    running,
    scheduled,
    completed,
    failed,
    audience,
    delivered,
  };
}

/**
 * Cents → human-readable USD.
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * ETA formatter — "any moment", "~5 min", "~3 h".
 */
export function formatEta(iso?: string, now: number = Date.now()): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "any moment";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `~${mins} min`;
  const hours = Math.round(mins / 60);
  return `~${hours} h`;
}

/**
 * Compute progress for a campaign — clamped 0..100. Hardened against
 * `audienceSize === 0` so the bar shows full for a completed empty
 * audience rather than NaN.
 */
export function computeProgress(
  audienceSize: number,
  sent: number,
  status: CampaignRow["status"],
): number {
  if (audienceSize === 0) return status === "completed" ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((sent / audienceSize) * 100)));
}
