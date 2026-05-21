/**
 * QuickBooks Online — thin REST client.
 *
 * No SDK — just `fetch`. All API calls are tenant-scoped via the resolved
 * access token. On 401 we mark the connection as needing re-OAuth and
 * throw {@link QuickBooksAuthError} so callers can surface that to the UI.
 */
import 'server-only';

import { ObjectId } from 'mongodb';
import { getApiBase, getValidAccessToken } from './auth';
import { getSettings, upsertSettings } from './db';

export class QuickBooksAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuickBooksAuthError';
  }
}

export class QuickBooksApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string, message?: string) {
    super(message ?? `QuickBooks API ${status}: ${body.slice(0, 300)}`);
    this.name = 'QuickBooksApiError';
    this.status = status;
    this.body = body;
  }
}

interface CallArgs {
  userId: ObjectId;
  path: string; // e.g. `/customer`, `/invoice/123`
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Set `?minorversion=` and `?Accept=` query params. */
  query?: Record<string, string>;
}

/**
 * Make a single authenticated request to the QuickBooks Online API for
 * the given tenant. Handles token resolution and 401 → re-auth bookkeeping.
 */
export async function qboFetch<T>(args: CallArgs): Promise<T> {
  const setting = await getSettings(args.userId);
  if (!setting || !setting.connected || !setting.realmId) {
    throw new QuickBooksAuthError('QuickBooks is not connected for this tenant.');
  }
  const token = await getValidAccessToken(args.userId);
  if (!token) {
    throw new QuickBooksAuthError(
      'QuickBooks access token is unavailable — reconnect required.',
    );
  }

  const base = getApiBase(setting.environment);
  const url = new URL(
    `${base}/v3/company/${encodeURIComponent(setting.realmId)}${args.path}`,
  );
  // QBO requires a minorversion for stable API behavior. 70 is current as
  // of 2026 and supports all the fields we use.
  url.searchParams.set('minorversion', '70');
  for (const [k, v] of Object.entries(args.query ?? {})) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: args.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(args.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 401) {
    // Token is dead even after a refresh attempt — force re-OAuth.
    await upsertSettings(args.userId, { connected: false });
    throw new QuickBooksAuthError(
      'QuickBooks returned 401 — re-authentication required.',
    );
  }

  const text = await res.text();
  if (!res.ok) {
    throw new QuickBooksApiError(res.status, text);
  }
  if (text.length === 0) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new QuickBooksApiError(
      res.status,
      text,
      `QuickBooks returned non-JSON response: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
