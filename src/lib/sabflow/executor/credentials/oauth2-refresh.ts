/**
 * SabFlow Executor — OAuth2 token-refresh worker
 *
 * Proactively refreshes OAuth2 access tokens *before* they expire so node
 * executions never see a 401 from upstream APIs.  Three entry points:
 *
 *   1. `refreshIfExpired(credentialId, decrypted)`
 *      Synchronous-style helper invoked by the executor right before a node
 *      runs.  Returns a (possibly-rotated) DecryptedCredentialData with a
 *      guaranteed-fresh access token.  Concurrent callers for the same
 *      credential coalesce onto a single in-flight promise.
 *
 *   2. `startOAuth2RefreshWorker()`
 *      Long-lived background sweep — every 5 minutes it scans
 *      `sabflow_credentials` for OAuth2 rows whose `expiresAt` falls inside
 *      the next 15 minutes and refreshes them ahead of schedule.  Safe to
 *      call multiple times: subsequent calls are no-ops.
 *
 *   3. `runOAuth2RefreshSweep()` *(exported for the Vercel-Cron route)*
 *      A single tick of #2 that can be invoked from
 *      `/api/cron/sabflow-oauth2-refresh` (wired in Phase 6 #2). Vercel
 *      Functions are short-lived, so we don't rely on `setInterval` in
 *      production — the cron route is the source of truth.
 *
 * On any HTTP/credential failure the worker throws a {@link CredentialsError}
 * carrying code `REFRESH_FAILED` so the executor can mark the run retryable.
 *
 * Crypto note — the *sibling* crypto helpers (`./crypto`, forward-declared
 * here) are owned by another Phase-5 task and are imported lazily at call
 * time so this file compiles even if that module lands later.
 */

import 'server-only';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

/* ── Forward-declared sibling types ─────────────────────────────────────── */

/**
 * Plaintext credential payload handed to the executor.  Owned by the
 * Phase-5 credentials decryption module; we only assume the OAuth2 keys
 * documented below.  Extra string fields are preserved verbatim.
 */
export type DecryptedCredentialData = Record<string, string> & {
  /** OAuth2 access token currently in use. */
  accessToken?: string;
  /** Long-lived refresh token (may rotate on every refresh). */
  refreshToken?: string;
  /** Absolute expiry epoch-ms (string-encoded for parity with the DB shape). */
  expiresAt?: string;
  /** Refresh endpoint, e.g. `https://oauth2.googleapis.com/token`. */
  tokenUrl?: string;
  /** OAuth2 client id / secret used to sign the refresh request. */
  clientId?: string;
  clientSecret?: string;
  /** Optional space-separated scope echoed back from the IdP. */
  scope?: string;
  /** "Bearer" by default. */
  tokenType?: string;
};

/* ── Forward-declared sibling crypto module ─────────────────────────────── */
/*
 * The sibling `./crypto` module is owned by Phase-5 sub-task #4.  We import
 * lazily through `loadCrypto()` so the type-checker is happy whether the
 * module lands before or after us.  When absent we fall back to the existing
 * `@/lib/sabflow/credentials/encryption` helpers, which expose the same
 * `encryptRecord` / `decryptRecord` contract.
 */
type CryptoModule = {
  encryptRecord: (data: Record<string, string>) => Record<string, string>;
  decryptRecord: (data: Record<string, string>) => Record<string, string>;
};

async function loadCrypto(): Promise<CryptoModule> {
  // The sibling `./crypto` module may or may not exist yet — resolve through a
  // string variable so TypeScript doesn't require a static module declaration.
  const siblingId = './crypto';
  try {
    const mod = (await import(/* webpackIgnore: true */ siblingId)) as Partial<CryptoModule>;
    if (mod && typeof mod.encryptRecord === 'function' && typeof mod.decryptRecord === 'function') {
      return mod as CryptoModule;
    }
  } catch {
    // Sibling module not present yet — fall through to the existing helpers.
  }
  const fallback = await import('@/lib/sabflow/credentials/encryption');
  return {
    encryptRecord: fallback.encryptRecord,
    decryptRecord: fallback.decryptRecord,
  };
}

/* ── Credentials error (forward-decl from sibling errors module) ────────── */

export type CredentialsErrorCode =
  | 'REFRESH_FAILED'
  | 'MISSING_REFRESH_TOKEN'
  | 'MISSING_TOKEN_URL'
  | 'CREDENTIAL_NOT_FOUND';

/**
 * Thrown when the worker cannot mint a fresh access token.  `retryable` lets
 * the executor decide whether to re-queue the run (network blips → yes,
 * `invalid_grant` → no).
 */
export class CredentialsError extends Error {
  readonly code: CredentialsErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    code: CredentialsErrorCode,
    message: string,
    opts: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'CredentialsError';
    this.code = code;
    this.retryable = opts.retryable ?? true;
    this.cause = opts.cause;
  }
}

/* ── Constants ──────────────────────────────────────────────────────────── */

/** Refresh if the token expires within this window of "now". */
const EXPIRY_SAFETY_WINDOW_MS = 60_000; // 60s
/** Background sweep refreshes tokens expiring within this look-ahead. */
const SWEEP_LOOKAHEAD_MS = 15 * 60_000; // 15min
/** How often the in-process worker ticks. */
const SWEEP_INTERVAL_MS = 5 * 60_000; // 5min
/** Hard cap on how many rows a single sweep touches. */
const SWEEP_BATCH_LIMIT = 200;
/** Refresh request timeout. */
const REFRESH_TIMEOUT_MS = 15_000;

/* ── In-process coalescing map ──────────────────────────────────────────── */

const inFlight = new Map<string, Promise<DecryptedCredentialData>>();

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Return the decrypted credential with a guaranteed-fresh access token.
 *
 * Behaviour:
 *   • If `expiresAt` is missing OR > `now + 60s`, returns `decrypted` as-is.
 *   • Otherwise refreshes against `decrypted.tokenUrl`, persists the new
 *     access/refresh/expiry triple back to Mongo (re-encrypted), and
 *     resolves with the patched payload.
 *
 * Concurrent calls for the same `credentialId` coalesce onto a single
 * in-flight promise so we never fire duplicate refreshes.
 */
export async function refreshIfExpired(
  credentialId: string,
  decrypted: DecryptedCredentialData,
): Promise<DecryptedCredentialData> {
  if (!credentialId) {
    throw new CredentialsError('CREDENTIAL_NOT_FOUND', 'credentialId is required', {
      retryable: false,
    });
  }

  if (!needsRefresh(decrypted)) return decrypted;

  const existing = inFlight.get(credentialId);
  if (existing) return existing;

  const promise = doRefresh(credentialId, decrypted).finally(() => {
    inFlight.delete(credentialId);
  });
  inFlight.set(credentialId, promise);
  return promise;
}

/**
 * Returns true when the token is expired or expires inside the 60s safety
 * window.  Exported for tests and the background sweep.
 */
export function needsRefresh(
  decrypted: DecryptedCredentialData,
  nowMs: number = Date.now(),
): boolean {
  const expiresAtRaw = decrypted.expiresAt;
  if (!expiresAtRaw) return false; // No expiry recorded → trust caller.
  const expiresAtMs = parseExpiry(expiresAtRaw);
  if (expiresAtMs === null) return false;
  return nowMs + EXPIRY_SAFETY_WINDOW_MS >= expiresAtMs;
}

/* ── Background sweep ───────────────────────────────────────────────────── */

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let sweepRunning = false;

/**
 * Start the in-process background refresh worker.  No-op on Vercel
 * production (Functions are short-lived), where the Vercel-Cron route
 * `/api/cron/sabflow-oauth2-refresh` calls {@link runOAuth2RefreshSweep}
 * instead — see Phase 6 #2.
 *
 * Safe to call multiple times.
 */
export function startOAuth2RefreshWorker(): void {
  if (sweepTimer !== null) return;
  if (process.env.VERCEL === '1') {
    // Long-lived intervals don't survive in serverless. Rely on Vercel Cron.
    return;
  }

  // Kick once on boot so any tokens already inside the window get refreshed,
  // then fall into the periodic cadence.
  void safeSweep();
  sweepTimer = setInterval(() => {
    void safeSweep();
  }, SWEEP_INTERVAL_MS);
  // `unref()` so this timer doesn't keep the Node process alive on its own.
  if (typeof (sweepTimer as unknown as { unref?: () => void }).unref === 'function') {
    (sweepTimer as unknown as { unref: () => void }).unref();
  }
}

/** Stop the in-process worker (mostly for tests). */
export function stopOAuth2RefreshWorker(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

/**
 * One sweep pass.  Exposed so the Vercel-Cron route can drive it directly.
 *
 * @returns counts of inspected / refreshed / failed credentials.
 */
export async function runOAuth2RefreshSweep(): Promise<{
  inspected: number;
  refreshed: number;
  failed: number;
  durationMs: number;
}> {
  const startedAt = Date.now();
  if (sweepRunning) {
    // Reentrancy guard — a previous tick is still running, skip this one.
    return { inspected: 0, refreshed: 0, failed: 0, durationMs: 0 };
  }
  sweepRunning = true;

  let inspected = 0;
  let refreshed = 0;
  let failed = 0;

  try {
    const { db } = await connectToDatabase();
    const col = db.collection<{
      _id: ObjectId;
      data: Record<string, string>;
      type?: string;
      expiresAtMs?: number;
    }>('sabflow_credentials');

    // Heuristic: rows where the *plaintext* sentinel field `expiresAtMs` was
    // mirrored onto the doc during the most recent refresh.  Avoids
    // decrypting every credential on disk just to read an expiry.
    const cursor = col
      .find({
        type: { $in: ['oauth2', 'google_sheets', 'google_drive', 'google_analytics',
          'google_bigquery', 'google_chat', 'google_cloud_storage', 'google_firestore',
          'microsoft_excel', 'microsoft_onedrive', 'microsoft_outlook',
          'microsoft_sharepoint', 'microsoft_todo', 'zoho_crm', 'keap'] },
        expiresAtMs: { $lt: Date.now() + SWEEP_LOOKAHEAD_MS },
      })
      .limit(SWEEP_BATCH_LIMIT);

    const crypto = await loadCrypto();
    for await (const doc of cursor) {
      inspected += 1;
      try {
        const decrypted = crypto.decryptRecord(doc.data ?? {}) as DecryptedCredentialData;
        if (!needsRefresh(decrypted, Date.now() + SWEEP_LOOKAHEAD_MS)) continue;
        await refreshIfExpired(doc._id.toHexString(), decrypted);
        refreshed += 1;
      } catch (err) {
        failed += 1;
        console.warn(
          `[sabflow/oauth2-refresh] sweep failed credentialId=${doc._id.toHexString()}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } finally {
    sweepRunning = false;
  }

  return {
    inspected,
    refreshed,
    failed,
    durationMs: Date.now() - startedAt,
  };
}

/* ── Internal helpers ───────────────────────────────────────────────────── */

async function safeSweep(): Promise<void> {
  try {
    const r = await runOAuth2RefreshSweep();
    if (r.inspected > 0) {
      console.log(
        `[sabflow/oauth2-refresh] sweep inspected=${r.inspected} refreshed=${r.refreshed} failed=${r.failed} durationMs=${r.durationMs}`,
      );
    }
  } catch (err) {
    console.error('[sabflow/oauth2-refresh] sweep error:', err);
  }
}

async function doRefresh(
  credentialId: string,
  decrypted: DecryptedCredentialData,
): Promise<DecryptedCredentialData> {
  const tokenUrl = decrypted.tokenUrl;
  if (!tokenUrl) {
    throw new CredentialsError(
      'MISSING_TOKEN_URL',
      `OAuth2 refresh requires tokenUrl on credential ${credentialId}`,
      { retryable: false },
    );
  }
  const refreshToken = decrypted.refreshToken;
  if (!refreshToken) {
    throw new CredentialsError(
      'MISSING_REFRESH_TOKEN',
      `OAuth2 refresh requires refreshToken on credential ${credentialId}`,
      { retryable: false },
    );
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);
  if (decrypted.clientId) body.set('client_id', decrypted.clientId);
  if (decrypted.clientSecret) body.set('client_secret', decrypted.clientSecret);
  if (decrypted.scope) body.set('scope', decrypted.scope);

  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json',
  };

  // Many IdPs (Google, Microsoft, etc.) also accept client credentials via
  // HTTP Basic — include it as a belt-and-braces fallback.
  if (decrypted.clientId && decrypted.clientSecret) {
    const basic = Buffer.from(
      `${decrypted.clientId}:${decrypted.clientSecret}`,
      'utf8',
    ).toString('base64');
    headers.authorization = `Basic ${basic}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (err) {
    throw new CredentialsError(
      'REFRESH_FAILED',
      `OAuth2 refresh network error for credential ${credentialId}`,
      { retryable: true, cause: err },
    );
  } finally {
    clearTimeout(timer);
  }

  const responseText = await res.text();
  if (!res.ok) {
    // Distinguish definitively-bad tokens from transient errors.  `invalid_grant`
    // means the refresh token itself is revoked — non-retryable.
    const lower = responseText.toLowerCase();
    const isInvalidGrant = lower.includes('invalid_grant');
    throw new CredentialsError(
      'REFRESH_FAILED',
      `OAuth2 refresh failed (${res.status}) for credential ${credentialId}: ${truncate(responseText, 400)}`,
      { retryable: !isInvalidGrant },
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(responseText) as Record<string, unknown>;
  } catch (err) {
    throw new CredentialsError(
      'REFRESH_FAILED',
      `OAuth2 refresh returned non-JSON for credential ${credentialId}`,
      { retryable: true, cause: err },
    );
  }

  const accessToken = strField(parsed, 'access_token');
  if (!accessToken) {
    throw new CredentialsError(
      'REFRESH_FAILED',
      `OAuth2 refresh response missing access_token for credential ${credentialId}`,
      { retryable: false },
    );
  }

  const expiresInSec = numField(parsed, 'expires_in');
  const newExpiresAtMs =
    expiresInSec !== null
      ? Date.now() + Math.max(0, expiresInSec) * 1000
      : null;

  const rotatedRefreshToken = strField(parsed, 'refresh_token') ?? refreshToken;
  const newScope = strField(parsed, 'scope') ?? decrypted.scope ?? '';
  const newTokenType = strField(parsed, 'token_type') ?? decrypted.tokenType ?? 'Bearer';

  // Build the next plaintext payload — preserve any extra keys (clientId,
  // clientSecret, tokenUrl, etc.) the caller set on `decrypted`.
  const next: DecryptedCredentialData = {
    ...decrypted,
    accessToken,
    refreshToken: rotatedRefreshToken,
    scope: newScope,
    tokenType: newTokenType,
  };
  if (newExpiresAtMs !== null) next.expiresAt = String(newExpiresAtMs);

  await persistRefreshed(credentialId, next, newExpiresAtMs);

  return next;
}

async function persistRefreshed(
  credentialId: string,
  next: DecryptedCredentialData,
  expiresAtMs: number | null,
): Promise<void> {
  if (!ObjectId.isValid(credentialId)) return;
  const { db } = await connectToDatabase();
  const col = db.collection('sabflow_credentials');
  const crypto = await loadCrypto();

  // Re-encrypt the full plaintext payload so the at-rest invariant holds.
  const encrypted = crypto.encryptRecord(
    Object.fromEntries(
      Object.entries(next).map(([k, v]) => [k, v ?? '']),
    ) as Record<string, string>,
  );

  // Mirror the plaintext expiry onto the doc as a *plaintext* sentinel so the
  // sweep can filter by it without decrypting every row.  Safe to expose: the
  // expiry instant is not a secret.
  const setPatch: Record<string, unknown> = {
    data: encrypted,
    updatedAt: new Date(),
  };
  if (expiresAtMs !== null) {
    setPatch.expiresAtMs = expiresAtMs;
  }

  await col.updateOne({ _id: new ObjectId(credentialId) }, { $set: setPatch });
}

/* ── Tiny utilities ─────────────────────────────────────────────────────── */

function parseExpiry(raw: string): number | null {
  // Accept both epoch-ms strings ("1730000000000") and ISO timestamps.
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 0) return asNum;
  const asDate = Date.parse(raw);
  return Number.isFinite(asDate) ? asDate : null;
}

function strField(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function numField(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
