/**
 * Unit tests for the v3 omnichannel dispatcher + compliance pre-flight.
 *
 *   npx tsx --test src/lib/sabsms/channels/__tests__/dispatcher.test.ts
 *
 * These prove the headline guarantee: ONE suppression ledger gates every
 * channel. A STOP captured on SMS blocks WhatsApp and voice too, because
 * the pre-flight runs before any adapter. The suppression lookup is
 * injected, so no Mongo/network is touched.
 */

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { dispatch } from '../dispatcher';
import { compliancePreflight, phoneHash } from '../compliance-preflight';
import type {
  ChannelAdapter,
  DispatchContext,
  DispatchResult,
  SabsmsDispatchChannel,
} from '../types';

const CTX: DispatchContext = { workspaceId: 'ws_1', category: 'marketing' };

/** Hermetic pre-flight deps: nothing suppressed, no geo config (allow all).
 *  Injecting both keeps the gate from touching Mongo in unit tests. */
const ALLOW_DEPS = {
  isSuppressed: async () => false,
  getGeoConfig: async () => undefined,
  getFrequencyCap: async () => undefined,
};

/** An adapter that records its calls and returns a fixed queued result. */
function recordingAdapter(): {
  adapter: ChannelAdapter;
  calls: Array<{ channel: SabsmsDispatchChannel }>;
} {
  const calls: Array<{ channel: SabsmsDispatchChannel }> = [];
  const adapter: ChannelAdapter = {
    async dispatch(channel): Promise<DispatchResult> {
      calls.push({ channel });
      return { channelUsed: channel, status: 'queued', providerMessageId: 'm_1' };
    },
  };
  return { adapter, calls };
}

// ─── phoneHash parity with the Rust engine ───────────────────────────────

test('phoneHash is 64-char lowercase hex and deterministic', () => {
  const h = phoneHash('+15551234567');
  assert.equal(h.length, 64);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, phoneHash('+15551234567'));
});

test('phoneHash hashes the raw E.164 bytes incl. the leading "+" (engine parity)', () => {
  // The engine's compliance::hash_phone hashes the raw E.164 string,
  // leading '+' included. If either side drops the '+' or normalizes
  // differently, the suppression ledger and this gate silently diverge.
  const expected = createHash('sha256').update('+15551234567').digest('hex');
  assert.equal(phoneHash('+15551234567'), expected);
  // And the '+' matters — hashing without it must NOT match.
  const withoutPlus = createHash('sha256').update('15551234567').digest('hex');
  assert.notEqual(phoneHash('+15551234567'), withoutPlus);
});

// ─── cross-channel suppression (the moat) ────────────────────────────────

test('a suppressed phone is blocked on whatsapp — same ledger as sms', async () => {
  const suppressed = phoneHash('+15551234567');
  const verdict = await compliancePreflight(
    {
      workspaceId: 'ws_1',
      channel: 'whatsapp',
      recipient: { e164: '+15551234567' },
      ctx: CTX,
    },
    { isSuppressed: async (_ws, hash) => hash === suppressed },
  );
  assert.deepEqual(verdict, { allow: false, reason: 'recipient_suppressed' });
});

test('email is NOT gated by the phone ledger (SabMail has its own)', async () => {
  const verdict = await compliancePreflight(
    {
      workspaceId: 'ws_1',
      channel: 'email',
      recipient: { e164: '+15551234567', email: 'a@b.com' },
      ctx: CTX,
    },
    { isSuppressed: async () => true }, // phone suppressed, but email bypasses it
  );
  assert.deepEqual(verdict, { allow: true });
});

test('allowSuppressed bypasses the gate (OTP / opt-out confirmation)', async () => {
  let looked = false;
  const verdict = await compliancePreflight(
    {
      workspaceId: 'ws_1',
      channel: 'sms',
      recipient: { e164: '+15551234567' },
      ctx: { ...CTX, category: 'otp', allowSuppressed: true },
    },
    {
      isSuppressed: async () => {
        looked = true;
        return true;
      },
    },
  );
  assert.deepEqual(verdict, { allow: true });
  assert.equal(looked, false, 'must not even consult the ledger when bypassed');
});

// ─── dispatcher routing + error semantics ────────────────────────────────

test('blocked pre-flight short-circuits — the adapter never runs', async () => {
  const { adapter, calls } = recordingAdapter();
  const res = await dispatch(
    'whatsapp',
    { e164: '+15551234567' },
    { body: 'hi' },
    CTX,
    {
      adapters: { whatsapp: adapter },
      preflightDeps: { isSuppressed: async () => true },
    },
  );
  assert.equal(res.status, 'blocked');
  assert.equal(res.blockedReason, 'recipient_suppressed');
  assert.equal(res.channelUsed, 'whatsapp');
  assert.equal(calls.length, 0, 'adapter must not be invoked when blocked');
});

test('allowed dispatch reaches the adapter and returns its result', async () => {
  const { adapter, calls } = recordingAdapter();
  const res = await dispatch('sms', { e164: '+15551234567' }, { body: 'hi' }, CTX, {
    adapters: { sms: adapter },
    preflightDeps: ALLOW_DEPS,
  });
  assert.equal(res.status, 'queued');
  assert.equal(res.providerMessageId, 'm_1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].channel, 'sms');
});

test('an adapter that throws yields status "failed", not an exception', async () => {
  const throwing: ChannelAdapter = {
    async dispatch() {
      throw new Error('provider exploded');
    },
  };
  const res = await dispatch('sms', { e164: '+15551234567' }, { body: 'hi' }, CTX, {
    adapters: { sms: throwing },
    preflightDeps: ALLOW_DEPS,
  });
  assert.equal(res.status, 'failed');
  assert.equal(res.error, 'provider exploded');
});

test('not-yet-wired channels return not_configured (voice → SabCall)', async () => {
  const res = await dispatch('voice', { e164: '+15551234567' }, { body: 'hi' }, CTX, {
    preflightDeps: ALLOW_DEPS,
  });
  assert.equal(res.status, 'not_configured');
  assert.equal(res.channelUsed, 'voice');
});
