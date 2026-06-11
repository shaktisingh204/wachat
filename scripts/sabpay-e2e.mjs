#!/usr/bin/env node
/**
 * SabPay end-to-end lifecycle test against the local Rust engine (:8080).
 *
 * Mints a short-lived RUST JWT (same contract as src/lib/jwt-for-rust.ts),
 * then drives the full SabPay lifecycle in TEST mode using the simulate
 * endpoint — no real PayU. Asserts that every list endpoint returns its
 * camelCase wrapper key (the `qrCodes` / `paymentLinks` casing fixes) and
 * that the simulate-driven payment flows through to the relevant rollups.
 *
 * Usage: node scripts/sabpay-e2e.mjs
 *   ENGINE=http://localhost:8080  RUST_JWT_SECRET=...  (read from rust/.env if unset)
 */
import { SignJWT } from 'jose';
import { readFileSync } from 'node:fs';

const ENGINE = process.env.ENGINE || 'http://localhost:8080';
const BASE = `${ENGINE}/v1/sabpay`;

// Read RUST_JWT_SECRET from env or rust/.env
function secretFromEnv() {
  if (process.env.RUST_JWT_SECRET) return process.env.RUST_JWT_SECRET;
  try {
    const txt = readFileSync(new URL('../rust/.env', import.meta.url), 'utf8');
    const m = txt.match(/^RUST_JWT_SECRET=(.*)$/m);
    if (m) return m[1].trim();
  } catch {}
  throw new Error('RUST_JWT_SECRET not found in env or rust/.env');
}

const SUB = 'aaaaaaaaaaaaaaaaaaaaaaaa'; // 24-hex test user/merchant id
let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; results.push(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
}

async function mintJwt() {
  const secret = new TextEncoder().encode(secretFromEnv());
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ tid: SUB, roles: ['owner'] })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(SUB)
    .setIssuer('sabnode-bff')
    .setIssuedAt(now)
    .setExpirationTime(now + 900)
    .sign(secret);
}

let TOKEN;
async function api(method, path, body, { auth = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth) headers.authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

async function main() {
  console.log(`\n=== SabPay E2E — engine ${ENGINE} ===\n`);
  TOKEN = await mintJwt();

  // 0. health
  {
    const r = await fetch(`${ENGINE}/health`);
    check('GET /health 200', r.status === 200, `status ${r.status}`);
  }

  // 1. merchant bootstrap + force test mode
  let merchant = (await api('GET', '/merchant')).json;
  check('GET /merchant (get-or-create)', !!merchant && typeof merchant.businessName === 'string');
  const upd = await api('PUT', '/merchant', { businessName: 'E2E Test Co', brandColor: '#4f46e5', mode: 'test' });
  merchant = upd.json;
  check('PUT /merchant test mode', upd.status === 200 && merchant.mode === 'test', `mode=${merchant?.mode}`);

  // 2. customer
  const cust = (await api('POST', '/customers', { name: 'Asha Verma', email: 'asha@example.com', contact: '+919812345678', gstin: '29ABCDE1234F1Z5' })).json;
  check('POST /customers', !!cust?.id?.startsWith('cust_'), cust?.id);

  // 3. order
  const order = (await api('POST', '/orders', { amount: 250000, receipt: 'rcpt_e2e_1' })).json;
  check('POST /orders amountDue', order?.amountDue === 250000, `due=${order?.amountDue}`);

  // 4. payment + simulate success
  const pay = (await api('POST', '/payments', { amount: 99900, description: 'E2E Pro plan', customer: { name: 'Asha Verma', email: 'asha@example.com' } })).json;
  check('POST /payments created', pay?.status === 'created' && !!pay?.checkoutUrl, pay?.id);
  const sim = (await api('POST', `/public/payments/${pay.id}/simulate`, { outcome: 'success', name: 'Asha Verma', email: 'asha@example.com' }, { auth: false })).json;
  check('POST /public/payments/{id}/simulate success', sim?.status === 'succeeded', `status=${sim?.status}`);
  const payAfter = (await api('GET', `/payments/${pay.id}`)).json;
  check('payment is succeeded + paidAt set', payAfter?.status === 'succeeded' && !!payAfter?.paidAt);

  // 5. refund the payment (partial)
  const refund = (await api('POST', `/payments/${pay.id}/refunds`, { amount: 10000, reason: 'e2e partial' })).json;
  check('POST /payments/{id}/refunds', !!refund?.id?.startsWith('rfnd_'), refund?.id);

  // 6. payment link
  const link = (await api('POST', '/payment-links', { amount: 50000, description: 'E2E link', customerName: 'Asha' })).json;
  check('POST /payment-links shortUrl(camelCase)', typeof link?.shortUrl === 'string', link?.id);

  // 7. qr code
  const qr = (await api('POST', '/qr-codes', { usage: 'multiple_use', fixedAmount: true, amount: 19900, name: 'Front counter' })).json;
  check('POST /qr-codes payloadUrl(camelCase)', typeof qr?.payloadUrl === 'string' && typeof qr?.paymentsCountReceived === 'number', qr?.id);

  // 8. plan + subscription
  const plan = (await api('POST', '/plans', { name: 'E2E Monthly', amount: 49900, interval: 'monthly', intervalCount: 1 })).json;
  check('POST /plans', !!plan?.id?.startsWith('plan_'), plan?.id);
  const sub = (await api('POST', '/subscriptions', { planId: plan.id, customerId: cust.id, totalCount: 12 })).json;
  check('POST /subscriptions', !!sub?.id?.startsWith('sub_') && sub?.totalCount === 12, sub?.id);

  // 9. invoice + issue
  const inv = (await api('POST', '/invoices', { customerId: cust.id, lineItems: [{ name: 'Setup', amount: 100000, quantity: 1 }, { name: 'Seat', amount: 50000, quantity: 3 }] })).json;
  check('POST /invoices draft', inv?.status === 'draft' && inv?.amount === 250000, `amount=${inv?.amount}`);
  const issued = (await api('POST', `/invoices/${inv.id}/issue`)).json;
  check('POST /invoices/{id}/issue', issued?.status === 'issued' && !!issued?.shortUrl);

  // 10. webhook endpoint
  const wh = (await api('POST', '/webhooks', { url: 'https://example.com/sabpay-hook', events: ['payment.succeeded', 'refund.processed'] })).json;
  check('POST /webhooks (secret once)', !!wh?.secret && wh?.hasSecret === true, wh?._id || wh?.id);

  // 11. test dispute against the succeeded payment
  const disp = (await api('POST', '/test/disputes', { paymentId: pay.id, reasonCode: 'fraud' })).json;
  check('POST /test/disputes', !!disp?.id?.startsWith('disp_'), disp?.id);

  // 12. LIST every entity — assert camelCase wrapper keys (the casing-bug surface)
  const lists = [
    ['payments', '/payments?mode=test', 'payments'],
    ['orders', '/orders?mode=test', 'orders'],
    ['refunds', '/refunds?mode=test', 'refunds'],
    ['customers', '/customers?mode=test', 'customers'],
    ['payment-links', '/payment-links?mode=test', 'paymentLinks'],
    ['qr-codes', '/qr-codes?mode=test', 'qrCodes'],
    ['plans', '/plans?mode=test', 'plans'],
    ['subscriptions', '/subscriptions?mode=test', 'subscriptions'],
    ['invoices', '/invoices?mode=test', 'invoices'],
    ['disputes', '/disputes?mode=test', 'disputes'],
  ];
  for (const [label, path, key] of lists) {
    const r = await api('GET', path);
    const arr = r.json?.[key];
    check(`GET /${label} → camelCase "${key}" array`, Array.isArray(arr), `len=${Array.isArray(arr) ? arr.length : 'MISSING (got keys: ' + Object.keys(r.json || {}).join(',') + ')'}`);
  }

  // 13. webhooks wrapper + overview + stats
  const whData = (await api('GET', '/webhooks')).json;
  check('GET /webhooks endpoints+deliveries', Array.isArray(whData?.endpoints) && Array.isArray(whData?.deliveries));
  const overview = (await api('GET', '/overview')).json;
  check('GET /overview merchant+stats+recent', !!overview?.merchant && !!overview?.stats && Array.isArray(overview?.recent));
  const stats = (await api('GET', '/stats')).json;
  check('GET /stats series', Array.isArray(stats?.series) && typeof stats?.successRate === 'number', `vol=${stats?.totalVolume} rate=${stats?.successRate}%`);

  // summary
  console.log(results.join('\n'));
  console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('E2E crashed:', e); process.exit(2); });
