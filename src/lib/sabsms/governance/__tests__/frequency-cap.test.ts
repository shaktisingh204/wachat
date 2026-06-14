/**
 * Unit tests for v3.4 frequency cap — the pure decision and its
 * integration into the channel pre-flight.
 *
 *   npx tsx --test src/lib/sabsms/governance/__tests__/frequency-cap.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { capIsActive, exceedsFrequencyCap } from '../frequency-cap';
import { compliancePreflight } from '../../channels/compliance-preflight';
import type { DispatchContext } from '../../channels/types';

const CTX: DispatchContext = { workspaceId: 'ws_1', category: 'marketing' };

// ─── pure ────────────────────────────────────────────────────────────────

test('capIsActive reflects whether any bound is set', () => {
  assert.equal(capIsActive(undefined), false);
  assert.equal(capIsActive({}), false);
  assert.equal(capIsActive({ perHour: 3 }), true);
  assert.equal(capIsActive({ perDay: 10 }), true);
});

test('exceedsFrequencyCap blocks at-or-above either bound', () => {
  assert.equal(exceedsFrequencyCap({ perHour: 2, perDay: 5 }, { perHour: 3 }), false);
  assert.equal(exceedsFrequencyCap({ perHour: 3, perDay: 5 }, { perHour: 3 }), true);
  assert.equal(exceedsFrequencyCap({ perHour: 0, perDay: 10 }, { perDay: 10 }), true);
  assert.equal(exceedsFrequencyCap({ perHour: 9, perDay: 9 }, { perHour: 10, perDay: 10 }), false);
});

// ─── pre-flight integration ──────────────────────────────────────────────

const NO_OTHER_GATES = {
  isSuppressed: async () => false,
  getGeoConfig: async () => undefined,
};

test('a contact at the daily cap is blocked', async () => {
  const verdict = await compliancePreflight(
    { workspaceId: 'ws_1', channel: 'sms', recipient: { e164: '+15551234567' }, ctx: CTX },
    {
      ...NO_OTHER_GATES,
      getFrequencyCap: async () => ({ perDay: 3 }),
      countRecentSends: async (_ws, _e164, windowMs) => (windowMs >= 86_400_000 ? 3 : 0),
    },
  );
  assert.deepEqual(verdict, { allow: false, reason: 'frequency_cap' });
});

test('a contact below the cap passes', async () => {
  const verdict = await compliancePreflight(
    { workspaceId: 'ws_1', channel: 'sms', recipient: { e164: '+15551234567' }, ctx: CTX },
    {
      ...NO_OTHER_GATES,
      getFrequencyCap: async () => ({ perHour: 2, perDay: 10 }),
      countRecentSends: async () => 1,
    },
  );
  assert.deepEqual(verdict, { allow: true });
});

test('the cap is shared across channels — whatsapp is capped too', async () => {
  const verdict = await compliancePreflight(
    { workspaceId: 'ws_1', channel: 'whatsapp', recipient: { e164: '+15551234567' }, ctx: CTX },
    {
      ...NO_OTHER_GATES,
      getFrequencyCap: async () => ({ perHour: 1 }),
      countRecentSends: async () => 1,
    },
  );
  assert.deepEqual(verdict, { allow: false, reason: 'frequency_cap' });
});

test('OTP / transactional (allowSuppressed) bypasses the frequency cap', async () => {
  let counted = false;
  const verdict = await compliancePreflight(
    {
      workspaceId: 'ws_1',
      channel: 'sms',
      recipient: { e164: '+15551234567' },
      ctx: { ...CTX, category: 'otp', allowSuppressed: true },
    },
    {
      getFrequencyCap: async () => ({ perHour: 1 }),
      countRecentSends: async () => {
        counted = true;
        return 99;
      },
    },
  );
  assert.deepEqual(verdict, { allow: true });
  assert.equal(counted, false, 'transactional must not even count toward the cap');
});