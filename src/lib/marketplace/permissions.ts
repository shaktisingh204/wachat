/**
 * Marketplace scope catalogue + scope gating.
 *
 * Apps declare scopes in their manifest. Tenants grant a subset at install
 * time. At call time, host APIs use {@link gates} to verify the install holds
 * a scope sufficient for the requested operation.
 *
 * Scopes use a `resource:action` shape, with `*` as the wildcard for either
 * side (e.g. `crm:*` grants every crm action; `*:read` grants read on every
 * resource). Scope grants are also satisfied by exact match.
 */

import 'server-only';

/** Catalogue of every scope an app may request. Add new scopes here. */
export const KNOWN_SCOPES = [
  // CRM
  'crm:read',
  'crm:write',
  'crm:delete',
  // SabFlow
  'sabflow:read',
  'sabflow:write',
  'sabflow:execute',
  // Wachat / messaging
  'wachat:read',
  'wachat:send',
  'wachat:templates',
  // Contacts
  'contacts:read',
  'contacts:write',
  // Billing
  'billing:read',
  'billing:write',
  // SEO
  'seo:read',
  'seo:write',
  // Analytics
  'analytics:read',
  // Webhooks
  'webhooks:manage',
  // Profile + identity
  'profile:read',
  'profile:write',
  // Wildcards
  '*',
  '*:read',
  '*:write',
] as const;

export type KnownScope = (typeof KNOWN_SCOPES)[number] | string;

const KNOWN_SET = new Set<string>(KNOWN_SCOPES);

/** Returns true when `scope` is part of the published catalogue. */
export function isKnownScope(scope: string): boolean {
  if (KNOWN_SET.has(scope)) return true;
  // Allow `<resource>:*` shaped scopes for any catalogued resource.
  const m = /^([a-z][a-z0-9_-]*):\*$/.exec(scope);
  if (m) {
    const prefix = `${m[1]}:`;
    for (const s of KNOWN_SCOPES) {
      if (s.startsWith(prefix)) return true;
    }
  }
  return false;
}

/**
 * Returns true when the `granted` scope is sufficient for the `requested`
 * scope (taking wildcards into account).
 */
function scopeSatisfies(granted: string, requested: string): boolean {
  if (granted === requested) return true;
  if (granted === '*') return true;

  const [gRes, gAct] = granted.split(':');
  const [rRes, rAct] = requested.split(':');

  if (gRes === '*' && gAct === rAct) return true; // *:read satisfies foo:read
  if (gAct === '*' && gRes === rRes) return true; // foo:* satisfies foo:read
  return false;
}

export interface ScopeGateResult {
  /** True when every requested scope is covered by the granted set. */
  ok: boolean;
  /** Scopes that were not satisfied. */
  missing: string[];
}

/**
 * Evaluate whether a granted scope set covers a single requested scope or a
 * list of scopes. Designed so route handlers can short-circuit on `ok`.
 */
export function gates(granted: string[], requested: string | string[]): ScopeGateResult {
  const reqList = Array.isArray(requested) ? requested : [requested];
  const missing: string[] = [];
  for (const r of reqList) {
    const ok = granted.some((g) => scopeSatisfies(g, r));
    if (!ok) missing.push(r);
  }
  return { ok: missing.length === 0, missing };
}
