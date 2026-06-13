/**
 * SabSMS V2.11 — RCS pure helpers + wire schemas.
 *
 * Worker-safe: no `server-only`, relative imports only. The zod schemas
 * mirror the Rust structs in
 * `services/sabsms-engine/src/providers/mod.rs` (`RcsPayload` /
 * `RcsCard` / `RcsSuggestion`) EXACTLY — camelCase fields, suggestions
 * tagged by `kind`. The anti-drift contract is the fixture round-trip
 * in `__tests__/rcs.test.ts` plus the Rust serde shape-pin test
 * `rcs_payload_serializes_camel_case_with_kind_tags`.
 */

import { z } from 'zod';

import type { SabsmsRcsPayload, SabsmsRcsSuggestion } from './types';

// ─── Wire schemas ──────────────────────────────────────────────────────────

export const SabsmsRcsCardSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  mediaUrl: z.string().optional(),
  orientation: z.string().optional(),
});

export const SabsmsRcsSuggestionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reply'), text: z.string().min(1), postbackData: z.string() }),
  z.object({ kind: z.literal('openUrl'), text: z.string().min(1), url: z.string().min(1) }),
  z.object({ kind: z.literal('dial'), text: z.string().min(1), phone: z.string().min(1) }),
]);

/** RCS supports at most 4 suggestion chips per message in our composer. */
export const MAX_RCS_SUGGESTIONS = 4;

export const SabsmsRcsPayloadSchema = z.object({
  card: SabsmsRcsCardSchema.optional(),
  suggestions: z.array(SabsmsRcsSuggestionSchema).max(MAX_RCS_SUGGESTIONS).default([]),
  fallbackText: z.string().min(1),
});

// ─── Fallback-text derivation ──────────────────────────────────────────────

/**
 * The SMS body used when the recipient can't receive RCS: the explicit
 * fallback when provided (trimmed, non-empty), else the message body,
 * else the card's "title — description" line as a last resort.
 */
export function deriveRcsFallbackText(
  body: string,
  explicitFallback?: string,
  card?: { title: string; description: string },
): string {
  const fallback = (explicitFallback ?? '').trim();
  if (fallback) return fallback;
  const trimmedBody = (body ?? '').trim();
  if (trimmedBody) return trimmedBody;
  if (card) {
    return [card.title, card.description].filter(Boolean).join(' — ').trim();
  }
  return '';
}

// ─── Capability-estimate sampling ──────────────────────────────────────────

/** Engine batch cap for `POST /v1/rcs/capability`. */
export const RCS_CAPABILITY_BATCH_MAX = 100;

/** Max phones the campaign-wizard estimate samples. */
export const RCS_ESTIMATE_SAMPLE_MAX = 200;

/**
 * Deterministic even-spread sample of up to `max` phones — index-step
 * sampling (not random) so the estimate is stable across re-renders.
 */
export function sampleForCapability(phones: string[], max = RCS_ESTIMATE_SAMPLE_MAX): string[] {
  const unique = [...new Set(phones.filter((p) => p && p.trim()))];
  if (unique.length <= max) return unique;
  const step = unique.length / max;
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    out.push(unique[Math.floor(i * step)]);
  }
  return out;
}

/**
 * Percentage (integer 0-100) of capable phones in a capability map.
 * Empty input → 0.
 */
export function capabilityPercent(results: Record<string, { capable: boolean }>): number {
  const entries = Object.values(results);
  if (entries.length === 0) return 0;
  const capable = entries.filter((e) => e.capable).length;
  return Math.round((capable / entries.length) * 100);
}

/** Split a phone list into engine-sized capability batches (≤100 each). */
export function capabilityBatches(
  phones: string[],
  batchSize = RCS_CAPABILITY_BATCH_MAX,
): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < phones.length; i += batchSize) {
    out.push(phones.slice(i, i + batchSize));
  }
  return out;
}

/** Type guard helper kept close to the schema for composer use. */
export function isRcsPayloadSendable(payload: SabsmsRcsPayload): boolean {
  return SabsmsRcsPayloadSchema.safeParse(payload).success;
}

export type { SabsmsRcsPayload, SabsmsRcsSuggestion };
