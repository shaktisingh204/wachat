#!/usr/bin/env node
/**
 * sabcall-cli — a dependency-free CLI for the SabCall public REST API.
 *
 * Uses only Node's global `fetch` and `process.argv`. Reads config from env:
 *   SABCALL_API_BASE   base origin of the SabNode app (default http://localhost:3000)
 *   SABCALL_API_KEY    SabNode API key with calls:read / calls:write scopes
 *
 * Usage:
 *   sabcall-cli place-call    <projectId> <to> [callerId]
 *   sabcall-cli list-calls    <projectId> [limit]
 *   sabcall-cli list-contacts <projectId> [q]
 *   sabcall-cli create-contact <projectId> <name> <phone> [email]
 */

const API_BASE = (process.env.SABCALL_API_BASE ?? 'http://localhost:3000').replace(/\/+$/, '');
const API_KEY = process.env.SABCALL_API_KEY ?? '';

const USAGE = `sabcall-cli — SabCall public REST API client

Usage:
  sabcall-cli place-call     <projectId> <to> [callerId]
  sabcall-cli list-calls     <projectId> [limit]
  sabcall-cli list-contacts  <projectId> [q]
  sabcall-cli create-contact <projectId> <name> <phone> [email]

Environment:
  SABCALL_API_BASE   base origin (default http://localhost:3000)
  SABCALL_API_KEY    SabNode API key (required)`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function usage() {
  console.error(USAGE);
  process.exit(1);
}

/**
 * Fetch wrapper: attaches Bearer auth + JSON headers, throws on non-2xx with
 * the HTTP status and response body text included.
 */
async function api(path, { method = 'GET', body, query } = {}) {
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    Accept: 'application/json',
  };

  let url = `${API_BASE}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SabCall API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    usage();
  }

  if (!API_KEY) {
    fail('SABCALL_API_KEY is not set. Export your SabNode API key first.');
  }

  switch (command) {
    case 'place-call': {
      const [projectId, to, callerId] = args;
      if (!projectId || !to) usage();
      printJson(
        await api('/api/v1/sabcall/calls', {
          method: 'POST',
          body: { projectId, to, ...(callerId ? { callerId } : {}) },
        }),
      );
      break;
    }

    case 'list-calls': {
      const [projectId, limit] = args;
      if (!projectId) usage();
      printJson(
        await api('/api/v1/sabcall/calls', {
          query: { projectId, limit },
        }),
      );
      break;
    }

    case 'list-contacts': {
      const [projectId, q] = args;
      if (!projectId) usage();
      printJson(
        await api('/api/v1/sabcall/contacts', {
          query: { projectId, q },
        }),
      );
      break;
    }

    case 'create-contact': {
      const [projectId, name, phone, email] = args;
      if (!projectId || !name || !phone) usage();
      printJson(
        await api('/api/v1/sabcall/contacts', {
          method: 'POST',
          body: { projectId, name, phone, ...(email ? { email } : {}) },
        }),
      );
      break;
    }

    default:
      fail(`Unknown command: ${command}\n\n${USAGE}`);
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
