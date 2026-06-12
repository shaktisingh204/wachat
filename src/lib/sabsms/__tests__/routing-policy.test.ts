/**
 * Zod ↔ Rust wire-contract tests for the V2.6 routing policy.
 *
 *   NODE_PATH=src/workers/_stubs npx tsx --test src/lib/sabsms/__tests__/routing-policy.test.ts
 *
 * (the NODE_PATH stub neutralises `import 'server-only'` in
 * `../db/collections.ts` — same trick as the PM2 workers)
 *
 * `RUST_FIXTURE` below is hand-written to byte-match what
 * `services/sabsms-engine/src/routing/policy.rs` serializes (camelCase,
 * conditions under the literal `match` key, snake_case pool strategies,
 * absent Option fields omitted). The engine pins its side with the
 * `policy_wire_format_is_camel_case_with_match_key` cargo test — if
 * either test breaks, the two sides have drifted.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { z } from 'zod';

import {
  SabsmsRoutingMatchSchema,
  SabsmsRoutingPoolSchema,
  SabsmsRoutingRuleSchema,
} from '../db/collections';

const RulesSchema = z.array(SabsmsRoutingRuleSchema);

/** Exactly what the Rust engine serializes for a 2-rule policy's rules. */
const RUST_FIXTURE = [
  {
    id: 'r1',
    match: { country: 'US', category: 'marketing' },
    routes: [
      { providerAccountId: '664f1a2b3c4d5e6f70819202', weight: 100 },
      { providerAccountId: '664f1a2b3c4d5e6f70819203', weight: 50 },
    ],
    stickySender: true,
    pool: {
      numberIds: ['664f1a2b3c4d5e6f70819301', '664f1a2b3c4d5e6f70819302'],
      strategy: 'round_robin',
    },
  },
  {
    id: 'r2',
    match: { prefix: '+9198' },
    routes: [{ providerAccountId: '664f1a2b3c4d5e6f70819204', weight: 10 }],
    stickySender: false,
  },
] as const;

test('Rust-serialized policy rules parse losslessly', () => {
  const parsed = RulesSchema.parse(JSON.parse(JSON.stringify(RUST_FIXTURE)));
  // Round-trip: what we store is byte-identical to what Rust emitted
  // (zod must not inject, rename, or drop fields).
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), JSON.parse(JSON.stringify(RUST_FIXTURE)));
});

test('conditions live under the literal `match` key in camelCase', () => {
  const parsed = RulesSchema.parse(JSON.parse(JSON.stringify(RUST_FIXTURE)));
  assert.equal(parsed[0].match.country, 'US');
  assert.equal(parsed[0].match.category, 'marketing');
  assert.equal(parsed[0].stickySender, true);
  assert.equal(parsed[0].routes[0].providerAccountId, '664f1a2b3c4d5e6f70819202');
  assert.equal(parsed[0].pool?.strategy, 'round_robin');
  assert.equal(parsed[1].match.prefix, '+9198');
  assert.equal(parsed[1].pool, undefined);
});

test('pool strategies are the snake_case Rust enum values', () => {
  for (const strategy of ['round_robin', 'sticky', 'least_used']) {
    assert.ok(SabsmsRoutingPoolSchema.safeParse({ numberIds: [], strategy }).success, strategy);
  }
  assert.equal(
    SabsmsRoutingPoolSchema.safeParse({ numberIds: [], strategy: 'roundRobin' }).success,
    false,
    'camelCase strategy must be rejected — Rust uses snake_case',
  );
});

test('defaults mirror Rust #[serde(default)]', () => {
  // Rust: match/routes/stickySender all have serde defaults.
  const parsed = SabsmsRoutingRuleSchema.parse({
    id: 'bare',
    routes: [{ providerAccountId: 'a1', weight: 1 }],
  });
  assert.deepEqual(parsed.match, {});
  assert.equal(parsed.stickySender, false);
});

test('invalid rules are rejected', () => {
  // No routes — the engine would skip the rule entirely; the UI must
  // not be able to save it.
  assert.equal(
    SabsmsRoutingRuleSchema.safeParse({ id: 'x', match: {}, routes: [], stickySender: false })
      .success,
    false,
  );
  // Negative / non-integer weights (Rust u32).
  assert.equal(
    SabsmsRoutingRuleSchema.safeParse({
      id: 'x',
      match: {},
      routes: [{ providerAccountId: 'a', weight: -1 }],
      stickySender: false,
    }).success,
    false,
  );
  assert.equal(
    SabsmsRoutingRuleSchema.safeParse({
      id: 'x',
      match: {},
      routes: [{ providerAccountId: 'a', weight: 1.5 }],
      stickySender: false,
    }).success,
    false,
  );
  // Country must be ISO-3166 alpha-2.
  assert.equal(SabsmsRoutingMatchSchema.safeParse({ country: 'USA' }).success, false);
  assert.equal(SabsmsRoutingMatchSchema.safeParse({ country: 'US' }).success, true);
  // Unknown category strings are rejected (Rust matches them case-
  // insensitively, but the UI writes the canonical enum only).
  assert.equal(SabsmsRoutingMatchSchema.safeParse({ category: 'promo' }).success, false);
});
