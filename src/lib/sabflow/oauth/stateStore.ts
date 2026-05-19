/**
 * Short-lived nonce store for OAuth `state` round-trips.
 *
 * The OAuth state nonce binds the authorise-request to the callback so an
 * attacker can't trick a logged-in user into associating *their* OAuth
 * tokens with the attacker's credential record (CSRF).  The nonce embeds
 * the originating userId + provider id + scopes so the callback handler
 * can resume safely.
 *
 * In-memory, 10-minute TTL.  Swap for Redis in multi-instance deployments.
 */

import { randomBytes } from 'crypto';

type StateEntry = {
  userId: string;
  providerId: string;
  /** Optional credential id when re-authorising an existing credential. */
  credentialId?: string;
  /** Scopes the user requested at the authorise step. */
  scopes?: string[];
  /** Label the user typed when minting a brand-new credential. */
  label?: string;
  /** Where to redirect after a successful exchange. */
  returnTo?: string;
  /** PKCE verifier — set after `buildAuthorizeUrl` for providers that use it. */
  codeVerifier?: string;
  /** Workspace subdomain (Zendesk, Freshdesk, Shopify shop, etc.). */
  subdomain?: string;
  /** SabFlow credential type the user picked, persisted across the dance. */
  credentialType?: string;
  expiresAt: number;
};

const STATES = new Map<string, StateEntry>();
const TTL_MS = 10 * 60 * 1000;

export function mintOAuthState(payload: Omit<StateEntry, 'expiresAt'>): string {
  // Garbage-collect expired entries opportunistically.
  const now = Date.now();
  for (const [k, v] of STATES) {
    if (v.expiresAt < now) STATES.delete(k);
  }
  const state = randomBytes(24).toString('base64url');
  STATES.set(state, { ...payload, expiresAt: now + TTL_MS });
  return state;
}

export function updateOAuthState(
  state: string,
  partial: Partial<Omit<StateEntry, 'expiresAt'>>,
): void {
  const entry = STATES.get(state);
  if (!entry) return;
  STATES.set(state, { ...entry, ...partial });
}

export function consumeOAuthState(state: string): StateEntry | null {
  const entry = STATES.get(state);
  if (!entry) return null;
  STATES.delete(state); // single-use
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}
