/**
 * SabSMS v3.4 — per-contact frequency cap.
 *
 * Marketing-pressure governance the leaders ship (Twilio Engage / Infobip
 * Moments frequency capping). Enforced in the one channel pre-flight, so a
 * contact's global send budget is shared across every campaign and journey
 * — not reset per campaign. Pure `exceedsFrequencyCap` for the decision;
 * the count + config loaders are dynamic-imported to stay test-light.
 */

import type { SabsmsFrequencyCap } from '../types';

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/**
 * Decide whether sending one more message would breach the cap, given the
 * recent outbound counts. A bound of `undefined` means "no limit on that
 * window". `count >= bound` blocks (the new message would be the
 * (bound+1)-th in the window).
 */
export function exceedsFrequencyCap(
  counts: { perHour: number; perDay: number },
  cap: SabsmsFrequencyCap,
): boolean {
  if (cap.perHour != null && counts.perHour >= cap.perHour) return true;
  if (cap.perDay != null && counts.perDay >= cap.perDay) return true;
  return false;
}

/** Whether a cap has any active bound worth counting for. */
export function capIsActive(cap: SabsmsFrequencyCap | undefined): cap is SabsmsFrequencyCap {
  return Boolean(cap && (cap.perHour != null || cap.perDay != null));
}

/** Load a workspace's frequency cap, or `undefined` (→ no cap). */
export async function loadFrequencyCap(
  workspaceId: string,
): Promise<SabsmsFrequencyCap | undefined> {
  const { getSabsmsCollections } = await import('../db/collections');
  const { cols } = await getSabsmsCollections();
  const settings = await cols.settings.findOne({ workspaceId });
  return settings?.frequencyCap;
}

/** Count outbound messages to one recipient within the last `windowMs`. */
export async function countRecentSends(
  workspaceId: string,
  e164: string,
  windowMs: number,
): Promise<number> {
  const { getSabsmsCollections } = await import('../db/collections');
  const { cols } = await getSabsmsCollections();
  const since = new Date(Date.now() - windowMs);
  return cols.messages.countDocuments({
    workspaceId,
    to: e164,
    direction: 'outbound',
    createdAt: { $gte: since },
  });
}
