import 'server-only';

import type {
  EnqueueSendInput,
  EnqueueSendResult,
  SabsmsAvailableNumber,
  SabsmsMessage,
  SabsmsMessageStatus,
  SabsmsProviderId,
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

/** One destination-country row from `GET /v1/health/providers`. */
export interface SabsmsProviderHealthCountry {
  country: string;
  sent: number;
  delivered: number;
  failed: number;
  /** Laplace-smoothed delivery score in [0, 1]; 1.0 = neutral/no data. */
  score: number;
  lastDlrMs: number | null;
  circuit: 'closed' | 'open' | 'half_open';
}

/** Per-account health from `GET /v1/health/providers`. */
export interface SabsmsProviderHealthAccount {
  accountId: string;
  provider: string;
  isDefault: boolean;
  status: string;
  byCountry: SabsmsProviderHealthCountry[];
}

/** One ordered candidate from `POST /v1/internal/routing/preview`. */
export interface SabsmsRoutePreviewCandidate {
  providerAccountId: string | null;
  provider: string;
  fromOverride: string | null;
  source: 'sticky' | 'rule' | 'fallback';
  ruleId: string | null;
  score: number | null;
  circuit: 'closed' | 'open' | 'half_open';
}

export interface SabsmsRoutePreview {
  country: string;
  candidates: SabsmsRoutePreviewCandidate[];
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
   * Live-test a stored provider account's credentials against the
   * provider API (`POST /v1/internal/providers/test`).
   */
  async testProviderConnection(input: {
    workspaceId: string;
    accountId: string;
  }): Promise<{ ok: boolean; provider?: string; detail?: string; error?: string }> {
    return engineFetch<{ ok: boolean; provider?: string; detail?: string; error?: string }>(
      '/v1/internal/providers/test',
      { method: 'POST', json: input },
    );
  },

  /**
   * Search purchasable inventory (`POST /v1/numbers/search`) — Twilio /
   * Telnyx only; msg91/gupshup return a 400 (sender IDs are registered
   * manually for those providers).
   */
  async searchNumbers(input: {
    workspaceId: string;
    provider: SabsmsProviderId;
    country: string;
    capabilities?: string[];
  }): Promise<{ numbers: SabsmsAvailableNumber[] }> {
    return engineFetch<{ numbers: SabsmsAvailableNumber[] }>('/v1/numbers/search', {
      method: 'POST',
      json: input,
      timeoutMs: 30_000,
    });
  },

  /**
   * Buy a number through the provider (`POST /v1/numbers/provision`).
   * The engine inserts the `sabsms_numbers` doc itself — callers must
   * NOT insert again Next-side.
   */
  async provisionNumber(input: {
    workspaceId: string;
    provider: SabsmsProviderId;
    phoneNumber: string;
    providerAccountId?: string;
  }): Promise<{
    ok: boolean;
    numberId: string;
    e164: string;
    providerNumberId?: string | null;
    capabilities: { sms: boolean; mms: boolean; rcs: boolean; voice: boolean };
  }> {
    return engineFetch<{
      ok: boolean;
      numberId: string;
      e164: string;
      providerNumberId?: string | null;
      capabilities: { sms: boolean; mms: boolean; rcs: boolean; voice: boolean };
    }>('/v1/numbers/provision', {
      method: 'POST',
      json: input,
      timeoutMs: 30_000,
    });
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

  /**
   * Per-account rolling delivery health + circuit state
   * (`GET /v1/health/providers`) — feeds the /sabsms/health page and
   * the live badges on the routing rule builder.
   */
  async getProviderHealth(
    workspaceId: string,
  ): Promise<{ accounts: SabsmsProviderHealthAccount[] }> {
    const search = new URLSearchParams({ workspaceId });
    return engineFetch<{ accounts: SabsmsProviderHealthAccount[] }>(
      `/v1/health/providers?${search.toString()}`,
    );
  },

  /**
   * Drop the engine's cached routing policy for a workspace (called
   * after every policy save). Tolerates an unreachable/disabled engine
   * silently — the 60s cache simply expires.
   */
  async invalidateRouting(workspaceId: string): Promise<boolean> {
    try {
      await engineFetch('/v1/internal/routing/invalidate', {
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
   * Dry-run the router (`POST /v1/internal/routing/preview`): "where
   * would this message route?" Returns the ordered candidates with
   * health scores + circuit states; nothing is sent.
   */
  async previewRoute(input: {
    workspaceId: string;
    to: string;
    category?: string;
    channel?: string;
  }): Promise<SabsmsRoutePreview> {
    return engineFetch<SabsmsRoutePreview>('/v1/internal/routing/preview', {
      method: 'POST',
      json: input,
    });
  },
};

export type SabsmsEngine = typeof sabsmsEngine;
