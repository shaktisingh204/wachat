#!/usr/bin/env node
/**
 * SabSMS end-to-end lifecycle test against the local Rust engine (:4002).
 *
 * Drives the full send lifecycle through the engine HTTP API with the
 * mock provider, asserting against Mongo directly: credit holds against
 * `users.credits.sms`, ledger rows, suppression short-circuit, retries,
 * and the inbound webhook → conversation upsert.
 *
 * PREREQUISITES (the script checks these and bails early):
 *   1. Rust engine running:   SABSMS_ENGINE_URL (default http://localhost:4002)
 *      with SABSMS_PROVIDER_MOCK=true SABSMS_ALLOW_UNSIGNED_WEBHOOKS=true
 *   2. Next.js dev server running — the engine reserves/finalises credits
 *      by calling back into Next at SABSMS_APP_CALLBACK_URL
 *      (`/api/sabsms/credits`); the ledger rows are written by that route.
 *   3. Mongo reachable via MONGODB_URI (same DB the engine + Next use).
 *   4. SABSMS_ENGINE_TOKEN + SABSMS_CREDS_KEY matching the engine's env.
 *
 * Usage: node scripts/sabsms-e2e.mjs
 *   SABSMS_ENGINE_URL=http://localhost:4002
 *   NEXT_URL=http://localhost:3000        (or SABSMS_APP_CALLBACK_URL)
 *   MONGODB_URI=mongodb://...  MONGODB_DB=...  (db name; URI default if unset)
 *   SABSMS_ENGINE_TOKEN=...    SABSMS_CREDS_KEY=<64 hex chars>
 */
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';

const ENGINE = (process.env.SABSMS_ENGINE_URL || 'http://localhost:4002').replace(/\/+$/, '');
const NEXT = (process.env.SABSMS_APP_CALLBACK_URL || process.env.NEXT_URL || 'http://localhost:3000').replace(/\/+$/, '');
const TOKEN = process.env.SABSMS_ENGINE_TOKEN || 'devtoken-change-me';
const MONGODB_URI = process.env.MONGODB_URI;
const CREDS_KEY = process.env.SABSMS_CREDS_KEY || 'a'.repeat(64); // engine must use the SAME key

const FROM = '+15550001111';
const TO = '+15550002222';
const SUPPRESSED_TO = '+15550003333';

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; results.push(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}
function note(msg) { results.push(`  · ${msg}`); }

// ── Cipher v1 — inline copy of src/lib/sabsms/credentials.ts (the script
//    runs under plain node; importing the TS source isn't possible).
//    Format: "v1." + b64(nonce12) + "." + b64(ciphertext || gcmTag16),
//    AES-256-GCM, AAD = workspaceId utf8, key = 64-hex SABSMS_CREDS_KEY.
function encryptProviderCreds(workspaceId, blob, keyHex) {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new Error('SABSMS_CREDS_KEY must be 64 hex chars');
  const key = Buffer.from(keyHex, 'hex');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(workspaceId, 'utf8'));
  const ct = Buffer.concat([cipher.update(JSON.stringify(blob), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${nonce.toString('base64')}.${Buffer.concat([ct, tag]).toString('base64')}`;
}

function sha256Hex(s) { return createHash('sha256').update(s).digest('hex'); }

async function engineApi(method, path, body) {
  const res = await fetch(`${ENGINE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-sabsms-service-token': TOKEN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

async function pollMessage(id, predicate, timeoutMs = 15_000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const r = await engineApi('GET', `/v1/messages/${encodeURIComponent(id)}`);
    last = r.json;
    if (last && predicate(last)) return last;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return last;
}

async function pollMongoDoc(col, filter, predicate, timeoutMs = 20_000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await col.findOne(filter);
    if (last && predicate(last)) return last;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return last;
}

function messageIdFilter(id) {
  return ObjectId.isValid(id)
    ? { $or: [{ _id: new ObjectId(id) }, { _id: id }] }
    : { _id: id };
}

async function main() {
  console.log(`\n=== SabSMS E2E — engine ${ENGINE}, app ${NEXT} ===\n`);

  if (!MONGODB_URI) {
    console.error('MONGODB_URI is required (same DB the engine + Next use).');
    process.exit(2);
  }

  // ── 0. Reachability checks — fail fast with a clear message ─────────────
  try {
    const r = await fetch(`${ENGINE}/health`);
    check('engine GET /health', r.status === 200, `status ${r.status}`);
    if (r.status !== 200) throw new Error('engine unhealthy');
  } catch (e) {
    console.error(`Engine unreachable at ${ENGINE} — start services/sabsms-engine with`);
    console.error('  SABSMS_PROVIDER_MOCK=true SABSMS_ALLOW_UNSIGNED_WEBHOOKS=true');
    console.error(String(e?.message ?? e));
    process.exit(2);
  }
  try {
    // Any HTTP answer (401 without token is expected) proves Next is up.
    const r = await fetch(`${NEXT}/api/sabsms/credits?op=reserve`, { method: 'POST' });
    check('Next /api/sabsms/credits reachable', r.status > 0, `status ${r.status}`);
  } catch (e) {
    console.error(`Next.js unreachable at ${NEXT} — the engine cannot reserve credits without it.`);
    console.error('Start the dev server (npm run dev) and set SABSMS_APP_CALLBACK_URL on the engine.');
    console.error(String(e?.message ?? e));
    process.exit(2);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  const users = db.collection('users');
  const providerAccounts = db.collection('sabsms_provider_accounts');
  const numbers = db.collection('sabsms_numbers');
  const messages = db.collection('sabsms_messages');
  const conversations = db.collection('sabsms_conversations');
  const suppressions = db.collection('sabsms_suppressions');
  const reservations = db.collection('sabsms_credit_reservations');
  const ledger = db.collection('sabsms_credit_ledger');

  const userId = new ObjectId();
  const poorUserId = new ObjectId();
  const crossUserId = new ObjectId();
  const ws = userId.toHexString();
  const poorWs = poorUserId.toHexString();
  const crossWs = crossUserId.toHexString();
  const createdMessageIds = [];

  try {
    // ── 1. Setup fixtures ──────────────────────────────────────────────────
    const now = new Date();
    await users.insertOne({
      _id: userId,
      name: 'SabSMS E2E',
      email: `sabsms-e2e-${ws}@example.test`,
      credits: { sms: 100 },
      createdAt: now,
    });
    await users.insertOne({
      _id: poorUserId,
      name: 'SabSMS E2E (broke)',
      email: `sabsms-e2e-${poorWs}@example.test`,
      credits: { sms: 0 },
      createdAt: now,
    });
    await providerAccounts.insertOne({
      workspaceId: ws,
      provider: 'mock',
      credentialsCipher: encryptProviderCreds(ws, { apiKey: 'mock-key' }, CREDS_KEY),
      isDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await numbers.insertOne({
      workspaceId: ws,
      e164: FROM,
      country: 'US',
      type: 'longcode',
      provider: 'mock',
      capabilities: { sms: true, mms: false, rcs: false, voice: false },
      status: 'active',
      createdAt: now,
    });
    check('setup: users + provider account + number inserted', true, `ws=${ws}`);

    // ── 2. Happy send → 'sent', credits decrease, ledger row ───────────────
    {
      const r = await engineApi('POST', '/v1/messages', {
        workspaceId: ws,
        to: TO,
        body: 'hello world',
        category: 'transactional',
        provider: 'mock',
        from: FROM,
      });
      check('POST /v1/messages accepted', r.status >= 200 && r.status < 300 && !!r.json?.id, `status ${r.status} id=${r.json?.id}`);
      const id = r.json?.id;
      if (id) {
        createdMessageIds.push(id);
        const msg = await pollMessage(id, (m) => m.status === 'sent' || m.status === 'failed', 15_000);
        check('message reaches status "sent"', msg?.status === 'sent', `status=${msg?.status} err=${msg?.errorCode ?? ''}`);
      }
      const user = await users.findOne({ _id: userId });
      check('users.credits.sms decreased by 1 (100 → 99)', user?.credits?.sms === 99, `balance=${user?.credits?.sms}`);
      const row = await ledger.findOne({ workspaceId: ws, kind: 'debit' });
      check('ledger debit row exists', !!row && row.delta === -1, row ? `delta=${row.delta}` : 'missing (is the Next route wired + engine finalising?)');
    }

    // ── 3. Insufficient credits → 'failed' / credit_rejected ───────────────
    {
      const r = await engineApi('POST', '/v1/messages', {
        workspaceId: poorWs,
        to: TO,
        body: 'no credits for me',
        category: 'transactional',
        provider: 'mock',
        from: FROM,
      });
      const id = r.json?.id;
      if (id) createdMessageIds.push(id);
      // Either rejected synchronously or failed after the reserve callback.
      if (r.json?.status === 'failed' || r.json?.status === 'rejected') {
        check('zero-credit send rejected', true, `status=${r.json.status}`);
      } else if (id) {
        const msg = await pollMessage(id, (m) => m.status === 'failed' || m.status === 'rejected', 15_000);
        check(
          'zero-credit send fails with credit_rejected',
          (msg?.status === 'failed' || msg?.status === 'rejected') && msg?.errorCode === 'credit_rejected',
          `status=${msg?.status} errorCode=${msg?.errorCode}`,
        );
      } else {
        check('zero-credit send produced a message id', false, `status ${r.status}`);
      }
      const poor = await users.findOne({ _id: poorUserId });
      check('zero-credit balance untouched', (poor?.credits?.sms ?? 0) === 0, `balance=${poor?.credits?.sms}`);
    }

    // ── 4. Retry path — '[RETRY]' body forces provider retries ─────────────
    {
      const r = await engineApi('POST', '/v1/messages', {
        workspaceId: ws,
        to: TO,
        body: '[RETRY]',
        category: 'transactional',
        provider: 'mock',
        from: FROM,
      });
      const id = r.json?.id;
      check('POST /v1/messages [RETRY] accepted', !!id, `status ${r.status}`);
      if (id) {
        createdMessageIds.push(id);
        const doc = await pollMongoDoc(
          messages,
          messageIdFilter(id),
          (m) => (m.attempts ?? 0) >= 1,
          20_000,
        );
        check('retry message records attempts >= 1', (doc?.attempts ?? 0) >= 1, `attempts=${doc?.attempts}`);
        note('retry backoff is 5+30+120s — not waiting for terminal max_retries state in e2e');
      }
    }

    // ── 5. Inbound webhook → message + conversation upsert ─────────────────
    {
      const r = await fetch(`${ENGINE}/webhook/mock/inbound`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId: 'mock-in-1', from: TO, to: FROM, body: 'hi back' }),
      });
      check('POST /webhook/mock/inbound accepted', r.status >= 200 && r.status < 300, `status ${r.status}`);
      const inbound = await pollMongoDoc(
        messages,
        { workspaceId: ws, direction: 'inbound' },
        () => true,
        10_000,
      );
      check('inbound message doc exists for workspace', !!inbound && inbound.body === 'hi back', inbound ? `from=${inbound.from}` : 'missing');
      const convo = await pollMongoDoc(
        conversations,
        { workspaceId: ws },
        (c) => (c.unreadCount ?? 0) >= 1,
        10_000,
      );
      check('conversation upserted with unreadCount 1', convo?.unreadCount === 1, `unreadCount=${convo?.unreadCount}`);
    }

    // ── 6. Suppression short-circuit ────────────────────────────────────────
    {
      await suppressions.insertOne({
        workspaceId: ws,
        phoneHash: sha256Hex(SUPPRESSED_TO),
        source: 'manual',
        reason: 'e2e',
        createdAt: new Date(),
      });
      const r = await engineApi('POST', '/v1/messages', {
        workspaceId: ws,
        to: SUPPRESSED_TO,
        body: 'should never send',
        category: 'marketing',
        provider: 'mock',
        from: FROM,
      });
      if (r.json?.id) createdMessageIds.push(r.json.id);
      check('suppressed recipient → immediate status "suppressed"', r.json?.status === 'suppressed', `status=${r.json?.status}`);
    }

    // ── 7. Retry → dead-letter refund: [FAIL] is a terminal provider reject ──
    //    A non-retryable rejection settles the hold with charge=false, so the
    //    reserved credit is REFUNDED (no net debit for a send that never left).
    {
      const before = (await users.findOne({ _id: userId }))?.credits?.sms ?? 0;
      const r = await engineApi('POST', '/v1/messages', {
        workspaceId: ws,
        to: TO,
        body: 'goodbye [FAIL]',
        category: 'transactional',
        provider: 'mock',
        from: FROM,
      });
      const id = r.json?.id;
      if (id) createdMessageIds.push(id);
      let terminal = r.json?.status;
      if (id && !(terminal === 'failed' || terminal === 'rejected')) {
        const msg = await pollMessage(id, (m) => m.status === 'failed' || m.status === 'rejected', 15_000);
        terminal = msg?.status;
      }
      check('[FAIL] send reaches terminal failed/rejected', terminal === 'failed' || terminal === 'rejected', `status=${terminal}`);
      const after = await pollMongoDoc(users, { _id: userId }, (u) => (u?.credits?.sms ?? 0) === before, 10_000);
      check('terminal-fail refunds the held credit (balance unchanged)', (after?.credits?.sms ?? -1) === before, `before=${before} after=${after?.credits?.sms}`);
      const releaseRow = await pollMongoDoc(
        ledger,
        { workspaceId: ws, kind: 'release' },
        () => true,
        10_000,
      );
      check('release ledger row written for the dead-lettered send', !!releaseRow && releaseRow.delta > 0, releaseRow ? `delta=${releaseRow.delta}` : 'missing');
    }

    // ── 8. Cross-workspace credential isolation (AAD binding) ───────────────
    //    Provider creds are sealed with AAD = workspaceId. A cipher minted for
    //    one workspace cannot be decrypted by another, so a "borrowed" cipher
    //    fails the send (GCM auth) instead of letting tenant B send on tenant
    //    A's account. The send must NOT succeed and must NOT charge B.
    {
      await users.insertOne({
        _id: crossUserId,
        name: 'SabSMS E2E (cross-tenant)',
        email: `sabsms-e2e-${crossWs}@example.test`,
        credits: { sms: 50 },
        createdAt: new Date(),
      });
      // Cipher sealed with a DIFFERENT workspace id as AAD (here: `ws`),
      // then planted on crossWs's account — simulating a lifted credential.
      await providerAccounts.insertOne({
        workspaceId: crossWs,
        provider: 'mock',
        credentialsCipher: encryptProviderCreds(ws, { apiKey: 'mock-key' }, CREDS_KEY),
        isDefault: true,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await numbers.insertOne({
        workspaceId: crossWs,
        e164: FROM,
        country: 'US',
        type: 'longcode',
        provider: 'mock',
        capabilities: { sms: true, mms: false, rcs: false, voice: false },
        status: 'active',
        createdAt: new Date(),
      });
      const r = await engineApi('POST', '/v1/messages', {
        workspaceId: crossWs,
        to: TO,
        body: 'using borrowed creds',
        category: 'transactional',
        provider: 'mock',
        from: FROM,
      });
      const id = r.json?.id;
      if (id) createdMessageIds.push(id);
      let status = r.json?.status;
      if (id && status === 'queued') {
        const msg = await pollMessage(id, (m) => m.status === 'failed' || m.status === 'rejected' || m.status === 'sent', 15_000);
        status = msg?.status;
      }
      check('cross-tenant cipher cannot send (not "sent")', status !== 'sent', `status=${status}`);
      const cross = await users.findOne({ _id: crossUserId });
      check('cross-tenant balance untouched (no charge on creds failure)', (cross?.credits?.sms ?? 0) === 50, `balance=${cross?.credits?.sms}`);
    }

    // ── 9. Campaign batch reserve + release (op=reserve-batch) ──────────────
    //    The campaign ticker takes a single whole-batch affordability hold via
    //    the Next credits route, then releases it (the per-message holds are
    //    taken at send time). Exercise that round-trip directly.
    {
      const campaignId = new ObjectId().toHexString();
      const before = (await users.findOne({ _id: userId }))?.credits?.sms ?? 0;
      const segmentsTotal = 5;
      const reserve = await fetch(`${NEXT}/api/sabsms/credits?op=reserve-batch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sabsms-service-token': TOKEN },
        body: JSON.stringify({
          workspaceId: ws,
          campaignId,
          count: 5,
          segmentsTotal,
          category: 'marketing',
          destinationCountry: 'US',
          channel: 'sms',
        }),
      });
      const rj = await reserve.json().catch(() => ({}));
      check('reserve-batch approved', reserve.status === 200 && rj?.approved === true && !!rj?.reservationToken, `status=${reserve.status} approved=${rj?.approved}`);
      const held = await pollMongoDoc(users, { _id: userId }, (u) => (u?.credits?.sms ?? before) < before, 8_000);
      check('reserve-batch holds credits (US sms = 5 segments → 5)', before - (held?.credits?.sms ?? before) === segmentsTotal, `held=${before - (held?.credits?.sms ?? before)}`);
      if (rj?.reservationToken) {
        const release = await fetch(`${NEXT}/api/sabsms/credits?op=finalise`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-sabsms-service-token': TOKEN },
          body: JSON.stringify({ workspaceId: ws, messageId: campaignId, reservationToken: rj.reservationToken, charge: false }),
        });
        check('reserve-batch release accepted', release.status === 200, `status=${release.status}`);
        const restored = await pollMongoDoc(users, { _id: userId }, (u) => (u?.credits?.sms ?? 0) === before, 8_000);
        check('reserve-batch release refunds the whole hold', (restored?.credits?.sms ?? -1) === before, `balance=${restored?.credits?.sms} expected=${before}`);
      }
    }

    // ── 10. Expired-hold sweep (releaseExpiredHolds via the lazy route sweep) ─
    //    A held reservation past its expiry is refunded by the sweep that runs
    //    opportunistically on every credits-route call (and on the PM2
    //    credits-sweeper interval). Plant an already-expired hold, deduct the
    //    balance to match, poke the route, and assert the refund.
    {
      const before = (await users.findOne({ _id: userId }))?.credits?.sms ?? 0;
      const staleToken = `e2e-stale-${new ObjectId().toHexString()}`;
      const amount = 3;
      await users.updateOne({ _id: userId }, { $inc: { 'credits.sms': -amount } });
      await reservations.insertOne({
        token: staleToken,
        workspaceId: ws,
        messageId: `stale:${staleToken}`,
        amount,
        status: 'held',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        expiresAt: new Date(Date.now() - 16 * 60 * 1000), // past the 15-min TTL
      });
      // Poke the route (unauthenticated is fine — the lazy sweep fires before
      // auth rejection); fall back to an authenticated no-op reserve if needed.
      await fetch(`${NEXT}/api/sabsms/credits?op=reserve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sabsms-service-token': TOKEN },
        body: JSON.stringify({ workspaceId: '__admin_debug_dry_run__', messageId: 'sweep-poke' }),
      }).catch(() => {});
      const swept = await pollMongoDoc(reservations, { token: staleToken }, (d) => d?.status === 'released', 12_000);
      check('expired hold swept to "released"', swept?.status === 'released', `status=${swept?.status}`);
      const refunded = await pollMongoDoc(users, { _id: userId }, (u) => (u?.credits?.sms ?? 0) === before, 12_000);
      check('expired-hold sweep refunds the balance', (refunded?.credits?.sms ?? -1) === before, `balance=${refunded?.credits?.sms} expected=${before}`);
    }
  } finally {
    // ── 7. Cleanup — remove everything this run created ─────────────────────
    try {
      const allWs = [ws, poorWs, crossWs];
      await users.deleteMany({ _id: { $in: [userId, poorUserId, crossUserId] } });
      await providerAccounts.deleteMany({ workspaceId: { $in: allWs } });
      await numbers.deleteMany({ workspaceId: { $in: allWs } });
      await messages.deleteMany({ workspaceId: { $in: allWs } });
      await conversations.deleteMany({ workspaceId: { $in: allWs } });
      await suppressions.deleteMany({ workspaceId: { $in: allWs } });
      await reservations.deleteMany({ workspaceId: { $in: allWs } });
      await ledger.deleteMany({ workspaceId: { $in: allWs } });
      note('cleanup complete');
    } catch (e) {
      note(`cleanup failed: ${e?.message ?? e}`);
    }
    await client.close().catch(() => {});
  }

  // summary
  console.log(results.join('\n'));
  console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('E2E crashed:', e); process.exit(2); });
