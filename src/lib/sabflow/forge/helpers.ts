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
  /** Credential field that holds the token (bearer/apiKey/raw/custom-header/
   *  query-param). Defaults to `accessToken` for bearer / `apiKey` for apiKey. */
  tokenField?: string;
  /** Header name to use when scheme is `'custom-header'`
   *  (e.g. `X-Shopify-Access-Token`, `api-key`, `Notion-Version`-style). */
  headerName?: string;
  /** Credential field used as the basic-auth username for `'basic-custom'`. */
  userField?: string;
  /** Credential field used as the basic-auth password for `'basic-custom'`.
   *  When omitted the password is an empty string (Stripe-style). */
  passField?: string;
  /** Literal string to use as the basic-auth username for `'basic-custom'`,
   *  bypassing credential lookup. Set this for APIs whose basic-auth user is
   *  a fixed sentinel (e.g. Mailchimp requires `anystring:<apiKey>`). */
  userLiteral?: string;
  /** Literal basic-auth password (mirror of `userLiteral`); rarely needed. */
  passLiteral?: string;
  /** Query-string parameter name for `'query-param'` auth
   *  (e.g. `api_token` for Pipedrive). */
  paramName?: string;
  /** Template URL for `'path-segment'` auth — the credential lives inside the
   *  URL path itself (e.g. Telegram's `https://api.telegram.org/bot{token}/{method}`).
   *  `{token}` is substituted from `credential[tokenField]` (default `apiToken`);
   *  any other `{placeholder}` resolves against `pathParams[placeholder]`.
   *  Required when scheme is `path-segment` — overrides `url`. */
  urlTemplate?: string;
  /** Non-credential placeholders for `urlTemplate` substitution
   *  (e.g. `{method}` → `sendMessage`). Values are URL-encoded before splicing. */
  pathParams?: Record<string, string>;
};

export type ForgeHttpResponse = {
  ok: boolean;
  status: number;
  /** Parsed JSON when `Content-Type: application/json`, else raw text. */
  data: unknown;
  headers: Record<string, string>;
};

export type ForgeAuthScheme =
  | 'bearer'
  | 'basic'
  | 'apiKey'
  | 'custom-header'
  | 'basic-custom'
  | 'raw'
  | 'query-param'
  | 'path-segment';

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
      if (auth === 'apiKey') {
        const fieldName = req.tokenField ?? 'apiKey';
        const key = credential[fieldName];
        if (!key) {
          throw new Error(
            `helpers.requestWithAuthentication(apiKey): credential missing field "${fieldName}"`,
          );
        }
        return rawFetch(req, { 'X-Api-Key': key });
      }
      if (auth === 'custom-header') {
        if (!req.headerName) {
          throw new Error(
            'helpers.requestWithAuthentication(custom-header): req.headerName is required',
          );
        }
        if (!req.tokenField) {
          throw new Error(
            'helpers.requestWithAuthentication(custom-header): req.tokenField is required',
          );
        }
        const token = credential[req.tokenField];
        if (!token) {
          throw new Error(
            `helpers.requestWithAuthentication(custom-header): credential missing field "${req.tokenField}"`,
          );
        }
        return rawFetch(req, { [req.headerName]: token });
      }
      if (auth === 'basic-custom') {
        // Username: literal wins over credential field. Mailchimp's `anystring`
        // sentinel and similar fixed users are configured via userLiteral.
        let user = '';
        if (req.userLiteral !== undefined) {
          user = req.userLiteral;
        } else if (req.userField) {
          user = credential[req.userField] ?? '';
        }
        // Password: literal wins; otherwise lookup; missing passField → ''
        // (covers Stripe `sk_xxx:` form).
        let pass = '';
        if (req.passLiteral !== undefined) {
          pass = req.passLiteral;
        } else if (req.passField) {
          pass = credential[req.passField] ?? '';
        }
        if (!user && !pass) {
          throw new Error(
            'helpers.requestWithAuthentication(basic-custom): both username and password resolved empty',
          );
        }
        const b64 = Buffer.from(`${user}:${pass}`).toString('base64');
        return rawFetch(req, { Authorization: `Basic ${b64}` });
      }
      if (auth === 'raw') {
        const fieldName = req.tokenField ?? 'apiKey';
        const token = credential[fieldName];
        if (!token) {
          throw new Error(
            `helpers.requestWithAuthentication(raw): credential missing field "${fieldName}"`,
          );
        }
        return rawFetch(req, { Authorization: token });
      }
      if (auth === 'path-segment') {
        // Telegram-style: the credential is spliced into the URL path itself
        // (`/bot{token}/sendMessage`). No Authorization header — the URL IS
        // the secret. Substitute the token AND any non-credential placeholders
        // through encodeURIComponent so a `:` in `123:abc` becomes `%3A` and
        // can't break out of the path segment.
        if (!req.urlTemplate) {
          throw new Error(
            'helpers.requestWithAuthentication(path-segment): req.urlTemplate is required',
          );
        }
        const fieldName = req.tokenField ?? 'apiToken';
        const token = credential[fieldName];
        if (!token) {
          throw new Error(
            `helpers.requestWithAuthentication(path-segment): credential missing field "${fieldName}"`,
          );
        }
        const substituted = req.urlTemplate.replace(
          /\{([^}]+)\}/g,
          (_match, name: string) => {
            if (name === 'token') return encodeURIComponent(token);
            const v = req.pathParams?.[name];
            if (v === undefined) {
              // Never include the token value in this error — the name is
              // safe but the value isn't.
              throw new Error(
                `helpers.requestWithAuthentication(path-segment): missing pathParams["${name}"] for urlTemplate placeholder`,
              );
            }
            return encodeURIComponent(v);
          },
        );
        const reqResolved: ForgeHttpRequest = { ...req, url: substituted };
        return rawFetch(reqResolved, {});
      }
      if (auth === 'query-param') {
        if (!req.paramName) {
          throw new Error(
            'helpers.requestWithAuthentication(query-param): req.paramName is required',
          );
        }
        if (!req.tokenField) {
          throw new Error(
            'helpers.requestWithAuthentication(query-param): req.tokenField is required',
          );
        }
        const token = credential[req.tokenField];
        if (!token) {
          throw new Error(
            `helpers.requestWithAuthentication(query-param): credential missing field "${req.tokenField}"`,
          );
        }
        // Mutate the URL rather than mixing into `req.query` so we don't depend
        // on the caller building a fresh request object. NEVER log the token —
        // the URL itself is the secret here.
        const u = new URL(req.url);
        u.searchParams.set(req.paramName, token);
        const reqWithParam: ForgeHttpRequest = { ...req, url: u.toString() };
        return rawFetch(reqWithParam, {});
      }
      // Exhaustiveness check — the union should be fully covered above.
      throw new Error(
        `helpers.requestWithAuthentication: unknown auth scheme "${String(auth)}"`,
      );
    },
  };
}
