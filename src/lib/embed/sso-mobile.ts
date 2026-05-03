/**
 * PKCE OAuth helpers for native (mobile / desktop) apps.
 *
 * Implements the S256 verifier/challenge flow per RFC 7636 using
 * Web Crypto SHA-256 — no native deps so it can run on Edge or Node.
 */

function getCrypto(): Crypto {
  const g = globalThis as unknown as { crypto?: Crypto };
  if (!g.crypto) throw new Error('Web Crypto unavailable');
  return g.crypto;
}

function b64url(input: ArrayBuffer | Uint8Array): string {
  const bytes =
    input instanceof Uint8Array ? input : new Uint8Array(input as ArrayBuffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 =
    typeof btoa === 'function'
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const VERIFIER_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * Create a high-entropy PKCE code verifier.
 *
 * @param length - 43..128 chars per RFC 7636 §4.1.
 */
export function createCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('PKCE code_verifier length must be 43..128');
  }
  const buf = new Uint8Array(length);
  getCrypto().getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += VERIFIER_CHARSET[buf[i] % VERIFIER_CHARSET.length];
  }
  return out;
}

/** SHA-256 challenge derivation per RFC 7636 §4.2. */
export async function createCodeChallenge(verifier: string): Promise<string> {
  if (!verifier) throw new Error('createCodeChallenge: verifier required');
  const subtle = getCrypto().subtle;
  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return b64url(digest);
}

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

/** Convenience: create a fresh `{verifier, challenge}` pair in one call. */
export async function createPkcePair(length = 64): Promise<PkcePair> {
  const verifier = createCodeVerifier(length);
  const challenge = await createCodeChallenge(verifier);
  return { verifier, challenge, method: 'S256' };
}

export interface BuildAuthorizeUrlInput {
  authorizeEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
  challenge: string;
  /** Extra provider-specific params. */
  extra?: Record<string, string>;
}

/** Build a fully-formed authorize URL for the native browser hand-off. */
export function buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const url = new URL(input.authorizeEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('code_challenge', input.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (input.scope) url.searchParams.set('scope', input.scope);
  if (input.state) url.searchParams.set('state', input.state);
  if (input.extra) {
    for (const [k, v] of Object.entries(input.extra)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export interface ExchangeCodeInput {
  tokenEndpoint: string;
  clientId: string;
  redirectUri: string;
  code: string;
  verifier: string;
  fetchImpl?: typeof fetch;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: 'Bearer' | string;
  scope?: string;
}

/** Exchange the authorization code for tokens at the token endpoint. */
export async function exchangeAuthorizationCode(
  input: ExchangeCodeInput,
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', input.code);
  body.set('client_id', input.clientId);
  body.set('redirect_uri', input.redirectUri);
  body.set('code_verifier', input.verifier);

  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(input.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `exchangeAuthorizationCode: ${res.status} ${res.statusText} ${text}`,
    );
  }
  return (await res.json()) as OAuthTokenResponse;
}
