/**
 * Unit tests for v3.4 geo permissions — the pure decision function and
 * its integration into the channel pre-flight gate.
 *
 *   npx tsx --test src/lib/sabsms/governance/__tests__/geo-permissions.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { evaluateGeo } from '../geo-permissions';
import { compliancePreflight } from '../../channels/compliance-preflight';
import type { DispatchContext } from '../../channels/types';

const CTX: DispatchContext = { workspaceId: 'ws_1', category: 'marketing' };

// ─── pure evaluateGeo ────────────────────────────────────────────────────

test('allow_all permits everything', () => {
  assert.deepEqual(evaluateGeo('IN', { mode: 'allow_all', countries: [] }), {
    allow: true,
  });
});

test('allowlist permits only listed countries (case-insensitive)', () => {
  const cfg = { mode: 'allowlist' as const, countries: ['IN', 'us'] };
  assert.deepEqual(evaluateGeo('in', cfg), { allow: true });
  assert.deepEqual(evaluateGeo('US', cfg), { allow: true });
  assert.deepEqual(evaluateGeo('GB', cfg), { allow: false, reason: 'geo_not_allowed' });
});

test('denylist blocks listed countries and permits the rest', () => {
  const cfg = { mode: 'denylist' as const, countries: ['NG', 'PK'] };
  assert.deepEqual(evaluateGeo('NG', cfg), { allow: false, reason: 'geo_blocked' });
  assert.deepEqual(evaluateGeo('IN', cfg), { allow: true });
});

// ─── pre-flight integration (same gate as suppression) ───────────────────

test('geo block applies to whatsapp exactly as it would to sms', async () => {
  // US allowlist; an Indian (+91) number is blocked — and it is blocked on
  // WhatsApp because the gate is shared across phone channels.
  const verdict = await compliancePreflight(
    {
      workspaceId: 'ws_1',
      channel: 'whatsapp',
      recipient: { e164: '+919812345678' },
      ctx: CTX,
    },
    {
      isSuppressed: async () => false,
      getGeoConfig: async () => ({ mode: 'allowlist', countries: ['US'] }),
    },
  );
  assert.deepEqual(verdict, { allow: false, reason: 'geo_not_allowed' });
});

test('suppression is checked before geo (suppressed wins)', async () => {
  const verdict = await compliancePreflight(
    {
      workspaceId: 'ws_1',
      channel: 'sms',
      recipient: { e164: '+919812345678' },
      ctx: CTX,
    },
    {
      isSuppressed: async () => true,
      getGeoConfig: async () => ({ mode: 'denylist', countries: ['IN'] }),
    },
  );
  assert.deepEqual(verdict, { allow: false, reason: 'recipient_suppressed' });
});

test('an allowed country passes the gate', async () => {
  const verdict = await compliancePreflight(
    {
      workspaceId: 'ws_1',
      channel: 'sms',
      recipient: { e164: '+15551234567' },
      ctx: CTX,
    },
    {
      isSuppressed: async () => false,
      getGeoConfig: async () => ({ mode: 'allowlist', countries: ['US'] }),
      getFrequencyCap: async () => undefined,
    },
  );
  assert.deepEqual(verdict, { allow: true });
});

test('geo config is not even consulted for the email channel', async () => {
  let consulted = false;
  const verdict = await compliancePreflight(
    {
      workspaceId: 'ws_1',
      channel: 'email',
      recipient: { e164: '+919812345678', email: 'a@b.com' },
      ctx: CTX,
    },
    {
      isSuppressed: async () => false,
      getGeoConfig: async () => {
        consulted = true;
        return { mode: 'allowlist', countries: ['US'] };
      },
    },
  );
  assert.deepEqual(verdict, { allow: true });
  assert.equal(consulted, false, 'email must bypass the phone geo gate');
});