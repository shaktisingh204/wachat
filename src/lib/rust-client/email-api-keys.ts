/**
 * Email Suite — API Keys Rust client.
 *
 * Thin typed wrappers around `/v1/email/api-keys/*` exposed by the
 * `email-api` Rust crate. Raw API key material is only returned on
 * create — every other call yields a `prefix` only.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type EmailApiKeyScope =
  | 'send'
  | 'campaigns:read'
  | 'campaigns:write'
  | 'audience:read'
  | 'audience:write'
  | 'reports:read'
  | 'webhooks:read'
  | 'webhooks:write'
  | string;

export interface EmailApiKeyDoc {
  _id: string;
  userId: string;
  name: string;
  prefix: string;
  scopes: EmailApiKeyScope[];
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface EmailApiKeyCreateResult {
  key: EmailApiKeyDoc;
  /** Raw secret — shown ONCE, never persisted server-side. */
  rawKey: string;
}

export function listEmailApiKeys() {
  return rustFetch<{ items: EmailApiKeyDoc[] }>('/v1/email/api-keys');
}

export function createEmailApiKey(body: { name: string; scopes: EmailApiKeyScope[] }) {
  return rustFetch<EmailApiKeyCreateResult>('/v1/email/api-keys', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateEmailApiKey(
  id: string,
  body: { name?: string; scopes?: EmailApiKeyScope[] },
) {
  return rustFetch<EmailApiKeyDoc>(`/v1/email/api-keys/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function revokeEmailApiKey(id: string) {
  return rustFetch<void>(`/v1/email/api-keys/${id}`, { method: 'DELETE' });
}
