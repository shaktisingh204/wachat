/**
 * SabFlow — Domain verification
 *
 * Verifies that the user has added the expected TXT record on
 * `_sabflow.{domain}` by querying Cloudflare's DNS-over-HTTPS resolver.
 *
 * The verification token is compared case-insensitively after stripping the
 * surrounding quotes that DoH responses include on string records.
 */

import 'server-only';

import { normaliseDomain } from './types';

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';

/** Single answer record returned by Cloudflare DoH. */
interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

/** Subset of the Cloudflare DoH JSON response we care about. */
interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

/** Outcome of a verification attempt. */
export interface VerifyDomainResult {
  /** True when a matching TXT record was found. */
  verified: boolean;
  /** Human-readable reason, populated when `verified === false`. */
  reason?: string;
}

/**
 * Strip the surrounding quotes Cloudflare returns on TXT record `data`
 * (e.g. `"sabflow-abc123"` → `sabflow-abc123`). Handles multi-string TXT
 * records too, joining them as DNS clients do (RFC 1035 §3.3.14).
 */
function unquoteTxt(raw: string): string {
  const pieces = raw.match(/"((?:[^"\\]|\\.)*)"/g);
  if (!pieces || pieces.length === 0) {
    return raw.trim();
  }
  return pieces
    .map((p) => p.slice(1, -1).replace(/\\(.)/g, '$1'))
    .join('');
}

/**
 * Check whether `_sabflow.{domain}` resolves to a TXT record whose value
 * contains `expectedToken` (case-insensitive).
 *
 * @param domain         User-facing hostname (e.g. `chat.mysite.com`).
 * @param expectedToken  Token that must appear in the TXT record value.
 */
export async function verifyDomain(
  domain: string,
  expectedToken: string,
): Promise<VerifyDomainResult> {
  const normalised = normaliseDomain(domain);
  if (!normalised) {
    return { verified: false, reason: 'Invalid domain' };
  }
  if (!expectedToken) {
    return { verified: false, reason: 'Missing verification token' };
  }

  const lookupName = `_sabflow.${normalised}`;
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(lookupName)}&type=TXT`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      cache: 'no-store',
    });
  } catch (err) {
    return {
      verified: false,
      reason: `DNS lookup failed: ${err instanceof Error ? err.message : 'network error'}`,
    };
  }

  if (!res.ok) {
    return {
      verified: false,
      reason: `DNS resolver returned HTTP ${res.status}`,
    };
  }

  let payload: DohResponse;
  try {
    payload = (await res.json()) as DohResponse;
  } catch {
    return { verified: false, reason: 'Invalid response from DNS resolver' };
  }

  // Status 0 = NOERROR. Status 3 = NXDOMAIN.
  if (payload.Status === 3) {
    return {
      verified: false,
      reason: `No TXT record found at ${lookupName}. DNS may still be propagating.`,
    };
  }
  if (payload.Status !== 0) {
    return {
      verified: false,
      reason: `DNS lookup returned status ${payload.Status}`,
    };
  }

  const answers = payload.Answer ?? [];
  if (answers.length === 0) {
    return {
      verified: false,
      reason: `No TXT record found at ${lookupName}.`,
    };
  }

  const expected = expectedToken.trim().toLowerCase();
  for (const ans of answers) {
    // TXT = 16. Skip other record types (e.g. CNAME chains).
    if (ans.type !== 16) continue;
    const value = unquoteTxt(ans.data).toLowerCase();
    if (value.includes(expected)) {
      return { verified: true };
    }
  }

  return {
    verified: false,
    reason: `TXT record found at ${lookupName} but did not match the expected token.`,
  };
}
