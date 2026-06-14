/**
 * SabCRM BCC-dropbox — PURE address derivation + parsing.
 *
 * A "dropbox" is a per-project inbound address (e.g.
 * `crm+<token>@<your-mail-domain>`) that reps BCC from any mail client so the
 * message auto-logs onto the matching CRM record, and that record-detail sends
 * self-log into by BCCing themselves.
 *
 * This module is intentionally I/O-FREE and side-effect-FREE: it only knows how
 * to BUILD a dropbox address from an opaque token + a domain, RECOGNISE a
 * dropbox address in a recipient list, and EXTRACT the token from one. The
 * token <-> project mapping is opaque here — minting and resolving the token
 * (the only secret-bearing steps) live server-side in `./email-dropbox.server.ts`.
 *
 * Token format is deliberately conservative so it survives every transport:
 * lowercase URL-safe base32-ish (hex + a-z digits), no `+`/`=`/`/` that a
 * `local+tag` plus-address scheme or a strict RFC-5321 validator would reject.
 *
 * No `'server-only'` guard: pure logic, unit-tested with `npx tsx --test`.
 */

/** The local-part prefix every dropbox address carries (`crm+<token>@…`). */
export const DROPBOX_LOCAL_PREFIX = 'crm';

/**
 * Allowed token charset — lowercase alphanumerics. Generated tokens use this;
 * the parser rejects anything outside it so a forged `crm+<garbage>@` can't
 * masquerade as a real dropbox (the server still re-checks against Mongo).
 */
const TOKEN_RE = /^[a-z0-9]{8,64}$/;

/** Strip surrounding angle brackets / display name from a raw header value. */
function bareAddress(raw: string): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  // "Name <addr@host>" -> addr@host
  const angled = s.match(/<([^>]+)>/);
  return (angled ? angled[1] : s).trim().toLowerCase();
}

/** Normalise a domain (lowercase, drop a leading `@`, trim). */
export function normaliseDomain(domain: string): string {
  return (domain ?? '').trim().toLowerCase().replace(/^@+/, '');
}

/** Normalise a token to its canonical form (lowercased + trimmed). */
export function normaliseToken(token: string): string {
  return (token ?? '').trim().toLowerCase();
}

/** True when a token matches the dropbox token charset/length contract. */
export function isValidDropboxToken(token: string): boolean {
  return TOKEN_RE.test(normaliseToken(token));
}

/**
 * Build the dropbox address for an opaque token + domain, or `''` when either
 * input is invalid (so callers can treat empty as "not configured").
 *
 *   buildDropboxAddress('ab12cd34', 'mail.acme.com')
 *     === 'crm+ab12cd34@mail.acme.com'
 */
export function buildDropboxAddress(token: string, domain: string): string {
  const t = normaliseToken(token);
  const d = normaliseDomain(domain);
  if (!isValidDropboxToken(t) || !d || !d.includes('.')) return '';
  return `${DROPBOX_LOCAL_PREFIX}+${t}@${d}`;
}

/**
 * Extract the token from a dropbox address, or `null` when the address is not a
 * well-formed `crm+<token>@<domain>` dropbox. Tolerant of display-name /
 * angle-bracket header forms and case. The domain is NOT validated here — token
 * resolution (server-side) is keyed on the token alone, so any tenant's
 * dropbox is recognised regardless of which mail domain it was minted on.
 *
 *   parseDropboxAddress('Sales CRM <CRM+AB12@mail.acme.com>') === 'ab12'   // (if token valid len)
 *   parseDropboxAddress('jane@acme.com') === null
 */
export function parseDropboxAddress(addr: string): string | null {
  const bare = bareAddress(addr);
  if (!bare || !bare.includes('@')) return null;
  const [local] = bare.split('@', 2);
  if (!local) return null;
  const plus = local.indexOf('+');
  if (plus < 0) return null;
  const prefix = local.slice(0, plus);
  if (prefix !== DROPBOX_LOCAL_PREFIX) return null;
  const token = local.slice(plus + 1);
  return isValidDropboxToken(token) ? normaliseToken(token) : null;
}

/** True when `addr` is any project's dropbox address (token shape valid). */
export function isDropboxAddress(addr: string): boolean {
  return parseDropboxAddress(addr) !== null;
}

/**
 * Find the FIRST dropbox token among a recipient list (to/cc/bcc combined),
 * or `null` when none is present. Used by the inbound bridge to detect mail
 * that was BCC'd to a dropbox. `domain` is accepted for symmetry / future
 * domain-scoping but is not required — token detection is domain-agnostic.
 */
export function matchesDropbox(addrs: string[], _domain?: string): string | null {
  for (const a of addrs ?? []) {
    const token = parseDropboxAddress(a);
    if (token) return token;
  }
  return null;
}
