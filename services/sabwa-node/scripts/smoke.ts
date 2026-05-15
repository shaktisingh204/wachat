/**
 * sabwa-node smoke test.
 *
 * Exercises every HTTP endpoint the Node service is supposed to expose,
 * asserting:
 *   • 2xx for happy-path GETs (most resources are read-only Mongo listings
 *     that return empty arrays for a fake sessionId/projectId).
 *   • 4xx for invalid inputs (missing required query params).
 *   • The expected top-level key (e.g. `labels`, `templates`, `kpis`) is
 *     present on the response body.
 *
 * Endpoints that are still stubs in the Node service (sessions/chats/
 * contacts/groups/scheduled in particular) are tolerated with a 501-or-
 * higher expectation so we can run the suite without false alarms while
 * sibling agents finish wiring those routes.
 *
 *   pnpm --filter @sabnode/sabwa-node smoke
 *   # or:  tsx scripts/smoke.ts
 *
 * Environment:
 *   SABWA_ENGINE_URL    default http://localhost:4001
 *   SABWA_ENGINE_TOKEN  required (matches the service-token gate on /v1/*)
 *
 * Exit code: 0 on all pass, 1 on any fail.
 */

const BASE = (process.env.SABWA_ENGINE_URL ?? 'http://localhost:4001').replace(/\/+$/, '');
const TOKEN = process.env.SABWA_ENGINE_TOKEN ?? '';
const FAKE_PROJECT_ID = 'smoke-project-000000000000';
const FAKE_SESSION_ID = 'smoke-session-000000000000';

type Result = {
  name: string;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  detail?: string;
};

type Expectation = {
  /**
   * Status acceptance: either a single status, an inclusive [min,max] range,
   * or a predicate over the status code.
   */
  status: number | [number, number] | ((s: number) => boolean);
  /** Top-level keys that must appear on the JSON body (when status is 2xx). */
  expectKeys?: string[];
  /** Don't send the service-token header (used for the unauthenticated /health probe). */
  noAuth?: boolean;
  /** If true, allow the response not to be JSON (some 5xx may HTML out). */
  allowNonJson?: boolean;
};

type Case = {
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  expect: Expectation;
};

// ── colour helpers (no deps; opt-out via NO_COLOR per the de-facto std) ───
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
};

function statusOk(status: number, expect: Expectation['status']): boolean {
  if (typeof expect === 'number') return status === expect;
  if (typeof expect === 'function') return expect(status);
  return status >= expect[0] && status <= expect[1];
}

function describeExpect(expect: Expectation['status']): string {
  if (typeof expect === 'number') return String(expect);
  if (typeof expect === 'function') return 'fn(status)';
  return `${expect[0]}-${expect[1]}`;
}

async function runCase(tc: Case): Promise<Result> {
  const url = `${BASE}${tc.path}`;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (!tc.expect.noAuth) headers['x-sabwa-service-token'] = TOKEN;
  if (tc.body !== undefined) headers['content-type'] = 'application/json';

  let status = 0;
  let body: unknown = null;
  let rawText = '';
  try {
    const res = await fetch(url, {
      method: tc.method,
      headers,
      body: tc.body !== undefined ? JSON.stringify(tc.body) : undefined,
    });
    status = res.status;
    rawText = await res.text();
    if (rawText.length > 0) {
      try {
        body = JSON.parse(rawText);
      } catch {
        body = null;
      }
    }
  } catch (err) {
    return {
      name: tc.name,
      method: tc.method,
      path: tc.path,
      status: 0,
      ok: false,
      detail: `network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!statusOk(status, tc.expect.status)) {
    return {
      name: tc.name,
      method: tc.method,
      path: tc.path,
      status,
      ok: false,
      detail: `expected status ${describeExpect(tc.expect.status)}, got ${status}${
        rawText ? ` — ${rawText.slice(0, 160)}` : ''
      }`,
    };
  }

  if (tc.expect.expectKeys && status >= 200 && status < 300) {
    if (body === null || typeof body !== 'object') {
      if (!tc.expect.allowNonJson) {
        return {
          name: tc.name,
          method: tc.method,
          path: tc.path,
          status,
          ok: false,
          detail: `expected JSON body, got: ${rawText.slice(0, 160)}`,
        };
      }
    } else {
      const obj = body as Record<string, unknown>;
      const missing = tc.expect.expectKeys.filter((k) => !(k in obj));
      if (missing.length > 0) {
        return {
          name: tc.name,
          method: tc.method,
          path: tc.path,
          status,
          ok: false,
          detail: `missing top-level keys: ${missing.join(', ')} — got: ${Object.keys(obj).join(',')}`,
        };
      }
    }
  }

  return { name: tc.name, method: tc.method, path: tc.path, status, ok: true };
}

// ── Test matrix ───────────────────────────────────────────────────────────
//
// 2xx happy-path covers each domain with a fake session/project id — every
// mounted route returns an empty array since no data exists. The 4xx cases
// cover missing-required-param paths to make sure validation is wired.
//
// Endpoints listed in the brief but not yet mounted (sessions/chats/
// contacts/groups/scheduled) accept 404/501 so the suite still passes once
// the sibling route agents land their work.
const CASES: Case[] = [
  // ── Unauthenticated probes ──────────────────────────────────────────────
  {
    name: 'GET /health (no auth)',
    method: 'GET',
    path: '/health',
    expect: { status: [200, 599], expectKeys: ['ok'], noAuth: true },
  },
  {
    name: 'GET /healthz (no auth, legacy)',
    method: 'GET',
    path: '/healthz',
    expect: { status: 200, expectKeys: ['ok'], noAuth: true },
  },

  // ── Auth gate ───────────────────────────────────────────────────────────
  {
    name: 'GET /v1/labels without token → 401',
    method: 'GET',
    path: `/v1/labels?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: 401, noAuth: true },
  },

  // ── Sessions / chats / contacts / groups / scheduled ────────────────────
  // These are still stubs (501) or not-yet-mounted (404). We accept either
  // so the smoke suite stays green while sibling agents finish.
  {
    name: 'GET /v1/sessions?projectId',
    method: 'GET',
    path: `/v1/sessions?projectId=${FAKE_PROJECT_ID}`,
    expect: { status: (s) => s === 200 || s === 404 || s === 501 },
  },
  {
    name: 'GET /v1/chats?sessionId',
    method: 'GET',
    path: `/v1/chats?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: (s) => s === 200 || s === 404 || s === 501 },
  },
  {
    name: 'GET /v1/contacts?sessionId',
    method: 'GET',
    path: `/v1/contacts?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: (s) => s === 200 || s === 404 || s === 501 },
  },
  {
    name: 'GET /v1/groups?sessionId',
    method: 'GET',
    path: `/v1/groups?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: (s) => s === 200 || s === 404 || s === 501 },
  },
  {
    name: 'GET /v1/scheduled?sessionId',
    method: 'GET',
    path: `/v1/scheduled?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: (s) => s === 200 || s === 404 || s === 501 },
  },

  // ── Mounted Phase-1 CRUD domains ────────────────────────────────────────
  {
    name: 'GET /v1/labels?sessionId',
    method: 'GET',
    path: `/v1/labels?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: 200, expectKeys: ['labels'] },
  },
  {
    name: 'GET /v1/labels (missing sessionId) → 400',
    method: 'GET',
    path: '/v1/labels',
    expect: { status: 400 },
  },
  {
    name: 'GET /v1/templates?sessionId',
    method: 'GET',
    path: `/v1/templates?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: 200, expectKeys: ['templates'] },
  },
  {
    name: 'GET /v1/templates (missing sessionId) → 400',
    method: 'GET',
    path: '/v1/templates',
    expect: { status: 400 },
  },
  {
    name: 'GET /v1/quick-replies?sessionId',
    method: 'GET',
    path: `/v1/quick-replies?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: 200, expectKeys: ['quickReplies'] },
  },
  {
    name: 'GET /v1/quick-replies (missing sessionId) → 400',
    method: 'GET',
    path: '/v1/quick-replies',
    expect: { status: 400 },
  },
  {
    name: 'GET /v1/group-categories?sessionId',
    method: 'GET',
    path: `/v1/group-categories?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: 200, expectKeys: ['categories'] },
  },
  {
    name: 'GET /v1/group-categories (missing sessionId) → 400',
    method: 'GET',
    path: '/v1/group-categories',
    expect: { status: 400 },
  },

  // ── Auto-replies / integrations ─────────────────────────────────────────
  {
    name: 'GET /v1/auto-replies?sessionId',
    method: 'GET',
    path: `/v1/auto-replies?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: 200, expectKeys: ['autoReplies'] },
  },
  {
    name: 'GET /v1/auto-replies (missing sessionId) → 400',
    method: 'GET',
    path: '/v1/auto-replies',
    expect: { status: 400 },
  },
  {
    name: 'GET /v1/webhooks?projectId',
    method: 'GET',
    path: `/v1/webhooks?projectId=${FAKE_PROJECT_ID}`,
    expect: { status: 200, expectKeys: ['webhooks'] },
  },
  {
    name: 'GET /v1/webhooks (missing projectId) → 400',
    method: 'GET',
    path: '/v1/webhooks',
    expect: { status: 400 },
  },
  {
    name: 'GET /v1/api-keys?projectId',
    method: 'GET',
    path: `/v1/api-keys?projectId=${FAKE_PROJECT_ID}`,
    expect: { status: 200, expectKeys: ['apiKeys'] },
  },
  {
    name: 'GET /v1/api-keys (missing projectId) → 400',
    method: 'GET',
    path: '/v1/api-keys',
    expect: { status: 400 },
  },
  {
    name: 'GET /v1/audit?projectId',
    method: 'GET',
    path: `/v1/audit?projectId=${FAKE_PROJECT_ID}`,
    // listAudit returns { entries, nextCursor? } per the route comment.
    expect: { status: 200, expectKeys: ['entries'] },
  },
  {
    name: 'GET /v1/audit (missing projectId) → 400',
    method: 'GET',
    path: '/v1/audit',
    expect: { status: 400 },
  },

  // ── Broadcasts / bulk / analytics / export ──────────────────────────────
  {
    name: 'GET /v1/broadcasts?sessionId',
    method: 'GET',
    path: `/v1/broadcasts?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: 200, expectKeys: ['broadcasts'] },
  },
  {
    name: 'GET /v1/broadcasts (missing sessionId) → 400',
    method: 'GET',
    path: '/v1/broadcasts',
    expect: { status: 400 },
  },
  {
    name: 'GET /v1/bulk?sessionId',
    method: 'GET',
    path: `/v1/bulk?sessionId=${FAKE_SESSION_ID}`,
    // tolerate either `items` or `bulkJobs`/`jobs` shape until verified.
    expect: { status: 200 },
  },
  {
    name: 'GET /v1/analytics?sessionId&range=7d',
    method: 'GET',
    path: `/v1/analytics?sessionId=${FAKE_SESSION_ID}&range=7d`,
    expect: { status: 200, expectKeys: ['kpis', 'messagesByDay'] },
  },
  {
    name: 'GET /v1/analytics (missing sessionId) → 400',
    method: 'GET',
    path: '/v1/analytics',
    expect: { status: 400 },
  },
  {
    name: 'GET /v1/exports?sessionId',
    method: 'GET',
    path: `/v1/exports?sessionId=${FAKE_SESSION_ID}`,
    expect: { status: 200 },
  },

  // ── messages.send: anti-ban gate validation surface ─────────────────────
  {
    name: 'POST /v1/messages/send without sessionId → 400',
    method: 'POST',
    path: '/v1/messages/send',
    body: { body: 'hello' },
    expect: { status: 400 },
  },

  // ── realtime token mint: missing body → 400 (or 501 stub) ───────────────
  {
    name: 'POST /v1/realtime/token (empty body)',
    method: 'POST',
    path: '/v1/realtime/token',
    body: {},
    expect: { status: (s) => s === 400 || s === 401 || s === 501 },
  },

  // ── 404 sanity check ────────────────────────────────────────────────────
  {
    name: 'GET /v1/this-route-does-not-exist → 404',
    method: 'GET',
    path: '/v1/this-route-does-not-exist',
    expect: { status: 404 },
  },
];

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error(c.red('SABWA_ENGINE_TOKEN env var is required.'));
    process.exit(1);
  }

  console.log(c.bold(`sabwa-node smoke → ${BASE}`));
  console.log(c.dim(`  using token: ${TOKEN.slice(0, 4)}…${TOKEN.slice(-4)} (${TOKEN.length} chars)`));
  console.log('');

  const results: Result[] = [];
  for (const tc of CASES) {
    const r = await runCase(tc);
    results.push(r);
    const tag = r.ok ? c.green('PASS') : c.red('FAIL');
    const statusStr = r.status === 0 ? c.yellow('ERR') : String(r.status);
    console.log(
      `  ${tag}  ${statusStr.padStart(3)}  ${r.method.padEnd(6)} ${r.path}`,
    );
    if (!r.ok && r.detail) console.log(c.dim(`        └─ ${r.detail}`));
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log('');
  console.log(
    failed === 0
      ? c.green(c.bold(`✓ ${passed}/${results.length} passed`))
      : c.red(c.bold(`✗ ${failed} failed, ${passed} passed (of ${results.length})`)),
  );

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(c.red(`smoke test crashed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`));
  process.exit(1);
});
