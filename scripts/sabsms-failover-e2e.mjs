#!/usr/bin/env node
/**
 * SabSMS V2.6 routing — chaos / failover e2e against the local Rust engine.
 *
 * Verifies the cross-provider failover loop and the circuit breaker:
 *
 *   1. FAILOVER ADVANCE — a routing policy with two ordered candidate
 *      accounts; a synchronous provider rejection on the primary makes the
 *      worker advance to the secondary candidate (recorded in the message
 *      doc's `routingAttempts`). With the mock provider the rejection is
 *      body-driven (`[FAIL]`), so it hits BOTH candidates and the message
 *      ends terminal — but `routingAttempts` proves both accounts were
 *      tried in order (the failover loop ran).
 *
 *   2. CIRCUIT-OPEN SKIP (optional, needs Redis) — pre-open the primary
 *      account's circuit (`sabsms:circuit:{acct}:{country}`); a CLEAN send
 *      then skips the open primary and SUCCEEDS on the secondary. Skipped
 *      gracefully when REDIS_URL is unset/unreachable.
 *
 * The mock provider ignores credentials, so per-account failure can only be
 * injected via the circuit breaker (Redis) — body markers fail every
 * candidate equally. That's why (1) asserts the advance trace and (2)
 * asserts true failover success.
 *
 * PREREQUISITES (same as scripts/sabsms-e2e.mjs):
 *   - engine on SABSMS_ENGINE_URL with SABSMS_PROVIDER_MOCK=true
 *   - Next on SABSMS_APP_CALLBACK_URL / NEXT_URL (credits callback)
 *   - Mongo on MONGODB_URI (+ MONGODB_DB), SABSMS_ENGINE_TOKEN, SABSMS_CREDS_KEY
 *   - (optional) REDIS_URL for the circuit-open part
 *
 * Usage: node scripts/sabsms-failover-e2e.mjs
 */
import { createCipheriv, randomBytes } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';

const ENGINE = (process.env.SABSMS_ENGINE_URL || 'http://localhost:4002').replace(/\/+$/, '');
const NEXT = (process.env.SABSMS_APP_CALLBACK_URL || process.env.NEXT_URL || 'http://localhost:3000').replace(/\/+$/, '');
const TOKEN = process.env.SABSMS_ENGINE_TOKEN || 'devtoken-change-me';
const MONGODB_URI = process.env.MONGODB_URI;
const CREDS_KEY = process.env.SABSMS_CREDS_KEY || 'a'.repeat(64);
const REDIS_URL = process.env.REDIS_URL;

const PRIMARY_FROM = '+15550009001';
const SECONDARY_FROM = '+15550009002';
const TO = '+15550009999';
const COUNTRY = 'US';

let pass = 0, fail = 0, skip = 0;
const results = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; results.push(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}
function skipped(name, why) { skip++; results.push(`  ⊘ ${name} — skipped (${why})`); }
function note(msg) { results.push(`  · ${msg}`); }

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

function idFilter(id) {
  return ObjectId.isValid(id) ? { $or: [{ _id: new ObjectId(id) }, { _id: id }] } : { _id: id };
}

/** Minimal RESP client — seed one circuit hash without an npm dependency. */
async function redisOpenCircuit(url, acctId, country) {
  const net = await import('node:net');
  const u = new URL(url);
  const sock = net.createConnection({ host: u.hostname, port: Number(u.port || 6379) });
  const send = (parts) =>
    new Promise((resolve, reject) => {
      const cmd = `*${parts.length}\r\n` + parts.map((p) => `$${Buffer.byteLength(String(p))}\r\n${p}\r\n`).join('');
      sock.once('data', (d) => resolve(d.toString()));
      sock.once('error', reject);
      sock.write(cmd);
    });
  await new Promise((resolve, reject) => { sock.once('connect', resolve); sock.once('error', reject); });
  if (u.password) await send(['AUTH', u.password]);
  const key = `sabsms:circuit:${acctId}:${country}`;
  const now = Math.floor(Date.now() / 1000);
  await send(['HSET', key, 'state', 'open', 'openedAt', String(now), 'failures', '1']);
  await send(['EXPIRE', key, '300']);
  sock.end();
  return key;
}

async function main() {
  console.log(`\n=== SabSMS Failover E2E — engine ${ENGINE}, app ${NEXT} ===\n`);
  if (!MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(2); }

  try {
    const h = await fetch(`${ENGINE}/health`);
    check('engine GET /health', h.status === 200, `status ${h.status}`);
    if (h.status !== 200) throw new Error('engine unhealthy');
  } catch (e) {
    console.error(`Engine unreachable at ${ENGINE} — start it with SABSMS_PROVIDER_MOCK=true.`);
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
  const routingPolicies = db.collection('sabsms_routing_policies');
  const reservations = db.collection('sabsms_credit_reservations');
  const ledger = db.collection('sabsms_credit_ledger');

  const userId = new ObjectId();
  const ws = userId.toHexString();
  const primaryAcctId = new ObjectId();
  const secondaryAcctId = new ObjectId();
  const primaryHex = primaryAcctId.toHexString();
  const secondaryHex = secondaryAcctId.toHexString();
  const createdIds = [];

  try {
    const now = new Date();
    await users.insertOne({ _id: userId, name: 'SabSMS Failover E2E', email: `failover-${ws}@example.test`, credits: { sms: 100 }, createdAt: now });
    for (const [_id, e164] of [[primaryAcctId, PRIMARY_FROM], [secondaryAcctId, SECONDARY_FROM]]) {
      await providerAccounts.insertOne({
        _id, workspaceId: ws, provider: 'mock',
        credentialsCipher: encryptProviderCreds(ws, { apiKey: 'mock-key' }, CREDS_KEY),
        isDefault: _id.equals(primaryAcctId), status: 'active', createdAt: now, updatedAt: now,
      });
      await numbers.insertOne({
        workspaceId: ws, e164, country: COUNTRY, type: 'longcode', provider: 'mock',
        providerAccountId: _id.toHexString(),
        capabilities: { sms: true, mms: false, rcs: false, voice: false }, status: 'active', createdAt: now,
      });
    }
    // Ordered candidates: primary (weight 100) then secondary (weight 50).
    await routingPolicies.insertOne({
      workspaceId: ws,
      rules: [{
        id: 'failover-rule',
        match: { country: COUNTRY },
        routes: [
          { providerAccountId: primaryHex, weight: 100 },
          { providerAccountId: secondaryHex, weight: 50 },
        ],
      }],
    });
    check('setup: 2 provider accounts + routing policy seeded', true, `ws=${ws}`);

    // ── 1. Failover advance: [FAIL] burns both ordered candidates ───────────
    {
      const r = await engineApi('POST', '/v1/messages', {
        workspaceId: ws, to: TO, body: 'primary down [FAIL]', category: 'transactional', provider: 'mock', from: PRIMARY_FROM,
      });
      const id = r.json?.id;
      check('POST /v1/messages accepted', !!id, `status ${r.status}`);
      if (id) {
        createdIds.push(id);
        const doc = await pollMongoDoc(
          messages, idFilter(id),
          (m) => Array.isArray(m.routingAttempts) && m.routingAttempts.length >= 2,
          20_000,
        );
        const attempts = doc?.routingAttempts ?? [];
        const accountsTried = new Set(attempts.map((a) => a.accountId));
        check('failover advanced through BOTH candidates', accountsTried.has(primaryHex) && accountsTried.has(secondaryHex), `tried=${[...accountsTried].join(',')}`);
        check('primary candidate is recorded first', attempts[0]?.accountId === primaryHex, `first=${attempts[0]?.accountId}`);
      }
    }

    // ── 2. Circuit-open skip → clean send succeeds on the secondary ─────────
    if (!REDIS_URL) {
      skipped('circuit-open failover to secondary', 'REDIS_URL unset');
    } else {
      try {
        const key = await redisOpenCircuit(REDIS_URL, primaryHex, COUNTRY);
        note(`opened circuit ${key}`);
        const r = await engineApi('POST', '/v1/messages', {
          workspaceId: ws, to: TO, body: 'clean send during primary outage', category: 'transactional', provider: 'mock', from: PRIMARY_FROM,
        });
        const id = r.json?.id;
        if (id) {
          createdIds.push(id);
          const doc = await pollMongoDoc(messages, idFilter(id), (m) => m.status === 'sent' || m.status === 'failed', 20_000);
          check('clean send succeeds while primary circuit is open', doc?.status === 'sent', `status=${doc?.status}`);
          const skippedPrimary = (doc?.routingAttempts ?? []).some((a) => a.accountId === primaryHex && /circuit/i.test(a.error ?? ''));
          const sentVia = doc?.providerAccountId || doc?.routingAttempts?.slice(-1)?.[0]?.accountId;
          check('primary skipped for an open circuit (failover to secondary)', skippedPrimary || sentVia === secondaryHex, `skippedPrimary=${skippedPrimary} sentVia=${sentVia}`);
        } else {
          check('circuit-open send produced a message id', false, `status ${r.status}`);
        }
      } catch (e) {
        skipped('circuit-open failover to secondary', `redis error: ${e?.message ?? e}`);
      }
    }
  } finally {
    try {
      await users.deleteMany({ _id: userId });
      await providerAccounts.deleteMany({ workspaceId: ws });
      await numbers.deleteMany({ workspaceId: ws });
      await messages.deleteMany({ workspaceId: ws });
      await routingPolicies.deleteMany({ workspaceId: ws });
      await reservations.deleteMany({ workspaceId: ws });
      await ledger.deleteMany({ workspaceId: ws });
      note('cleanup complete');
    } catch (e) {
      note(`cleanup failed: ${e?.message ?? e}`);
    }
    await client.close().catch(() => {});
  }

  console.log(results.join('\n'));
  console.log(`\n=== ${pass} passed, ${fail} failed, ${skip} skipped ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('Failover E2E crashed:', e); process.exit(2); });
