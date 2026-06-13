/**
 * V2.11 — RCS helpers + wire-shape tests (`../rcs.ts`).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/rcs.test.ts
 *
 * The `RUST_WIRE_FIXTURE` below is byte-for-byte the JSON the Rust
 * engine serializes for the same payload — pinned on the Rust side by
 * `providers::tests::rcs_payload_serializes_camel_case_with_kind_tags`
 * (services/sabsms-engine/src/providers/mod.rs). Change both together.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  capabilityBatches,
  capabilityPercent,
  deriveRcsFallbackText,
  isRcsPayloadSendable,
  MAX_RCS_SUGGESTIONS,
  RCS_ESTIMATE_SAMPLE_MAX,
  SabsmsRcsPayloadSchema,
  sampleForCapability,
} from '../rcs';

// ─── Wire-shape round-trip vs the Rust fixture ─────────────────────────────

const RUST_WIRE_FIXTURE = {
  card: {
    title: 'Summer sale',
    description: 'Up to 50% off',
    mediaUrl: 'https://r2.example.com/card.jpg',
    orientation: 'vertical',
  },
  suggestions: [
    { kind: 'reply', text: 'Show me', postbackData: 'show_offers' },
    { kind: 'openUrl', text: 'Shop now', url: 'https://shop.example.com' },
    { kind: 'dial', text: 'Call us', phone: '+15550001111' },
  ],
  fallbackText: 'Summer sale: up to 50% off. https://shop.example.com',
};

test('zod schema round-trips the Rust wire fixture unchanged', () => {
  const parsed = SabsmsRcsPayloadSchema.parse(RUST_WIRE_FIXTURE);
  // Round-trip: what we'd send back over the wire equals the fixture.
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), RUST_WIRE_FIXTURE);
});

test('schema accepts the minimal payload (fallbackText only)', () => {
  const parsed = SabsmsRcsPayloadSchema.parse({ fallbackText: 'plain' });
  assert.equal(parsed.fallbackText, 'plain');
  assert.deepEqual(parsed.suggestions, []);
  assert.equal(parsed.card, undefined);
});

test('schema rejects bad payloads', () => {
  // Missing fallback text.
  assert.equal(SabsmsRcsPayloadSchema.safeParse({ suggestions: [] }).success, false);
  // Empty fallback text.
  assert.equal(
    SabsmsRcsPayloadSchema.safeParse({ fallbackText: '' }).success,
    false,
  );
  // Unknown suggestion kind.
  assert.equal(
    SabsmsRcsPayloadSchema.safeParse({
      fallbackText: 'x',
      suggestions: [{ kind: 'share', text: 'X' }],
    }).success,
    false,
  );
  // Card without a title.
  assert.equal(
    SabsmsRcsPayloadSchema.safeParse({
      fallbackText: 'x',
      card: { title: '', description: 'd' },
    }).success,
    false,
  );
  // Too many suggestions (5 > 4).
  assert.equal(
    SabsmsRcsPayloadSchema.safeParse({
      fallbackText: 'x',
      suggestions: Array.from({ length: MAX_RCS_SUGGESTIONS + 1 }, (_, i) => ({
        kind: 'reply',
        text: `c${i}`,
        postbackData: `p${i}`,
      })),
    }).success,
    false,
  );
});

test('isRcsPayloadSendable mirrors schema verdicts', () => {
  assert.equal(
    isRcsPayloadSendable({ suggestions: [], fallbackText: 'ok' }),
    true,
  );
  assert.equal(isRcsPayloadSendable({ suggestions: [], fallbackText: '' }), false);
});

// ─── Fallback-text derivation ──────────────────────────────────────────────

test('explicit fallback wins (trimmed)', () => {
  assert.equal(deriveRcsFallbackText('body text', '  explicit  '), 'explicit');
});

test('blank explicit fallback falls through to the body', () => {
  assert.equal(deriveRcsFallbackText('body text', '   '), 'body text');
  assert.equal(deriveRcsFallbackText('body text'), 'body text');
});

test('empty body falls through to the card line', () => {
  assert.equal(
    deriveRcsFallbackText('', undefined, { title: 'Sale', description: '50% off' }),
    'Sale — 50% off',
  );
  // Description-less card keeps just the title.
  assert.equal(
    deriveRcsFallbackText('', '', { title: 'Sale', description: '' }),
    'Sale',
  );
});

test('nothing available derives an empty string (send blocked upstream)', () => {
  assert.equal(deriveRcsFallbackText('', ''), '');
});

// ─── Capability-estimate sampling math ─────────────────────────────────────

test('small audiences pass through deduped and unsampled', () => {
  const phones = ['+15550000001', '+15550000002', '+15550000001', ''];
  assert.deepEqual(sampleForCapability(phones), [
    '+15550000001',
    '+15550000002',
  ]);
});

test('large audiences sample down to the cap with an even spread', () => {
  const phones = Array.from({ length: 1000 }, (_, i) => `+1555${String(i).padStart(7, '0')}`);
  const sample = sampleForCapability(phones);
  assert.equal(sample.length, RCS_ESTIMATE_SAMPLE_MAX);
  // Deterministic: same input → same sample.
  assert.deepEqual(sampleForCapability(phones), sample);
  // Even spread: first element is the first phone, and the sample spans
  // the tail of the list too.
  assert.equal(sample[0], phones[0]);
  const lastSampledIdx = phones.indexOf(sample[sample.length - 1]);
  assert.ok(lastSampledIdx >= 990, `expected tail coverage, got idx ${lastSampledIdx}`);
  // No duplicates.
  assert.equal(new Set(sample).size, sample.length);
});

test('capabilityPercent rounds and handles empty input', () => {
  assert.equal(capabilityPercent({}), 0);
  assert.equal(
    capabilityPercent({
      a: { capable: true },
      b: { capable: true },
      c: { capable: false },
    }),
    67,
  );
  assert.equal(
    capabilityPercent({ a: { capable: true }, b: { capable: false } }),
    50,
  );
});

test('capabilityBatches splits at the engine batch cap', () => {
  const phones = Array.from({ length: 150 }, (_, i) => `+1${i}`);
  const batches = capabilityBatches(phones);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].length, 100);
  assert.equal(batches[1].length, 50);
  assert.deepEqual(capabilityBatches([]), []);
});
