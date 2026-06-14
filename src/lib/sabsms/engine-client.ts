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
 * (`services/sabsms-engine/`) over HTTP. Follows the standard SabNode Rust
 * engine-client pattern.
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

/** Result of `POST /v1/otp/send` / `POST /v1/otp/resend`. */
export interface SabsmsOtpSendResult {
  otpId: string;
  /** Epoch seconds. */
  expiresAt: number;
  /** Epoch seconds — earliest allowed resend. */
  resendAfter: number;
  messageId?: string;
}

/** Result of `POST /v1/otp/verify`. */
export interface SabsmsOtpVerifyResult {
  verified: boolean;
  reason?: 'expired' | 'wrong_code' | 'max_attempts';
}

/** One per-(country, prefix) conversion row from `GET /v1/otp/stats`. */
export interface SabsmsOtpStatsRow {
  country: string;
  prefix: string;
  sent: number;
  converted: number;
  /** converted / sent in [0, 1]; 0 when sent == 0. */
  rate: number;
}

export interface SabsmsOtpStats {
  /** Engine fraud-guard mode (`SABSMS_FRAUD_MODE`). */
  fraudMode: 'enforce' | 'monitor' | 'off';
  /** Sliding-window width the rows cover, in seconds. */
  windowSecs: number;
  rows: SabsmsOtpStatsRow[];
}

/** Result of `POST /v1/lookup` (Twilio Lookup v2 / Telnyx pass-through). */
export interface SabsmsLookupResult {
  lineType?: string;
  carrierName?: string;
  mobileCountryCode?: string;
  /** Which provider answered ("twilio" | "telnyx" | "cache"). */
  source: string;
}

/** One check row from `POST /v1/dlt/scrub-preview` (V2.8). */
export interface SabsmsDltTraceEntry {
  /** `dlt_header_registered` | `dlt_header_bound` | `dlt_template_match`
   *  | `dlt_chain` | `dlt_category_content`. */
  check: string;
  verdict: 'allow' | 'block' | 'warn' | 'skipped';
  detail?: string;
}

/** Response of `POST /v1/dlt/scrub-preview` (V2.8). */
export interface SabsmsDltScrubPreview {
  trace: SabsmsDltTraceEntry[];
  /** True when `dltTemplateId` resolved in the workspace registry. */
  templateFound: boolean;
  /** Registered category of the resolved template (snake_case) or null. */
  templateCategory: string | null;
  /** True when the workspace has ANY DLT registry doc at all. */
  registryConfigured: boolean;
  /** Operator header suffix: "P" | "S" | "T" | "G" | null. */
  predictedSuffix: string | null;
  /** Content-classifier hint (advisory only). */
  predictedCategory: {
    category: 'promotional' | 'transactional' | 'service' | 'unknown';
    confidence: number;
  };
  wouldBlock: boolean;
  blockCheck: string | null;
}

/** One phone's entry from `POST /v1/rcs/capability` (V2.11). */
export interface SabsmsRcsCapabilityEntry {
  capable: boolean;
  /** "cache" | "provider" | "unknown" | "invalid". */
  source: string;
}

/** Response of `POST /v1/rcs/capability` (V2.11). */
export interface SabsmsRcsCapabilityResult {
  capabilities: Record<string, SabsmsRcsCapabilityEntry>;
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

  /**
   * Send an OTP (`POST /v1/otp/send`) — the engine runs the fraud
   * pre-check + rate limits, generates and stores the hashed code, and
   * enqueues the SMS through the normal worker pipeline (category
   * `otp`). 403 = fraud-blocked, 429 = rate-limited/cooldown.
   */
  async otpSend(input: {
    workspaceId: string;
    to: string;
    channel?: 'sms' | 'mms' | 'rcs';
  }): Promise<SabsmsOtpSendResult> {
    return engineFetch<SabsmsOtpSendResult>('/v1/otp/send', {
      method: 'POST',
      json: input,
    });
  },

  /**
   * Verify a code (`POST /v1/otp/verify`) — constant-time compare
   * engine-side; success deletes the code and records the conversion
   * the router ranks the `otp` category by.
   */
  async otpVerify(input: {
    workspaceId: string;
    to: string;
    code: string;
  }): Promise<SabsmsOtpVerifyResult> {
    return engineFetch<SabsmsOtpVerifyResult>('/v1/otp/verify', {
      method: 'POST',
      json: input,
    });
  },

  /**
   * Resend the SAME code (`POST /v1/otp/resend`) — engine enforces the
   * cooldown + max-resend budget. 429 = cooldown/max_resends.
   */
  async otpResend(input: {
    workspaceId: string;
    to: string;
  }): Promise<SabsmsOtpSendResult> {
    return engineFetch<SabsmsOtpSendResult>('/v1/otp/resend', {
      method: 'POST',
      json: input,
    });
  },

  /**
   * V2.11 — batch RCS capability check (`POST /v1/rcs/capability`,
   * ≤100 phones per call). Cached engine-side in the identity graph
   * (7-day freshness); Gupshup RBM answers cache misses, Twilio has no
   * public per-number lookup so unknowns come back `capable: false,
   * source: "unknown"`.
   */
  async rcsCapability(
    workspaceId: string,
    phones: string[],
  ): Promise<SabsmsRcsCapabilityResult> {
    return engineFetch<SabsmsRcsCapabilityResult>('/v1/rcs/capability', {
      method: 'POST',
      json: { workspaceId, phones },
      timeoutMs: 30_000,
    });
  },

  /**
   * Per-(country, prefix) OTP conversion window
   * (`GET /v1/otp/stats`) — feeds the /sabsms/otp analytics card.
   */
  async otpStats(workspaceId: string): Promise<SabsmsOtpStats> {
    const search = new URLSearchParams({ workspaceId });
    return engineFetch<SabsmsOtpStats>(`/v1/otp/stats?${search.toString()}`);
  },

  /**
   * Line-type lookup (`POST /v1/lookup`) — Twilio Lookup v2 / Telnyx
   * pass-through with a 24h engine-side cache. Requires a Twilio or
   * Telnyx provider account on the workspace.
   */
  async lookupNumber(input: {
    workspaceId: string;
    to: string;
  }): Promise<SabsmsLookupResult> {
    return engineFetch<SabsmsLookupResult>('/v1/lookup', {
      method: 'POST',
      json: input,
      timeoutMs: 30_000,
    });
  },

  /**
   * Live India-DLT scrub (`POST /v1/dlt/scrub-preview`) — "would this
   * body pass operator scrubbing?" without sending. Feeds the template
   * editor's DLT panel and the compliance hub's simulator.
   */
  async scrubPreview(input: {
    workspaceId: string;
    /** Final (rendered) message body. */
    body: string;
    /** Registered content-template id (TE_ID), when bound. */
    dltTemplateId?: string;
    /** Sender header the message would use. */
    header?: string;
  }): Promise<SabsmsDltScrubPreview> {
    return engineFetch<SabsmsDltScrubPreview>('/v1/dlt/scrub-preview', {
      method: 'POST',
      json: input,
    });
  },

  /**
   * Drop the engine's cached DLT registry for a workspace (called after
   * every `sabsms_dlt_*` write). Tolerates an unreachable/disabled
   * engine silently — the 60s cache simply expires.
   */
  async invalidateDlt(workspaceId: string): Promise<boolean> {
    try {
      await engineFetch('/v1/internal/dlt/invalidate', {
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
   * Drop the engine's cached OTP config for a workspace (called after
   * every `sabsms_otp_configs` save). Tolerates an unreachable/disabled
   * engine silently — the 60s cache simply expires.
   */
  async invalidateOtpConfig(workspaceId: string): Promise<boolean> {
    try {
      await engineFetch('/v1/internal/otp/configs/invalidate', {
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
