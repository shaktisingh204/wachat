import 'server-only';

/**
 * SabAssist Access Tokens client.
 *
 * Two surfaces:
 *  * `sabassistAccessTokensApi` — authenticated technician calls against
 *    `/v1/sabassist/access-tokens` (issue / list / revoke).
 *  * `sabassistPublicApi` — UNAUTHENTICATED redeem against
 *    `/v1/sabassist/public/redeem`. The customer browser hits this.
 */
import { rustFetch, rustFetchPublic } from './fetcher';

export interface SabassistAccessTokenDoc {
  _id: string;
  userId?: string;
  sessionId: string;
  token: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  oneTimePin?: string;
  deviceFingerprint?: string;
  createdAt?: string;
}

export interface SabassistAccessTokenListParams {
  sessionId?: string;
  used?: boolean;
}

export interface SabassistIssueTokenInput {
  sessionId: string;
  /** TTL in seconds; default 900, max 86_400. */
  ttlSecs?: number;
  /** Generate a 6-digit PIN (attended mode). */
  requirePin?: boolean;
  /** Bind the token to a specific unattended device. */
  deviceFingerprint?: string;
}

export interface SabassistIssueTokenResponse {
  id: string;
  token: string;
  sessionId: string;
  expiresAt: string;
  oneTimePin?: string;
}

export interface SabassistRedeemTokenInput {
  token: string;
  pin?: string;
  deviceFingerprint?: string;
}

export interface SabassistRedeemTokenResponse {
  ok: boolean;
  sessionId: string;
  mode: 'attended' | 'unattended';
  userId: string;
}

function buildListQuery(p?: SabassistAccessTokenListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.sessionId) qs.set('sessionId', p.sessionId);
  if (p.used != null) qs.set('used', String(p.used));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabassistAccessTokensApi = {
  list: (params?: SabassistAccessTokenListParams) =>
    rustFetch<{ items: SabassistAccessTokenDoc[] }>(
      `/v1/sabassist/access-tokens${buildListQuery(params)}`,
    ),
  issue: (input: SabassistIssueTokenInput) =>
    rustFetch<SabassistIssueTokenResponse>('/v1/sabassist/access-tokens', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  revoke: (id: string) =>
    rustFetch<{ revoked: boolean }>(
      `/v1/sabassist/access-tokens/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};

/**
 * Public-facing API helpers — DO NOT issue JWTs. The fetcher helper
 * `rustFetchPublic` must skip the auth header. If the BFF has not been
 * wired with a public route yet, the server action falls back to direct
 * Mongo (see `redeemSabassistAccessToken`).
 */
export const sabassistPublicApi = {
  redeem: (input: SabassistRedeemTokenInput) =>
    rustFetchPublic<SabassistRedeemTokenResponse>(
      '/v1/sabassist/public/redeem',
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
