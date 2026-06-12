#!/usr/bin/env node
/**
 * SabCRM MCP smoke test — POSTs `initialize` + `tools/list` (and optionally
 * one `tools/call`) at the stateless Streamable-HTTP endpoint
 * `POST /api/mcp/sabcrm`.
 *
 * The route handler authenticates with a real API key against Mongo and the
 * tools call the Rust engine, so this runs over HTTP against a live server
 * rather than importing the handler in-process.
 *
 * Usage:
 *
 *   SABNODE_API_KEY=sk_… node scripts/sabcrm-mcp-smoke.mjs
 *   SABNODE_API_KEY=sk_… SABNODE_BASE_URL=http://localhost:9002 \
 *     SABCRM_PROJECT_ID=<hex> node scripts/sabcrm-mcp-smoke.mjs
 *
 * Env:
 *   SABNODE_BASE_URL   — server origin (default http://localhost:9002)
 *   SABNODE_API_KEY    — developer-platform API key holding sabcrm:read
 *                        (and sabcrm:write to see the mutation tools)
 *   SABCRM_PROJECT_ID  — optional; when set, also calls list_objects to
 *                        exercise auth → membership → Rust round-trip
 *
 * Equivalent curl:
 *
 *   curl -sS -X POST "$SABNODE_BASE_URL/api/mcp/sabcrm" \
 *     -H "Authorization: Bearer $SABNODE_API_KEY" -H 'Content-Type: application/json' \
 *     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'
 *
 *   curl -sS -X POST "$SABNODE_BASE_URL/api/mcp/sabcrm" \
 *     -H "Authorization: Bearer $SABNODE_API_KEY" -H 'Content-Type: application/json' \
 *     -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
 *
 * Exits 0 when every step passes, 1 otherwise.
 */

const BASE_URL = process.env.SABNODE_BASE_URL || 'http://localhost:9002';
const API_KEY = process.env.SABNODE_API_KEY || '';
const PROJECT_ID = process.env.SABCRM_PROJECT_ID || '';
const ENDPOINT = `${BASE_URL.replace(/\/$/, '')}/api/mcp/sabcrm`;

const EXPECTED_READ_TOOLS = [
  'list_objects',
  'list_records',
  'get_record',
  'search',
  'list_pipelines',
  'list_activities',
];
const EXPECTED_WRITE_TOOLS = [
  'create_record',
  'update_record',
  'delete_record',
  'move_record_stage',
  'log_activity',
];

let failures = 0;
let rpcId = 0;

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  failures += 1;
  console.error(`  ✗ ${msg}`);
}

async function rpc(method, params) {
  rpcId += 1;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId, method, ...(params ? { params } : {}) }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body };
}

async function main() {
  console.log(`SabCRM MCP smoke → ${ENDPOINT}`);

  if (!API_KEY) {
    console.error(
      'SABNODE_API_KEY is not set. Create a developer API key with the sabcrm:read / sabcrm:write scopes and re-run.',
    );
    process.exit(1);
  }

  /* 1. initialize */
  console.log('\n[1/3] initialize');
  const init = await rpc('initialize', { protocolVersion: '2025-06-18' });
  if (init.status !== 200) {
    fail(`HTTP ${init.status} (expected 200): ${JSON.stringify(init.body)}`);
  } else if (init.body?.result?.serverInfo?.name === 'sabnode-sabcrm') {
    pass(`serverInfo.name = sabnode-sabcrm (protocol ${init.body.result.protocolVersion})`);
  } else {
    fail(`unexpected initialize result: ${JSON.stringify(init.body)}`);
  }

  /* 2. tools/list */
  console.log('\n[2/3] tools/list');
  const list = await rpc('tools/list');
  const tools = list.body?.result?.tools;
  if (list.status !== 200 || !Array.isArray(tools)) {
    fail(`HTTP ${list.status} / no tools array: ${JSON.stringify(list.body)}`);
  } else {
    const names = new Set(tools.map((t) => t.name));
    for (const t of EXPECTED_READ_TOOLS) {
      if (names.has(t)) pass(`read tool listed: ${t}`);
      else fail(`read tool MISSING: ${t} (does the key hold sabcrm:read?)`);
    }
    const writeListed = EXPECTED_WRITE_TOOLS.filter((t) => names.has(t));
    if (writeListed.length === EXPECTED_WRITE_TOOLS.length) {
      pass('all write tools listed (key holds sabcrm:write)');
    } else if (writeListed.length === 0) {
      console.log('  - write tools hidden (key has no sabcrm:write — expected for read-only keys)');
    } else {
      fail(`partial write tool list: ${writeListed.join(', ')}`);
    }
    const noSchema = tools.filter((t) => t.inputSchema?.type !== 'object');
    if (noSchema.length === 0) pass('every tool carries an object inputSchema');
    else fail(`tools without object inputSchema: ${noSchema.map((t) => t.name).join(', ')}`);
  }

  /* 3. optional tools/call round-trip */
  console.log('\n[3/3] tools/call list_objects');
  if (!PROJECT_ID) {
    console.log('  - skipped (set SABCRM_PROJECT_ID to exercise the full Rust round-trip)');
  } else {
    const call = await rpc('tools/call', {
      name: 'list_objects',
      arguments: { projectId: PROJECT_ID },
    });
    const result = call.body?.result;
    if (call.status !== 200 || !result) {
      fail(`HTTP ${call.status}: ${JSON.stringify(call.body)}`);
    } else if (result.isError) {
      fail(`tool error: ${result.content?.[0]?.text}`);
    } else {
      const objects = result.structuredContent?.data;
      pass(`list_objects returned ${Array.isArray(objects) ? objects.length : '?'} object(s)`);
    }
  }

  console.log(failures === 0 ? '\nSMOKE OK' : `\nSMOKE FAILED (${failures} failure(s))`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`Smoke run crashed: ${e?.message || e}`);
  process.exit(1);
});
