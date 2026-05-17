/**
 * SabFlow — Credential connection-test endpoint
 *
 * POST /api/sabflow/credentials/test
 *   Body: { type: CredentialType, data: Record<string, string> }
 *
 *   200 → { ok: true, info?: string }
 *   200 → { ok: true, skipped: true, message: string }    (no tester implemented)
 *   200 → { ok: false, error: string }                    (test ran but failed)
 *   401 → { error: 'Authentication required' }
 *   400 → { error: '…' }
 *
 * Each tester runs a minimal authenticated "ping" against the provider. DB
 * drivers (pg/mysql2/mongodb/redis) are dynamic-imported inside the handler
 * via the Function-constructed pattern so Turbopack/webpack can't statically
 * pull native modules into the bundle.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  CREDENTIAL_TYPES,
  type CredentialType,
} from '@/lib/sabflow/credentials/types';
import { getCredentialById } from '@/lib/sabflow/credentials/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Helpers ─────────────────────────────────────────────────────────────────

type TestResult =
  | { ok: true; info?: string }
  | { ok: true; skipped: true; message: string }
  | { ok: false; error: string };

function isCredentialType(v: unknown): v is CredentialType {
  return typeof v === 'string' && (CREDENTIAL_TYPES as string[]).includes(v);
}

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: string | { toString(): string }; id?: string };
  const userId = u._id ?? u.id;
  if (!userId) return null;
  return typeof userId === 'string' ? userId : String(userId);
}

// Function-constructed dynamic import — invisible to bundler static analysis.
const dynImport = new Function('m', 'return import(m)') as (s: string) => Promise<unknown>;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

/**
 * Read a required field from the credential data bag.  Accepts fallback keys
 * so testers that accept either `accessToken` or `apiKey` can declare both.
 */
function requireField(
  data: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const v = data[key];
    if (v && typeof v === 'string') return v;
  }
  throw new Error(`Missing required field: ${keys.join(' or ')}`);
}

async function httpJsonTest(opts: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  okMessage?: string;
}): Promise<TestResult> {
  try {
    const res = await fetch(opts.url, {
      method: opts.method ?? 'GET',
      headers: opts.headers,
      body: opts.body,
      // Hard timeout via AbortController
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let detail = '';
      try {
        const txt = await res.text();
        detail = txt.slice(0, 200);
      } catch {
        // ignore
      }
      return {
        ok: false,
        error: `${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`,
      };
    }
    return { ok: true, info: opts.okMessage };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

// ── Testers ─────────────────────────────────────────────────────────────────

async function testOpenAi(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (data.organizationId) headers['OpenAI-Organization'] = data.organizationId;
  return httpJsonTest({
    url: 'https://api.openai.com/v1/models',
    headers,
    okMessage: 'OpenAI: models endpoint reachable',
  });
}

async function testAnthropic(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  // Anthropic doesn't have a free "ping" — /v1/models requires the key and
  // returns 200 with a list. anthropic-version header is required.
  return httpJsonTest({
    url: 'https://api.anthropic.com/v1/models',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    okMessage: 'Anthropic: models endpoint reachable',
  });
}

async function testSlack(data: Record<string, string>): Promise<TestResult> {
  const botToken = requireField(data, 'botToken');
  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${botToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; team?: string };
    if (!res.ok || json.ok !== true) {
      return { ok: false, error: json.error ?? `Slack auth.test failed (${res.status})` };
    }
    return { ok: true, info: `Slack: authenticated as team ${json.team ?? 'unknown'}` };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

async function testGitHub(data: Record<string, string>): Promise<TestResult> {
  const token = requireField(data, 'accessToken');
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SabFlow-Credential-Test',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { ok: false, error: `GitHub /user → ${res.status} ${res.statusText}` };
    }
    const json = (await res.json().catch(() => ({}))) as { login?: string };
    return { ok: true, info: `GitHub: authenticated as ${json.login ?? 'user'}` };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

async function testStripe(data: Record<string, string>): Promise<TestResult> {
  const secretKey = requireField(data, 'secretKey');
  // GET /v1/balance is a cheap authenticated read.
  return httpJsonTest({
    url: 'https://api.stripe.com/v1/balance',
    headers: { Authorization: `Bearer ${secretKey}` },
    okMessage: 'Stripe: balance endpoint reachable',
  });
}

async function testSendGrid(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  return httpJsonTest({
    url: 'https://api.sendgrid.com/v3/scopes',
    headers: { Authorization: `Bearer ${apiKey}` },
    okMessage: 'SendGrid: scopes endpoint reachable',
  });
}

async function testMistral(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  return httpJsonTest({
    url: 'https://api.mistral.ai/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    okMessage: 'Mistral: models endpoint reachable',
  });
}

async function testTogetherAi(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  return httpJsonTest({
    url: 'https://api.together.xyz/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    okMessage: 'Together: models endpoint reachable',
  });
}

async function testElevenLabs(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  return httpJsonTest({
    url: 'https://api.elevenlabs.io/v1/voices',
    headers: { 'xi-api-key': apiKey },
    okMessage: 'ElevenLabs: voices endpoint reachable',
  });
}

async function testTwilio(data: Record<string, string>): Promise<TestResult> {
  const accountSid = requireField(data, 'accountSid');
  const authToken = requireField(data, 'authToken');
  const basic = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  return httpJsonTest({
    url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
    headers: { Authorization: `Basic ${basic}` },
    okMessage: 'Twilio: account fetch succeeded',
  });
}

async function testMailgun(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  const domain = data.domain;
  // /v3/domains lists all domains the key can manage — cheaper than a send test.
  const url = domain
    ? `https://api.mailgun.net/v3/${encodeURIComponent(domain)}/limits`
    : 'https://api.mailgun.net/v3/domains';
  const basic = Buffer.from(`api:${apiKey}`).toString('base64');
  return httpJsonTest({
    url,
    headers: { Authorization: `Basic ${basic}` },
    okMessage: 'Mailgun: API reachable',
  });
}

async function testResend(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  return httpJsonTest({
    url: 'https://api.resend.com/domains',
    headers: { Authorization: `Bearer ${apiKey}` },
    okMessage: 'Resend: domains endpoint reachable',
  });
}

async function testHubspot(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'accessToken', 'apiKey');
  return httpJsonTest({
    url: 'https://api.hubapi.com/integrations/v1/me',
    headers: { Authorization: `Bearer ${apiKey}` },
    okMessage: 'HubSpot: account fetch succeeded',
  });
}

async function testAirtable(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'accessToken', 'apiKey');
  return httpJsonTest({
    url: 'https://api.airtable.com/v0/meta/whoami',
    headers: { Authorization: `Bearer ${apiKey}` },
    okMessage: 'Airtable: whoami succeeded',
  });
}

async function testNotion(data: Record<string, string>): Promise<TestResult> {
  const token = requireField(data, 'accessToken', 'apiKey');
  return httpJsonTest({
    url: 'https://api.notion.com/v1/users/me',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
    },
    okMessage: 'Notion: users/me succeeded',
  });
}

async function testDiscord(data: Record<string, string>): Promise<TestResult> {
  const token = requireField(data, 'botToken');
  return httpJsonTest({
    url: 'https://discord.com/api/v10/users/@me',
    headers: { Authorization: `Bot ${token}` },
    okMessage: 'Discord: bot users/@me succeeded',
  });
}

async function testTelegram(data: Record<string, string>): Promise<TestResult> {
  const token = requireField(data, 'botToken', 'accessToken');
  return httpJsonTest({
    url: `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`,
    headers: {},
    okMessage: 'Telegram: getMe succeeded',
  });
}

async function testGroq(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  return httpJsonTest({
    url: 'https://api.groq.com/openai/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    okMessage: 'Groq: models endpoint reachable',
  });
}

async function testCohere(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  return httpJsonTest({
    url: 'https://api.cohere.ai/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    okMessage: 'Cohere: models endpoint reachable',
  });
}

async function testOpenRouter(data: Record<string, string>): Promise<TestResult> {
  const apiKey = requireField(data, 'apiKey');
  return httpJsonTest({
    url: 'https://openrouter.ai/api/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    okMessage: 'OpenRouter: models endpoint reachable',
  });
}

async function testPostgres(data: Record<string, string>): Promise<TestResult> {
  try {
    const host = requireField(data, 'host');
    const database = requireField(data, 'database');
    const user = requireField(data, 'username');
    const password = requireField(data, 'password');
    const port = data.port ? Number(data.port) : 5432;
    const ssl = String(data.ssl ?? '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined;

    const pgMod = (await dynImport('pg')) as { Client?: new (opts: unknown) => unknown } & {
      default?: { Client?: new (opts: unknown) => unknown };
    };
    const Client = pgMod.Client ?? pgMod.default?.Client;
    if (!Client) return { ok: false, error: 'pg driver missing Client export' };

    type PgClient = {
      connect: () => Promise<void>;
      query: (sql: string) => Promise<{ rows: unknown[] }>;
      end: () => Promise<void>;
    };
    const client = new Client({ host, port, database, user, password, ssl }) as PgClient;
    try {
      await client.connect();
      await client.query('SELECT 1');
      return { ok: true, info: `PostgreSQL: connected to ${database}@${host}:${port}` };
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

async function testMySql(data: Record<string, string>): Promise<TestResult> {
  try {
    const host = requireField(data, 'host');
    const database = requireField(data, 'database');
    const user = requireField(data, 'username');
    const password = requireField(data, 'password');
    const port = data.port ? Number(data.port) : 3306;

    const mysqlMod = (await dynImport('mysql2/promise')) as {
      createConnection?: (opts: unknown) => Promise<unknown>;
      default?: { createConnection?: (opts: unknown) => Promise<unknown> };
    };
    const createConnection = mysqlMod.createConnection ?? mysqlMod.default?.createConnection;
    if (!createConnection) return { ok: false, error: 'mysql2 driver missing createConnection' };

    type MysqlConn = {
      query: (sql: string) => Promise<unknown>;
      end: () => Promise<void>;
    };
    const conn = (await createConnection({ host, port, database, user, password })) as MysqlConn;
    try {
      await conn.query('SELECT 1');
      return { ok: true, info: `MySQL: connected to ${database}@${host}:${port}` };
    } finally {
      await conn.end().catch(() => undefined);
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

async function testMongo(data: Record<string, string>): Promise<TestResult> {
  try {
    const connectionString = requireField(data, 'connectionString');
    const mod = (await dynImport('mongodb')) as {
      MongoClient?: new (uri: string) => unknown;
      default?: { MongoClient?: new (uri: string) => unknown };
    };
    const MongoClient = mod.MongoClient ?? mod.default?.MongoClient;
    if (!MongoClient) return { ok: false, error: 'mongodb driver missing MongoClient' };

    type Client = {
      connect: () => Promise<unknown>;
      db: (name?: string) => { command: (cmd: Record<string, number>) => Promise<unknown> };
      close: () => Promise<void>;
    };
    const client = new MongoClient(connectionString) as Client;
    try {
      await client.connect();
      await client.db().command({ ping: 1 });
      return { ok: true, info: 'MongoDB: ping ok' };
    } finally {
      await client.close().catch(() => undefined);
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

async function testRedis(data: Record<string, string>): Promise<TestResult> {
  try {
    const connectionString = requireField(data, 'connectionString');
    const mod = (await dynImport('redis')) as {
      createClient?: (opts: { url: string }) => unknown;
      default?: { createClient?: (opts: { url: string }) => unknown };
    };
    const createClient = mod.createClient ?? mod.default?.createClient;
    if (!createClient) return { ok: false, error: 'redis driver missing createClient' };

    type RedisClient = {
      on: (ev: string, cb: (e: unknown) => void) => RedisClient;
      connect: () => Promise<void>;
      ping: () => Promise<string>;
      quit: () => Promise<unknown>;
    };
    const client = createClient({ url: connectionString }) as RedisClient;
    client.on('error', () => undefined); // swallow — failure surfaces via connect
    try {
      await client.connect();
      const reply = await client.ping();
      return { ok: true, info: `Redis: ${reply}` };
    } finally {
      await client.quit().catch(() => undefined);
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

// ── Router ──────────────────────────────────────────────────────────────────

async function runTest(type: CredentialType, data: Record<string, string>): Promise<TestResult> {
  switch (type) {
    case 'openai':
      return testOpenAi(data);
    case 'anthropic':
      return testAnthropic(data);
    case 'mistral':
      return testMistral(data);
    case 'together_ai':
      return testTogetherAi(data);
    case 'elevenlabs':
      return testElevenLabs(data);
    case 'groq':
      return testGroq(data);
    case 'cohere':
      return testCohere(data);
    case 'openrouter':
      return testOpenRouter(data);
    case 'slack':
      return testSlack(data);
    case 'discord':
      return testDiscord(data);
    case 'telegram':
      return testTelegram(data);
    case 'twilio':
      return testTwilio(data);
    case 'github':
      return testGitHub(data);
    case 'stripe':
      return testStripe(data);
    case 'sendgrid':
      return testSendGrid(data);
    case 'mailgun':
      return testMailgun(data);
    case 'resend':
      return testResend(data);
    case 'hubspot':
      return testHubspot(data);
    case 'airtable':
      return testAirtable(data);
    case 'notion':
      return testNotion(data);
    case 'postgres':
      return testPostgres(data);
    case 'mysql':
      return testMySql(data);
    case 'mongodb':
      return testMongo(data);
    case 'redis':
      return testRedis(data);
    default:
      return {
        ok: true,
        skipped: true,
        message: 'No test implemented for this type — credential will be saved without verification.',
      };
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  /*
   * Two supported request modes:
   *
   *   1. `{ id: string }`              — test an existing saved credential.
   *                                      Loads decrypted data server-side.
   *   2. `{ type, data: {...} }`       — test before save (settings panel).
   *                                      Data is supplied by the caller.
   *
   * Mode (1) is what the in-block "Test" button uses.  Mode (2) is what the
   * credentials editor uses before persisting a brand-new credential.
   */
  let type: CredentialType;
  let data: Record<string, string> = {};

  if (typeof raw.id === 'string' && raw.id.length > 0) {
    const cred = await getCredentialById(raw.id);
    if (!cred) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }
    if (cred.workspaceId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    type = cred.type;
    data = { ...(cred.data as Record<string, string>) };
  } else {
    if (!isCredentialType(raw.type)) {
      return NextResponse.json({ error: 'Invalid credential type' }, { status: 400 });
    }
    type = raw.type;
    // Normalize data — string→string only.
    const rawData = raw.data;
    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
      for (const [k, v] of Object.entries(rawData as Record<string, unknown>)) {
        if (typeof k !== 'string') continue;
        if (v === undefined || v === null) continue;
        data[k] = typeof v === 'string' ? v : String(v);
      }
    }
  }

  try {
    const result = await runTest(type, data);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[SABFLOW CREDENTIALS TEST] error:', err);
    return NextResponse.json({ ok: false, error: errorMessage(err) });
  }
}
