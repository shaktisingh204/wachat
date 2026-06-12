import 'server-only';

import type {
  EnqueueSendInput,
  EnqueueSendResult,
  SabsmsMessage,
  SabsmsMessageStatus,
} from './types';

/**
 * SabSMS engine HTTP client.
 *
 * Thin wrapper around `fetch()` for talking to the Rust SabSMS engine
 * (`services/sabsms-engine/`) over HTTP. Mirrors the SabWa engine-client
 * pattern at `src/lib/sabwa/engine-client.ts`.
 *
 *   - `SABSMS_ENGINE_URL`   base URL (default `http://localhost:4002`)
 *   - `SABSMS_ENGINE_TOKEN` service token, sent in the
 *                           `X-Sabsms-Service-Token` header.
 */

const DEFAULT_ENGINE_URL = 'http://localhost:4002';

function getEngineBaseUrl(): string {
  return (process.env.SABSMS_ENGINE_URL ?? DEFAULT_ENGINE_URL).replace(/\/+$/, '');
}

function getEngineToken(): string {
  return process.env.SABSMS_ENGINE_TOKEN ?? '';
}

function isEngineEnabled(): boolean {
  return (process.env.SABSMS_ENABLED ?? 'false').toLowerCase() === 'true';
}

export class SabsmsEngineError extends Error {
  public readonly status: number;
  public readonly path: string;
  public readonly body: unknown;

  constructor(message: string, status: number, path: string, body: unknown) {
    super(message);
    this.name = 'SabsmsEngineError';
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
  if (!isEngineEnabled()) {
    throw new SabsmsEngineError(
      'SabSMS engine is disabled (SABSMS_ENABLED=false)',
      503,
      path,
      null,
    );
  }

  const url = `${getEngineBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Sabsms-Service-Token': getEngineToken(),
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
      throw new SabsmsEngineError(
        `SabSMS engine request timed out after ${timeoutMs}ms`,
        0,
        path,
        null,
      );
    }
    throw new SabsmsEngineError(
      err instanceof Error ? err.message : 'SabSMS engine fetch failed',
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
    let message = `SabSMS engine ${res.status} ${res.statusText}`;
    if (
      isJson &&
      payload &&
      typeof payload === 'object' &&
      'error' in (payload as Record<string, unknown>) &&
      typeof (payload as { error: unknown }).error === 'string'
    ) {
      message = (payload as { error: string }).error;
    }
    throw new SabsmsEngineError(message, res.status, path, payload);
  }

  return payload as T;
}

/**
 * Public API surface for callers in Next.js.
 *
 * Every method is a thin pass-through to the engine, except for the
 * `enqueueSend` short-circuit: when the engine is disabled, it returns
 * a `suppressed` stub instead of throwing so CRM dispatches degrade
 * gracefully.
 */
export const sabsmsEngine = {
  async enqueueSend(input: EnqueueSendInput): Promise<EnqueueSendResult> {
    if (!isEngineEnabled()) {
      return { id: '', status: 'suppressed' satisfies SabsmsMessageStatus };
    }
    return engineFetch<EnqueueSendResult>('/v1/messages', {
      method: 'POST',
      json: input,
    });
  },

  async getMessage(id: string): Promise<SabsmsMessage | null> {
    try {
      return await engineFetch<SabsmsMessage>(`/v1/messages/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e instanceof SabsmsEngineError && e.status === 404) return null;
      throw e;
    }
  },

  async listMessages(params: {
    workspaceId: string;
    limit?: number;
    status?: SabsmsMessageStatus;
  }): Promise<SabsmsMessage[]> {
    const search = new URLSearchParams();
    search.set('workspaceId', params.workspaceId);
    if (params.limit) search.set('limit', String(params.limit));
    if (params.status) search.set('status', params.status);
    return engineFetch<SabsmsMessage[]>(`/v1/messages?${search.toString()}`);
  },

  async health(): Promise<{ ok: boolean; version?: string }> {
    return engineFetch<{ ok: boolean; version?: string }>('/health');
  },

  /**
   * Launch a campaign whose recipients were pre-rendered into
   * `sabsms_campaign_recipients` — flips `draft|scheduled → running`;
   * the engine's campaign ticker drives the throttled send from there.
   */
  async launchCampaign(
    campaignId: string,
  ): Promise<{ ok: boolean; recipients: number }> {
    return engineFetch<{ ok: boolean; recipients: number }>(
      `/v1/campaigns/${encodeURIComponent(campaignId)}/launch`,
      { method: 'POST' },
    );
  },

  /** Pause a running campaign (in-flight queue items still send). */
  async pauseCampaign(campaignId: string): Promise<{ ok: boolean }> {
    return engineFetch<{ ok: boolean }>(
      `/v1/campaigns/${encodeURIComponent(campaignId)}/pause`,
      { method: 'POST' },
    );
  },

  /** Resume a paused campaign. */
  async resumeCampaign(campaignId: string): Promise<{ ok: boolean }> {
    return engineFetch<{ ok: boolean }>(
      `/v1/campaigns/${encodeURIComponent(campaignId)}/resume`,
      { method: 'POST' },
    );
  },

  /**
   * Cancel a campaign — the engine also marks remaining
   * `pending|claimed` recipients as `cancelled`.
   */
  async cancelCampaign(
    campaignId: string,
  ): Promise<{ ok: boolean; cancelledRecipients?: number }> {
    return engineFetch<{ ok: boolean; cancelledRecipients?: number }>(
      `/v1/campaigns/${encodeURIComponent(campaignId)}/cancel`,
      { method: 'POST' },
    );
  },

  /**
   * Tell the engine to drop its cached decrypted credentials for a
   * workspace (called after provider accounts change). Tolerates an
   * unreachable/disabled engine silently — the cache simply expires.
   */
  async invalidateCreds(workspaceId: string): Promise<boolean> {
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
};

export type SabsmsEngine = typeof sabsmsEngine;
