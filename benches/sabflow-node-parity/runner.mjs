#!/usr/bin/env node
// benches/sabflow-node-parity/runner.mjs
//
// Golden-fixture parity runner.
//
// Usage:
//   node runner.mjs <nodeType>        run one fixture
//   node runner.mjs --all             run every fixture under fixtures/
//   node runner.mjs --list            list discovered fixtures and exit
//
// Env:
//   N8N_HARNESS_URL     default http://127.0.0.1:5679   (the /test shim)
//   SABFLOW_RUST_URL    default http://127.0.0.1:7070   (POST /run)
//   ALLOW_RUST_SKIP=1   treat "SabFlow side not generic yet" as a skip,
//                       not a failure (useful pre-C.2.10).
//
// Wire contract (both engines):
//   request:  { nodeType, params, items }
//   response: { items }
//
// Exit codes:
//   0  parity (or skipped under ALLOW_RUST_SKIP=1)
//   1  diff   (engines disagreed, OR either disagreed with expected-output)
//   2  setup  (engine unreachable, fixture missing, bad json)
//
// Built-ins only — no npm install.

import { request } from 'node:http';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');

const N8N_URL = process.env.N8N_HARNESS_URL ?? 'http://127.0.0.1:5679';
const RUST_URL = process.env.SABFLOW_RUST_URL ?? 'http://127.0.0.1:7070';
const ALLOW_RUST_SKIP = process.env.ALLOW_RUST_SKIP === '1';

// --- HTTP helper (node:http only, no node:https — the harness is loopback). ---

function postJson(urlStr, body, { timeoutMs = 15_000 } = {}) {
  return new Promise((resolveP, rejectP) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (err) {
      rejectP(new Error(`bad URL: ${urlStr}`));
      return;
    }
    if (url.protocol !== 'http:') {
      rejectP(new Error(`only http: is supported by the parity runner (got ${url.protocol})`));
      return;
    }
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const req = request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': payload.length,
          'x-sabflow-execution-id': 'parity-' + Math.random().toString(36).slice(2, 10),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (err) {
            rejectP(new Error(`bad json from ${urlStr}: ${err.message} :: ${text.slice(0, 200)}`));
            return;
          }
          resolveP({ status: res.statusCode ?? 0, json, raw: text });
        });
      },
    );
    req.on('error', (err) => rejectP(new Error(`http error ${urlStr}: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });
    req.write(payload);
    req.end();
  });
}

// --- Canonical JSON for byte-comparable diffs. ---

function canonical(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonical);
  const keys = Object.keys(value).sort();
  const out = {};
  for (const k of keys) out[k] = canonical(value[k]);
  return out;
}

function canonicalString(value) {
  return JSON.stringify(canonical(value), null, 2);
}

function diff(a, b) {
  const sa = canonicalString(a).split('\n');
  const sb = canonicalString(b).split('\n');
  const len = Math.max(sa.length, sb.length);
  const out = [];
  for (let i = 0; i < len; i++) {
    if (sa[i] !== sb[i]) {
      out.push(`@@ line ${i + 1}`);
      out.push(`- ${sa[i] ?? ''}`);
      out.push(`+ ${sb[i] ?? ''}`);
    }
  }
  return out.join('\n');
}

// --- Fixture loading. ---

function listFixtures() {
  if (!existsSync(FIXTURES_DIR)) return [];
  const dirs = readdirSync(FIXTURES_DIR);
  return dirs.filter((d) => {
    const full = join(FIXTURES_DIR, d);
    return statSync(full).isDirectory() && existsSync(join(full, 'input.json'));
  });
}

function loadFixture(nodeType) {
  const dir = join(FIXTURES_DIR, nodeType);
  if (!existsSync(dir)) {
    return { error: `no fixture directory: ${dir}` };
  }
  const inputPath = join(dir, 'input.json');
  if (!existsSync(inputPath)) {
    return { error: `no input.json in ${dir}` };
  }
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const expectedPath = join(dir, 'expected-output.json');
  const expected = existsSync(expectedPath)
    ? JSON.parse(readFileSync(expectedPath, 'utf8'))
    : null;
  return { input, expected, dir };
}

// --- SabFlow Rust transport. ---
//
// v0: the only Rust HTTP surface accepting a per-node call is the bench
// crate at benches/sabflow-executor/rust/, which speaks a different,
// narrower shape:
//     POST /run  { workflow: { node, expression, outputField }, items }
//          ->    { items, elapsedMs }
//
// We adapt the runner's generic { nodeType, params, items } contract to
// that legacy shape ONLY for the `set` node, and ONLY when the request's
// params look like the bench shape (one `expression` + `outputField`).
// Any other node — or any other params shape — is reported as the
// known C.2.10 gap unless the executor under SABFLOW_RUST_URL grows a
// generic /run endpoint, in which case the harness will speak the
// generic shape directly.

async function callSabflowRust({ nodeType, params, items }) {
  // First try the generic shape.  This is what C.2.10 will land.
  try {
    const r = await postJson(`${RUST_URL}/run`, { nodeType, params, items });
    if (r.status === 200 && r.json && Array.isArray(r.json.items)) {
      return { items: r.json.items };
    }
  } catch (err) {
    // Network errors fall through to the legacy adapter, then to the
    // skip path below — but only if the URL really is unreachable do we
    // treat it as a setup error.
    if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo/.test(err.message)) {
      const e = new Error(`SabFlow Rust executor unreachable at ${RUST_URL}: ${err.message}`);
      e.code = 'E_RUST_UNREACHABLE';
      throw e;
    }
  }

  // Legacy bench-shape adapter, scoped strictly to the `set` smoke fixture.
  if (
    nodeType === 'set' &&
    params &&
    typeof params.expression === 'string' &&
    typeof params.outputField === 'string'
  ) {
    const legacyBody = {
      workflow: {
        node: 'set',
        expression: params.expression,
        outputField: params.outputField,
      },
      items,
    };
    const r = await postJson(`${RUST_URL}/run`, legacyBody);
    if (r.status !== 200 || !r.json || !Array.isArray(r.json.items)) {
      const e = new Error(
        `SabFlow legacy /run returned status=${r.status} body=${r.raw?.slice(0, 200)}`,
      );
      e.code = 'E_RUST_BAD_RESPONSE';
      throw e;
    }
    return { items: r.json.items };
  }

  // No transport matched — surface the C.2.10 gap.
  const skip = new Error(
    `SabFlow Rust executor at ${RUST_URL} does not expose a generic per-node /run yet (TODO C.2.10). Pass ALLOW_RUST_SKIP=1 to treat as skip.`,
  );
  skip.code = 'E_RUST_NOT_GENERIC';
  throw skip;
}

async function callN8n({ nodeType, params, items }) {
  const r = await postJson(`${N8N_URL}/test`, { nodeType, params, items });
  if (r.status !== 200 || !r.json || !Array.isArray(r.json.items)) {
    const e = new Error(`n8n harness returned status=${r.status} body=${r.raw?.slice(0, 200)}`);
    e.code = 'E_N8N_BAD_RESPONSE';
    throw e;
  }
  return { items: r.json.items };
}

// --- Per-fixture runner. ---

async function runOne(nodeType) {
  const loaded = loadFixture(nodeType);
  if (loaded.error) {
    console.error(`[setup] ${loaded.error}`);
    return 2;
  }
  const { input, expected } = loaded;
  assert.equal(
    input.nodeType,
    nodeType,
    `fixture ${nodeType}/input.json has nodeType="${input.nodeType}", expected "${nodeType}"`,
  );

  console.log(`[parity] node=${nodeType}`);
  console.log(`         n8n=${N8N_URL}`);
  console.log(`         rust=${RUST_URL}`);

  let n8nOut;
  try {
    n8nOut = await callN8n(input);
  } catch (err) {
    if (err.code === 'E_N8N_BAD_RESPONSE') {
      console.error(`[n8n] response failure: ${err.message}`);
    } else {
      console.error(`[n8n] transport failure: ${err.message}`);
    }
    return 2;
  }

  let rustOut;
  let rustSkipped = false;
  try {
    rustOut = await callSabflowRust(input);
  } catch (err) {
    if (err.code === 'E_RUST_NOT_GENERIC' && ALLOW_RUST_SKIP) {
      console.log(`[rust] SKIP (ALLOW_RUST_SKIP=1) — ${err.message}`);
      rustSkipped = true;
    } else if (err.code === 'E_RUST_UNREACHABLE') {
      console.error(`[rust] ${err.message}`);
      return 2;
    } else {
      console.error(`[rust] ${err.message}`);
      return 1;
    }
  }

  let hadDiff = false;

  if (!rustSkipped) {
    const d = diff(n8nOut, rustOut);
    if (d) {
      console.error('[parity] n8n vs rust diverge:');
      console.error(d);
      hadDiff = true;
    } else {
      console.log('[parity] n8n == rust (byte-identical after canonical sort)');
    }
  }

  if (expected) {
    const dn = diff(expected, n8nOut);
    if (dn) {
      console.error('[parity] n8n vs expected-output.json diverge:');
      console.error(dn);
      hadDiff = true;
    } else {
      console.log('[parity] n8n == expected-output.json');
    }
    if (!rustSkipped) {
      const dr = diff(expected, rustOut);
      if (dr) {
        console.error('[parity] rust vs expected-output.json diverge:');
        console.error(dr);
        hadDiff = true;
      } else {
        console.log('[parity] rust == expected-output.json');
      }
    }
  } else {
    console.log('[parity] (no expected-output.json — pinning n8n output as the reference only)');
  }

  if (hadDiff) return 1;
  if (rustSkipped) return ALLOW_RUST_SKIP ? 0 : 1;
  return 0;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('usage: node runner.mjs <nodeType> | --all | --list');
    process.exit(args.length === 0 ? 2 : 0);
  }

  if (args.includes('--list')) {
    const list = listFixtures();
    if (list.length === 0) {
      console.log('(no fixtures yet)');
    } else {
      for (const n of list) console.log(n);
    }
    process.exit(0);
  }

  if (args.includes('--all')) {
    const list = listFixtures();
    if (list.length === 0) {
      console.log('(no fixtures yet — nothing to do)');
      process.exit(0);
    }
    let worst = 0;
    for (const n of list) {
      const rc = await runOne(n);
      if (rc > worst) worst = rc;
    }
    process.exit(worst);
  }

  const nodeType = args[0];
  if (nodeType.startsWith('--')) {
    console.error(`unknown flag: ${nodeType}`);
    process.exit(2);
  }
  const rc = await runOne(nodeType);
  process.exit(rc);
}

main().catch((err) => {
  console.error(`[fatal] ${err?.stack ?? err}`);
  process.exit(2);
});
