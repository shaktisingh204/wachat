/**
 * Shared harness for the SabFlow API integration tests (node:test via
 * `tsx --test`, hitting the dev server on http://localhost:3002 with a
 * minted `session` cookie).
 *
 * Connectivity is probed ONCE per process in `initContext()`:
 *   - Mongo (3s timeout) — on this Mac, freshly spawned node processes
 *     sometimes get EADDRNOTAVAIL on localhost Mongo (macOS local-network
 *     permission) while the Next dev server connects fine. Tests that
 *     need direct DB access skip with a clear message instead of failing.
 *   - The dev server, via GET /api/sabflow/health.
 *
 * Usage in a test file:
 *
 *   const ctx = await initContext();
 *   test('…', (t) => { if (!requireServer(t, ctx)) return; … });
 */

import type { MongoClient, Db } from 'mongodb';
import {
  BASE_URL,
  connectMongo,
  ensureTestUser,
  mintSessionToken,
  sessionCookieHeader,
} from '../../e2e/helpers/session';

export { BASE_URL };

export interface TestContext {
  /** Dev server reachable on BASE_URL. */
  serverOk: boolean;
  serverError?: string;
  /** Mongo reachable from THIS process (direct driver). */
  mongoOk: boolean;
  mongoError?: string;
  client: MongoClient | null;
  db: Db | null;
  /** `session=<jwt>` — undefined only if JWT_SECRET is missing. */
  cookie: string;
}

export async function initContext(): Promise<TestContext> {
  const ctx: TestContext = {
    serverOk: false,
    mongoOk: false,
    client: null,
    db: null,
    cookie: '',
  };

  // 1) Mongo (3s) — also seeds the fixture user when reachable.
  try {
    const { client, db } = await connectMongo(3000);
    ctx.client = client;
    ctx.db = db;
    ctx.mongoOk = true;
    await ensureTestUser(db);
  } catch (err) {
    ctx.mongoError = err instanceof Error ? err.message : String(err);
  }

  // 2) Session cookie (no Mongo needed — deterministic user id).
  ctx.cookie = sessionCookieHeader(await mintSessionToken());

  // 3) Dev server probe.
  try {
    const res = await fetch(`${BASE_URL}/api/sabflow/health`, {
      signal: AbortSignal.timeout(8000),
    });
    ctx.serverOk = res.ok;
    if (!res.ok) ctx.serverError = `GET /api/sabflow/health → ${res.status}`;
  } catch (err) {
    ctx.serverError = err instanceof Error ? err.message : String(err);
  }

  return ctx;
}

export async function closeContext(ctx: TestContext): Promise<void> {
  if (ctx.client) await ctx.client.close();
}

/* ── Skip guards ────────────────────────────────────────────────────── */

interface Skippable {
  skip: (message?: string) => void;
}

export function requireServer(t: Skippable, ctx: TestContext): boolean {
  if (ctx.serverOk) return true;
  t.skip(
    `dev server not reachable at ${BASE_URL} (${ctx.serverError ?? 'unknown'}) — ` +
      'start it with `npm run dev` (suite is intended for the dev box, see tests/README.md)',
  );
  return false;
}

export function requireMongo(t: Skippable, ctx: TestContext): boolean {
  if (ctx.mongoOk) return true;
  t.skip(
    `Mongo not reachable from this process (${ctx.mongoError ?? 'unknown'}) — ` +
      'on macOS this is usually the local-network permission flake (EADDRNOTAVAIL ' +
      'on localhost:27017), see tests/README.md',
  );
  return false;
}

export function requireServerAndMongo(t: Skippable, ctx: TestContext): boolean {
  return requireServer(t, ctx) && requireMongo(t, ctx);
}

/* ── fetch helpers ──────────────────────────────────────────────────── */

export interface ApiResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export async function api(
  ctx: TestContext,
  method: string,
  path: string,
  opts: { json?: unknown; auth?: boolean } = {},
): Promise<ApiResponse> {
  const headers: Record<string, string> = {};
  if (opts.auth !== false) headers.cookie = ctx.cookie;
  if (opts.json !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  });
  let body: unknown = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}
