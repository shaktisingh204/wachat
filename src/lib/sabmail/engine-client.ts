import 'server-only';

/**
 * SabMail engine HTTP client.
 *
 * Thin wrapper around `fetch()` for the (future) Rust SabMail engine
 * (`services/sabmail-engine/`) that will own the long-lived sync workers
 * (IMAP IDLE listeners, Gmail watch / Graph delta) + the throttled send
 * pipeline. Mirrors `src/lib/sabsms/engine-client.ts`.
 *
 *   - `SABMAIL_ENGINE_URL`   base URL (default `http://localhost:4003`)
 *   - `SABMAIL_ENGINE_TOKEN` service token, sent in the
 *                            `X-Sabmail-Service-Token` header.
 *   - `SABMAIL_ENABLED`      feature flag; when false the engine calls
 *                            short-circuit so the module degrades gracefully
 *                            (Phase 0 connects mailboxes directly via
 *                            imapflow/nodemailer — the engine is not yet
 *                            required).
 */

const DEFAULT_ENGINE_URL = 'http://localhost:4003';

export function getSabmailEngineBaseUrl(): string {
  return (process.env.SABMAIL_ENGINE_URL ?? DEFAULT_ENGINE_URL).replace(/\/+$/, '');
}

function getEngineToken(): string {
  return process.env.SABMAIL_ENGINE_TOKEN ?? '';
}

export function isSabmailEngineEnabled(): boolean {
  return (process.env.SABMAIL_ENABLED ?? 'false').toLowerCase() === 'true';
}

export class SabmailEngineError extends Error {
  public readonly status: number;
  public readonly path: string;
  public readonly body: unknown;

  constructor(message: string, status: number, path: string, body: unknown) {
    super(message);
    this.name = 'SabmailEngineError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export interface EngineFetchInit extends Omit<RequestInit, 'body' | 'headers'> {
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

async function engineFetch<T = unknown>(
  path: string,
  init: EngineFetchInit = {},
): Promise<T> {
  if (!isSabmailEngineEnabled()) {
    throw new SabmailEngineError(
      'SabMail engine is disabled (SABMAIL_ENABLED=false)',
      503,
      path,
      null,
    );
  }

  const url = `${getSabmailEngineBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Sabmail-Service-Token': getEngineToken(),
    ...(init.headers ?? {}),
  };

  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 15_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      body,
      signal: init.signal ?? controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SabmailEngineError(
        `SabMail engine request timed out after ${timeoutMs}ms`,
        0,
        path,
        null,
      );
    }
    throw new SabmailEngineError(
      err instanceof Error ? err.message : 'SabMail engine fetch failed',
      0,
      path,
      null,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    let message = `SabMail engine ${res.status} ${res.statusText}`;
    if (
      isJson &&
      payload &&
      typeof payload === 'object' &&
      'error' in (payload as Record<string, unknown>) &&
      typeof (payload as { error: unknown }).error === 'string'
    ) {
      message = (payload as { error: string }).error;
    }
    throw new SabmailEngineError(message, res.status, path, payload);
  }

  return payload as T;
}

/**
 * Public engine surface. Phase 0 only needs `health` + cache-invalidation
 * hooks (no-ops when the engine is disabled); sync/send methods are added as
 * Phase 1+ wire the Rust engine.
 */
export const sabmailEngine = {
  async health(): Promise<{ ok: boolean; version?: string }> {
    return engineFetch<{ ok: boolean; version?: string }>('/health');
  },

  /**
   * Tell the engine to drop cached decrypted credentials for a workspace
   * (called after account changes). Tolerates an unreachable/disabled engine
   * silently — the cache simply expires.
   */
  async invalidateCreds(workspaceId: string): Promise<boolean> {
    if (!isSabmailEngineEnabled()) return false;
    try {
      await engineFetch('/v1/internal/creds/invalidate', {
        method: 'POST',
        json: { workspaceId },
        timeoutMs: 5_000,
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Ask the engine to (re)start syncing a connected account. No-op when the
   * engine is disabled — Phase 1 wires the real sync worker.
   */
  async requestSync(input: { workspaceId: string; accountId: string }): Promise<boolean> {
    if (!isSabmailEngineEnabled()) return false;
    try {
      await engineFetch('/v1/accounts/sync', {
        method: 'POST',
        json: input,
        timeoutMs: 5_000,
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Send a message through the engine's SMTP transport (lettre). Returns the
   * generated Message-ID. Throws {@link SabmailEngineError} when the engine is
   * disabled or the send fails — callers decide whether to fall back to the
   * in-process nodemailer path.
   */
  async send(input: {
    workspaceId: string;
    accountId: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ ok: boolean; messageId: string }> {
    return engineFetch<{ ok: boolean; messageId: string }>('/v1/send', {
      method: 'POST',
      json: input,
      timeoutMs: 30_000,
    });
  },

  /**
   * Advance all due journey runs one tick. The engine's own ticker normally
   * drives this; the cron route can call it as a safety net.
   */
  async tickJourneys(): Promise<{
    processed: number;
    sent: number;
    completed: number;
    failed: number;
  }> {
    return engineFetch('/v1/journeys/tick', { method: 'POST', timeoutMs: 60_000 });
  },

  /**
   * Bind an inbound message into the collaboration/automation layers
   * (conversation upsert + screener + rule evaluation) on the engine. Returns
   * the screener decision and any matched rule actions. Throws when the engine
   * is disabled — the caller should fall back to the in-process binder.
   */
  async processInbound(input: {
    workspaceId: string;
    from: string;
    fromName?: string;
    subject?: string;
    messageId?: string;
  }): Promise<{
    screenerDecision: string;
    ruleActions: Array<{ action: string; label?: string }>;
    bound: boolean;
  }> {
    return engineFetch('/v1/inbound', {
      method: 'POST',
      json: input,
      timeoutMs: 10_000,
    });
  },
};

export type SabmailEngine = typeof sabmailEngine;
