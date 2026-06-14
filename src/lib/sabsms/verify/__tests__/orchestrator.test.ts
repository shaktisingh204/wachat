/**
 * Unit tests for v3.1 Verify — code primitives + the multi-channel
 * orchestrator (fallback ordering, code lifecycle, constant-time check).
 *
 *   npx tsx --test src/lib/sabsms/verify/__tests__/orchestrator.test.ts
 *
 * Store, dispatch, clock and RNG are injected, so no Mongo/network/sibling
 * modules are touched.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  generateNumericCode,
  hashCode,
  hashEquals,
  recipientHash,
} from '../codes';
import {
  verifyCheck,
  verifyStart,
  type VerifyStore,
} from '../orchestrator';
import type { SabsmsVerification } from '../../types';
import type {
  DispatchResult,
  SabsmsDispatchChannel,
} from '../../channels/types';

// ─── code primitives ─────────────────────────────────────────────────────

test('generateNumericCode honors length and is all digits', () => {
  for (const len of [4, 6, 8]) {
    const c = generateNumericCode(len);
    assert.equal(c.length, len);
    assert.match(c, /^[0-9]+$/);
  }
});

test('hashCode is sha256(code+salt) and hashEquals is exact', () => {
  const h = hashCode('123456', 'salt');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashCode('123456', 'salt'));
  assert.ok(hashEquals(h, hashCode('123456', 'salt')));
  assert.equal(hashEquals(h, hashCode('000000', 'salt')), false);
});

test('recipientHash normalizes case/whitespace', () => {
  assert.equal(recipientHash('  A@B.COM '), recipientHash('a@b.com'));
});

// ─── in-memory store ─────────────────────────────────────────────────────

function memStore(): VerifyStore & { docs: Map<string, SabsmsVerification> } {
  const docs = new Map<string, SabsmsVerification>();
  return {
    docs,
    async insert(doc) {
      docs.set(doc.verificationId, { ...doc });
    },
    async findById(_ws, id) {
      const d = docs.get(id);
      return d ? { ...d } : null;
    },
    async update(_ws, id, patch) {
      const d = docs.get(id);
      if (d) docs.set(id, { ...d, ...patch });
    },
  };
}

/** A dispatch stub whose result per-channel is scripted. */
function scriptedDispatch(script: Partial<Record<SabsmsDispatchChannel, DispatchResult['status']>>) {
  const tried: SabsmsDispatchChannel[] = [];
  const fn = async (channel: SabsmsDispatchChannel): Promise<DispatchResult> => {
    tried.push(channel);
    return { channelUsed: channel, status: script[channel] ?? 'not_configured' };
  };
  return { fn, tried };
}

const FIXED_NOW = new Date('2026-06-14T12:00:00.000Z');
const baseDeps = (store: VerifyStore, dispatchFn: any) => ({
  store,
  dispatch: dispatchFn,
  now: () => FIXED_NOW,
  genCode: () => '424242',
  genSalt: () => 'fixedsalt',
  genId: () => 'ver_1',
});

// ─── verifyStart fallback ────────────────────────────────────────────────

test('verifyStart falls back SMS → whatsapp when sms is not configured', async () => {
  const store = memStore();
  const { fn, tried } = scriptedDispatch({ sms: 'not_configured', whatsapp: 'queued' });
  const res = await verifyStart(
    { workspaceId: 'ws_1', recipient: { e164: '+15551234567' }, whatsappTemplateId: 't1' },
    baseDeps(store, fn),
  );
  assert.equal(res.delivered, true);
  assert.equal(res.channelUsed, 'whatsapp');
  assert.deepEqual(tried, ['sms', 'whatsapp']);
  assert.equal(store.docs.get('ver_1')?.status, 'pending');
});

test('verifyStart skips channels with no usable recipient field', async () => {
  const store = memStore();
  // Email-only recipient: phone channels are filtered out entirely.
  const { fn, tried } = scriptedDispatch({ email: 'sent' });
  const res = await verifyStart(
    { workspaceId: 'ws_1', recipient: { email: 'a@b.com' } },
    baseDeps(store, fn),
  );
  assert.deepEqual(tried, ['email']);
  assert.equal(res.channelUsed, 'email');
});

test('verifyStart refuses high pumping-risk destinations before sending', async () => {
  const store = memStore();
  const { fn, tried } = scriptedDispatch({ sms: 'queued' });
  const res = await verifyStart(
    { workspaceId: 'ws_1', recipient: { e164: '+15551234567' } },
    { ...baseDeps(store, fn), pumpingGuard: async () => ({ level: 'high' as const }) },
  );
  assert.equal(res.delivered, false);
  assert.equal(res.blockedReason, 'pumping_risk');
  assert.deepEqual(tried, [], 'no channel should be attempted when blocked');
  assert.equal(store.docs.has('ver_1'), false, 'no record persisted on a refused start');
});

test('verifyStart proceeds when pumping risk is not high', async () => {
  const store = memStore();
  const { fn } = scriptedDispatch({ sms: 'queued' });
  const res = await verifyStart(
    { workspaceId: 'ws_1', recipient: { e164: '+15551234567' } },
    { ...baseDeps(store, fn), pumpingGuard: async () => ({ level: 'low' as const }) },
  );
  assert.equal(res.delivered, true);
  assert.equal(res.channelUsed, 'sms');
});

test('verifyStart marks failed when no channel accepts', async () => {
  const store = memStore();
  const { fn } = scriptedDispatch({}); // everything not_configured
  const res = await verifyStart(
    { workspaceId: 'ws_1', recipient: { e164: '+15551234567', email: 'a@b.com' } },
    baseDeps(store, fn),
  );
  assert.equal(res.delivered, false);
  assert.equal(res.channelUsed, undefined);
  assert.equal(store.docs.get('ver_1')?.status, 'failed');
});

// ─── verifyCheck lifecycle ───────────────────────────────────────────────

async function startSms() {
  const store = memStore();
  const { fn } = scriptedDispatch({ sms: 'queued' });
  await verifyStart(
    { workspaceId: 'ws_1', recipient: { e164: '+15551234567' }, maxAttempts: 3 },
    baseDeps(store, fn),
  );
  return store;
}

test('verifyCheck accepts the right code and is idempotent', async () => {
  const store = await startSms();
  const deps = { store, now: () => FIXED_NOW };
  const ok = await verifyCheck({ workspaceId: 'ws_1', verificationId: 'ver_1', code: '424242' }, deps);
  assert.equal(ok.status, 'verified');
  // Second check on an already-verified record is idempotent, not a re-burn.
  const again = await verifyCheck({ workspaceId: 'ws_1', verificationId: 'ver_1', code: '424242' }, deps);
  assert.equal(again.status, 'already_verified');
});

test('verifyCheck rejects a wrong code and counts attempts to the cap', async () => {
  const store = await startSms();
  const deps = { store, now: () => FIXED_NOW };
  const first = await verifyCheck({ workspaceId: 'ws_1', verificationId: 'ver_1', code: '000000' }, deps);
  assert.equal(first.status, 'invalid');
  assert.equal(first.attemptsRemaining, 2);
  await verifyCheck({ workspaceId: 'ws_1', verificationId: 'ver_1', code: '000000' }, deps);
  const third = await verifyCheck({ workspaceId: 'ws_1', verificationId: 'ver_1', code: '000000' }, deps);
  assert.equal(third.status, 'max_attempts');
  // Even the correct code is refused once the cap is hit.
  const late = await verifyCheck({ workspaceId: 'ws_1', verificationId: 'ver_1', code: '424242' }, deps);
  assert.equal(late.status, 'max_attempts');
});

test('verifyCheck reports expired past the TTL', async () => {
  const store = await startSms();
  const later = new Date(FIXED_NOW.getTime() + 301_000); // ttl default 300s
  const res = await verifyCheck(
    { workspaceId: 'ws_1', verificationId: 'ver_1', code: '424242' },
    { store, now: () => later },
  );
  assert.equal(res.status, 'expired');
});

test('verifyCheck returns not_found for an unknown id', async () => {
  const store = memStore();
  const res = await verifyCheck(
    { workspaceId: 'ws_1', verificationId: 'nope', code: '424242' },
    { store, now: () => FIXED_NOW },
  );
  assert.equal(res.status, 'not_found');
});
