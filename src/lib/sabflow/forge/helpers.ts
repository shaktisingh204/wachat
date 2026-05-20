/**
 * Forge helpers — the "platform owns the boring HTTP" layer.
 *
 * Today most forge blocks roll their own fetch+auth header construction:
 *
 *   const token = ctx.credential?.botToken;
 *   if (!token) throw ...;
 *   const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
 *
 * That's fine but repeats credential checks, header builds, error parsing,
 * and pagination logic in every block. Phase 4 introduces `helpers` on the
 * action + load-options contexts so new blocks can write:
 *
 *   const r = await ctx.helpers!.requestWithAuthentication('bearer', {
 *     method: 'GET',
 *     url: 'https://slack.com/api/conversations.list',
 *     tokenField: 'botToken',
 *     query: { types: 'public_channel', limit: 200 },
 *   });
 *
 * Helpers never see the raw credential at the action level — `makeHelpers`
 * closes over it once when the executor builds the ctx. Resolvers that
 * still want to inspect tokens directly can keep using `ctx.credential`.
 *
 * Mirrors n8n's `IExecuteFunctions.helpers.requestWithAuthentication`.
 */

export type ForgeHttpRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  url: string;
  headers?: Record<string, string>;
  /** Query-string params; undefined entries are skipped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Body serialised as JSON with `Content-Type: application/json` if not set. */
  json?: unknown;
  /** Raw body — takes precedence over `json` when both are supplied. */
  body?: string;
  /** Credential field that holds the token (bearer/apiKey). Defaults to
   *  `accessToken` for bearer / `apiKey` for apiKey auth. */
  tokenField?: string;
};

export type ForgeHttpResponse = {
  ok: boolean;
  status: number;
  /** Parsed JSON when `Content-Type: application/json`, else raw text. */
  data: unknown;
  headers: Record<string, string>;
};

export type ForgeAuthScheme = 'bearer' | 'basic' | 'apiKey';

export type ForgeHelpers = {
  /**
   * Plain HTTP fetch with the same request/response shape — no auth
   * injection. Use when calling endpoints that don't need credentials
   * (public APIs, status checks).
   */
  httpRequest: (req: ForgeHttpRequest) => Promise<ForgeHttpResponse>;
  /**
   * HTTP fetch with the given auth scheme injected from the credential
   * closure. Throws when no credential is bound — never silently sends
   * an unauthed request that the provider would reject in confusing ways.
   */
  requestWithAuthentication: (
    auth: ForgeAuthScheme,
    req: ForgeHttpRequest,
  ) => Promise<ForgeHttpResponse>;
};

/* ── Internals ───────────────────────────────────────────────────────────── */

function buildUrl(url: string, query?: ForgeHttpRequest['query']): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function rawFetch(
  req: ForgeHttpRequest,
  extraHeaders: Record<string, string>,
): Promise<ForgeHttpResponse> {
  const headers: Record<string, string> = { ...(req.headers ?? {}), ...extraHeaders };
  let body = req.body;
  if (req.json !== undefined && body === undefined) {
    body = JSON.stringify(req.json);
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  }
  const res = await fetch(buildUrl(req.url, req.query), {
    method: req.method,
    headers,
    body,
  });
  const ct = res.headers.get('content-type') ?? '';
  let data: unknown;
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text();
  }
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    out[k] = v;
  });
  return { ok: res.ok, status: res.status, data, headers: out };
}

/* ── Factory ─────────────────────────────────────────────────────────────── */

/**
 * Build a `ForgeHelpers` closure over the given credential. Pass `undefined`
 * for blocks without a credential — `requestWithAuthentication` will throw
 * when called, but `httpRequest` still works for unauthenticated endpoints.
 */
export function makeHelpers(
  credential: Record<string, string> | undefined,
): ForgeHelpers {
  return {
    httpRequest: (req) => rawFetch(req, {}),
    requestWithAuthentication: async (auth, req) => {
      if (!credential) {
        throw new Error(
          'helpers.requestWithAuthentication: no credential bound to this run',
        );
      }
      if (auth === 'bearer') {
        const fieldName = req.tokenField ?? 'accessToken';
        const token = credential[fieldName];
        if (!token) {
          throw new Error(
            `helpers.requestWithAuthentication(bearer): credential missing field "${fieldName}"`,
          );
        }
        return rawFetch(req, { Authorization: `Bearer ${token}` });
      }
      if (auth === 'basic') {
        const user = credential.username ?? credential.user ?? '';
        const pass = credential.password ?? credential.pass ?? '';
        if (!user && !pass) {
          throw new Error(
            'helpers.requestWithAuthentication(basic): credential missing username + password',
          );
        }
        const b64 = Buffer.from(`${user}:${pass}`).toString('base64');
        return rawFetch(req, { Authorization: `Basic ${b64}` });
      }
      // apiKey
      const fieldName = req.tokenField ?? 'apiKey';
      const key = credential[fieldName];
      if (!key) {
        throw new Error(
          `helpers.requestWithAuthentication(apiKey): credential missing field "${fieldName}"`,
        );
      }
      return rawFetch(req, { 'X-Api-Key': key });
    },
  };
}
