/**
 * SabFlow — Custom domain types
 *
 * A `CustomDomain` represents a user-owned hostname (e.g. `chat.mysite.com`)
 * that routes to a SabFlow — optionally scoped to a specific flow.
 *
 * Verification is done via a DNS TXT record on `_sabflow.{domain}` containing
 * the `verificationToken`. Once verified, inbound requests whose `Host` header
 * matches the domain are rewritten to `/flow/{flowId}`.
 */

export type DomainStatus = 'pending' | 'verified' | 'failed';

export type SslStatus = 'pending' | 'issued' | 'failed';

export type CustomDomain = {
  /** Stable identifier (cuid2). */
  id: string;
  /** Owner workspace — maps to `userId` in the current auth model. */
  workspaceId: string;
  /** Optional scope: when set, requests to this domain serve the specified flow. */
  flowId?: string;
  /** Hostname, e.g. `chat.mysite.com` (lowercased, no protocol, no path). */
  domain: string;
  /** Verification state of the DNS TXT challenge. */
  status: DomainStatus;
  /** TXT record value the user must add on `_sabflow.{domain}`. */
  verificationToken: string;
  /** SSL certificate provisioning state. */
  sslStatus: SslStatus;
  /** When the record was created. */
  createdAt: Date;
  /** Last time verification was attempted. */
  lastCheckedAt?: Date;
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** Normalise user-supplied domain input. Returns `null` when invalid. */
export function normaliseDomain(input: string): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  // Strip protocol + trailing slashes/paths/ports.
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/\/.*$/, '');
  s = s.replace(/:\d+$/, '');
  // Basic FQDN validation: labels separated by dots, no leading/trailing dash.
  const fqdn = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  if (!fqdn.test(s)) return null;
  return s;
}
