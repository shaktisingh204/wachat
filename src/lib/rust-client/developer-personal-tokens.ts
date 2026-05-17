/**
 * Client for the Personal Access Token CRUD on the Rust BFF.
 *
 *   POST  /v1/personal-access-tokens                    → generatePat
 *   GET   /v1/personal-access-tokens                    → listPats
 *   PATCH /v1/personal-access-tokens/{tokenId}/revoke   → revokePat
 *
 * Mirrors `wachatApiKeysAdminApi` shape so the dashboard can reuse the
 * same UI shell. The key difference: PATs are bound to a user inside a
 * tenant — the Rust side stores both `tenantId` and `userId` and the
 * Next.js `verifyApiKey` path threads the userId into the auth context
 * so RBAC kicks in when a PAT is used.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/personal-access-tokens';

export interface PatGenerateBody {
  name: string;
  scopes?: string[];
  tier?: 'FREE' | 'PRO' | 'ENTERPRISE';
  /** Optional ISO-8601 expiry. */
  expiresAt?: string;
}

export interface PatGenerateResult {
  success: boolean;
  /** Plaintext token — `sab_pat_<32 chars>`. Only present on success. */
  token?: string;
  /** Hex `_id` of the new row. */
  tokenId?: string;
  error?: string;
}

export interface PatSummary {
  _id: string;
  name: string;
  userId: string;
  scopes: string[];
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  revoked: boolean;
  requestCount: number;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface PatRevokeResult {
  success: boolean;
  error?: string;
}

export const developerPersonalTokensApi = {
  /**
   * Create a new PAT bound to the authenticated user. The plaintext
   * `token` is the only chance to capture the secret.
   */
  generate: (body: PatGenerateBody) =>
    rustFetch<PatGenerateResult>(`${BASE}/`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** List PATs owned by the authenticated user (metadata only). */
  list: () => rustFetch<PatSummary[]>(`${BASE}/`),

  /** Soft-delete a PAT. Scoped to `(tenantId, userId)` of the caller. */
  revoke: (tokenId: string) =>
    rustFetch<PatRevokeResult>(
      `${BASE}/${encodeURIComponent(tokenId)}/revoke`,
      { method: 'PATCH' },
    ),
};

export type DeveloperPersonalTokensApi = typeof developerPersonalTokensApi;
