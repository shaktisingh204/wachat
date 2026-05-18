/**
 * SabFlow — Credential "test connection" verification.
 *
 * `testCredential(credentialId, requesterId, workspaceId)` resolves the
 * stored credential, looks up a `testOperation` for its type from a
 * forward-declared registry, decrypts the credential, runs the test, and
 * returns `{ ok, error?, details? }`.
 *
 * Built-in test ops (registered at module load):
 *   - http_basic_auth → GET to a configurable `whoamiUrl` with Basic auth.
 *   - oauth2          → POST to the credential's introspection endpoint.
 *   - google_sheets   → GET `drive.about` (uses oauth2 refresh).
 *
 * Additional types can register at runtime via `registerCredentialTestOp`.
 * Audit logging happens at the route layer (sibling task #7).
 */

import 'server-only';

import { Buffer } from 'node:buffer';
import { getCredentialById } from '@/lib/sabflow/credentials/db';
import type {
  Credential,
  CredentialType,
} from '@/lib/sabflow/credentials/types';

/* ── Public result shape ────────────────────────────────────────────────── */

export interface CredentialTestResult {
  ok: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * A test operation receives the decrypted credential and must return a
 * `CredentialTestResult`.  Implementations should NEVER throw — wrap
 * exceptional cases as `{ ok: false, error }` so the caller stays simple.
 */
export type CredentialTestOp = (
  credential: Credential,
) => Promise<CredentialTestResult>;

/* ── Forward-declared registry ──────────────────────────────────────────── */

const registry: Map<CredentialType, CredentialTestOp> = new Map();

/**
 * Register (or overwrite) a credential-test op for `type`.  Exposed so that
 * provider modules can attach their own test routines without this file
 * depending on every integration.
 */
export function registerCredentialTestOp(
  type: CredentialType,
  op: CredentialTestOp,
): void {
  registry.set(type, op);
}

/** Lookup helper, mainly used in unit tests. */
export function getCredentialTestOp(
  type: CredentialType,
): CredentialTestOp | undefined {
  return registry.get(type);
}

/* ── Shared HTTP helpers ────────────────────────────────────────────────── */

const DEFAULT_TIMEOUT_MS = 8_000;

async function httpRequest(
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<{ status: number; ok: boolean; bodyText: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const bodyText = await res.text();
    return { status: res.status, ok: res.ok, bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

function summariseBody(body: string, maxLen = 240): string {
  const trimmed = body.trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
}

/* ── Built-in test ops ──────────────────────────────────────────────────── */

/**
 * HTTP Basic Auth — GET a configurable "whoami" URL (defaults to
 * https://httpbin.org/basic-auth/<user>/<pass>, which echoes 401 on the
 * wrong creds and 200 on the right ones).  Override the URL with the
 * credential's `whoamiUrl` field for self-hosted endpoints.
 */
const testHttpBasicAuth: CredentialTestOp = async (cred) => {
  const { username, password, whoamiUrl } = cred.data;
  if (!username || !password) {
    return { ok: false, error: 'Missing username or password' };
  }
  const url =
    whoamiUrl?.trim() ||
    `https://httpbin.org/basic-auth/${encodeURIComponent(username)}/${encodeURIComponent(password)}`;
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  try {
    const res = await httpRequest(url, {
      method: 'GET',
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
    });
    if (res.ok) {
      return { ok: true, details: { status: res.status, url } };
    }
    return {
      ok: false,
      error: `HTTP ${res.status}`,
      details: { status: res.status, body: summariseBody(res.bodyText), url },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
};

/**
 * Generic OAuth2 — POST to the introspection endpoint stored on the
 * credential (or `tokenUrl` + `/introspect` fallback).  Treats an `active:
 * true` payload as success; otherwise surfaces the error.
 */
const testOAuth2: CredentialTestOp = async (cred) => {
  const {
    accessToken,
    clientId,
    clientSecret,
    introspectUrl,
    tokenUrl,
  } = cred.data;
  if (!accessToken) {
    return { ok: false, error: 'Missing accessToken' };
  }
  const endpoint =
    introspectUrl?.trim() ||
    (tokenUrl ? tokenUrl.replace(/\/token\/?$/, '/introspect') : '');
  if (!endpoint) {
    return { ok: false, error: 'No introspection endpoint configured' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (clientId && clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  }

  try {
    const res = await httpRequest(endpoint, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ token: accessToken }).toString(),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Introspection HTTP ${res.status}`,
        details: { status: res.status, body: summariseBody(res.bodyText) },
      };
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(res.bodyText) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        error: 'Introspection response was not JSON',
        details: { body: summariseBody(res.bodyText) },
      };
    }
    if (payload.active === true) {
      return { ok: true, details: payload };
    }
    return {
      ok: false,
      error: 'Token reported inactive',
      details: payload,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
};

/**
 * Google Sheets (and other Google services that ship with refreshToken +
 * clientId/secret).  Calls `drive.about` — a lightweight authenticated GET
 * that succeeds on any valid Drive scope.  Refreshes the access token via
 * the standard Google token endpoint first.
 */
const testGoogleSheets: CredentialTestOp = async (cred) => {
  const { clientId, clientSecret, refreshToken } = cred.data;
  if (!clientId || !clientSecret || !refreshToken) {
    return {
      ok: false,
      error: 'Missing clientId, clientSecret, or refreshToken',
    };
  }

  let accessToken = cred.data.accessToken;
  try {
    const tokenRes = await httpRequest('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!tokenRes.ok) {
      return {
        ok: false,
        error: `Google token refresh HTTP ${tokenRes.status}`,
        details: { body: summariseBody(tokenRes.bodyText) },
      };
    }
    const tok = JSON.parse(tokenRes.bodyText) as { access_token?: string };
    if (!tok.access_token) {
      return { ok: false, error: 'Google token endpoint returned no access_token' };
    }
    accessToken = tok.access_token;
  } catch (err) {
    return { ok: false, error: `Token refresh failed: ${(err as Error).message}` };
  }

  try {
    const res = await httpRequest(
      'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        error: `drive.about HTTP ${res.status}`,
        details: { status: res.status, body: summariseBody(res.bodyText) },
      };
    }
    const payload = JSON.parse(res.bodyText) as {
      user?: { emailAddress?: string; displayName?: string };
    };
    return {
      ok: true,
      details: {
        email: payload.user?.emailAddress,
        displayName: payload.user?.displayName,
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
};

/* ── Register built-ins ─────────────────────────────────────────────────── */

registerCredentialTestOp('http_basic_auth', testHttpBasicAuth);
registerCredentialTestOp('oauth2', testOAuth2);
registerCredentialTestOp('google_sheets', testGoogleSheets);

/* ── Public entry point ─────────────────────────────────────────────────── */

export interface TestCredentialOptions {
  /** Override the registry lookup for one call (mainly for tests). */
  op?: CredentialTestOp;
}

/**
 * Resolve a credential, run its registered test op, and return the
 * structured result.  Ownership is enforced — the credential must belong
 * to `workspaceId`.  The `requesterId` is currently used only for the
 * audit trail recorded by the route handler.
 *
 * NEVER throws — all error cases are returned as `{ ok: false, error }`.
 */
export async function testCredential(
  credentialId: string,
  requesterId: string,
  workspaceId: string,
  options: TestCredentialOptions = {},
): Promise<CredentialTestResult> {
  if (!credentialId) return { ok: false, error: 'credentialId is required' };
  if (!requesterId) return { ok: false, error: 'requesterId is required' };
  if (!workspaceId) return { ok: false, error: 'workspaceId is required' };

  let credential: Credential | null;
  try {
    credential = await getCredentialById(credentialId);
  } catch (err) {
    return {
      ok: false,
      error: `Failed to load credential: ${(err as Error).message}`,
    };
  }
  if (!credential) {
    return { ok: false, error: 'Credential not found' };
  }
  if (credential.workspaceId !== workspaceId) {
    return { ok: false, error: 'Forbidden' };
  }

  const op = options.op ?? registry.get(credential.type);
  if (!op) {
    return {
      ok: false,
      error: `No test operation registered for credential type "${credential.type}"`,
    };
  }

  try {
    const result = await op(credential);
    return result;
  } catch (err) {
    return {
      ok: false,
      error: `Test op threw: ${(err as Error).message}`,
    };
  }
}
