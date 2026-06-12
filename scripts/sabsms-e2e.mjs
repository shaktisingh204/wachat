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
  const ws = userId.toHexString();
  const poorWs = poorUserId.toHexString();
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
  } finally {
    // ── 7. Cleanup — remove everything this run created ─────────────────────
    try {
      await users.deleteMany({ _id: { $in: [userId, poorUserId] } });
      await providerAccounts.deleteMany({ workspaceId: { $in: [ws, poorWs] } });
      await numbers.deleteMany({ workspaceId: { $in: [ws, poorWs] } });
      await messages.deleteMany({ workspaceId: { $in: [ws, poorWs] } });
      await conversations.deleteMany({ workspaceId: { $in: [ws, poorWs] } });
      await suppressions.deleteMany({ workspaceId: { $in: [ws, poorWs] } });
      await reservations.deleteMany({ workspaceId: { $in: [ws, poorWs] } });
      await ledger.deleteMany({ workspaceId: { $in: [ws, poorWs] } });
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
