/**
 * SabSMS contacts — pure helpers (no Mongo / no `server-only` imports).
 *
 * These functions are testable in isolation under `node:test`. Server
 * actions in `./actions.ts` import them too, so behaviour stays in one
 * place.
 */

import { createHash } from "node:crypto";

export type ContactConsentState =
  | "single"
  | "double"
  | "none"
  | "opt_out";

export function hashPhone(phone: string): string {
  return createHash("sha256")
    .update(phone.trim().toLowerCase())
    .digest("hex");
}

/**
 * Derive ISO alpha-2 country from an E.164 phone — best-effort, covers
 * the highest-volume prefixes. Returns `XX` when unknown so the country
 * facet stays usable.
 */
export function countryFromPhone(phone: string): string {
  const p = phone.replace(/[^0-9+]/g, "");
  if (!p.startsWith("+")) return "XX";
  const n = p.slice(1);
  if (n.startsWith("1")) return "US";
  if (n.startsWith("7")) return "RU";
  const two = n.slice(0, 2);
  const TWO: Record<string, string> = {
    "20": "EG", "27": "ZA", "30": "GR", "31": "NL", "32": "BE", "33": "FR",
    "34": "ES", "36": "HU", "39": "IT", "40": "RO", "41": "CH", "43": "AT",
    "44": "GB", "45": "DK", "46": "SE", "47": "NO", "48": "PL", "49": "DE",
    "51": "PE", "52": "MX", "53": "CU", "54": "AR", "55": "BR", "56": "CL",
    "57": "CO", "58": "VE", "60": "MY", "61": "AU", "62": "ID", "63": "PH",
    "64": "NZ", "65": "SG", "66": "TH", "81": "JP", "82": "KR", "84": "VN",
    "86": "CN", "90": "TR", "91": "IN", "92": "PK", "93": "AF", "94": "LK",
    "95": "MM", "98": "IR",
  };
  if (TWO[two]) return TWO[two];
  const three = n.slice(0, 3);
  const THREE: Record<string, string> = {
    "212": "MA", "213": "DZ", "216": "TN", "234": "NG", "254": "KE", "255": "TZ",
    "256": "UG", "353": "IE", "358": "FI", "370": "LT", "371": "LV", "372": "EE",
    "420": "CZ", "421": "SK", "880": "BD", "962": "JO", "966": "SA", "971": "AE",
    "972": "IL", "974": "QA", "977": "NP",
  };
  if (THREE[three]) return THREE[three];
  return "XX";
}

/**
 * Heuristic engagement score in [0,100]. Replies dominate (5x),
 * deliveries are baseline (1x), failures dock points (-2x).
 */
export function engagementScore(stats: {
  sent: number;
  delivered: number;
  replied: number;
  failed: number;
}): number {
  const raw =
    stats.replied * 5 + stats.delivered - stats.failed * 2;
  if (raw <= 0) return 0;
  const normalised = Math.min(100, Math.round((raw / Math.max(1, stats.sent)) * 50));
  return normalised;
}

/**
 * Heuristic "best hour to send" — bucket past sent hours, return mode.
 */
export function bestSendHourFromHours(hours: number[]): number | undefined {
  if (hours.length === 0) return undefined;
  const counts = new Map<number, number>();
  for (const h of hours) {
    if (Number.isFinite(h) && h >= 0 && h < 24) {
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return undefined;
  let bestHour = 0;
  let bestCount = -1;
  for (const [h, c] of counts) {
    if (c > bestCount) {
      bestHour = h;
      bestCount = c;
    }
  }
  return bestHour;
}

export function consentFromConsentEvents(
  kinds: Array<string | undefined | null>,
): ContactConsentState {
  if (
    kinds.includes("opt_out_stop") ||
    kinds.includes("opt_out_manual") ||
    kinds.includes("opt_out_complaint") ||
    kinds.includes("opt_out_carrier_block")
  ) {
    return "opt_out";
  }
  if (kinds.includes("opt_in_double")) return "double";
  if (kinds.includes("opt_in_single") || kinds.includes("opt_in_restart")) {
    return "single";
  }
  return "none";
}

/**
 * Heuristic risk score in [0,100]: more failed messages + complaint
 * events bumps the score up. Used by the contact-detail page.
 */
export function computeRiskScore(input: {
  failed: number;
  sent: number;
  complaints: number;
}): number {
  if (input.sent === 0 && input.complaints === 0) return 0;
  const failedRate =
    input.sent > 0 ? input.failed / input.sent : 0;
  const score =
    Math.min(60, Math.round(failedRate * 100)) +
    Math.min(40, input.complaints * 20);
  return Math.min(100, Math.max(0, score));
}
