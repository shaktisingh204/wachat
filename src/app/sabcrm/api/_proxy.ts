import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Phase 1B — thin reverse-proxy from `/sabcrm/api/*` to twenty-server.
 *
 * Forwards the incoming request (method, headers incl. `authorization`, body)
 * to `${TWENTY_SERVER_URL}` at the matching downstream path and streams the
 * upstream response straight back. No auth bridging happens here yet — the
 * caller's `Authorization` header is passed through verbatim (Phase 4 will mint
 * Twenty-scoped tokens via the C6 bridge).
 *
 * INERT by default: these routes only matter once an operator stands up
 * twenty-server and points `TWENTY_SERVER_URL` at it. Until then every request
 * returns a clear 503 (see {@link resolveTwentyBaseUrl}).
 */

/** Default base URL mirrors the C5 twenty-client convention. */
const DEFAULT_TWENTY_SERVER_URL = 'http://127.0.0.1:3000';

/**
 * Headers we must not forward upstream (hop-by-hop / connection-scoped) or that
 * `fetch` will recompute itself. Lowercased for case-insensitive matching.
 */
const STRIPPED_REQUEST_HEADERS = new Set<string>([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  // Next.js / runtime internals that must not leak downstream.
  'x-middleware-subrequest',
]);

/**
 * Response headers we must not copy back to the client (hop-by-hop or set by
 * the Next.js runtime when it serialises our streamed body).
 */
const STRIPPED_RESPONSE_HEADERS = new Set<string>([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
]);

/**
 * Resolve the twenty-server base URL, or `null` when unconfigured. We treat an
 * unset env var as "feature off" so the proxy stays inert until an operator
 * opts in — rather than silently hitting the localhost default.
 */
function resolveTwentyBaseUrl(): string | null {
  const raw = process.env.TWENTY_SERVER_URL?.trim();
  if (!raw) return null;
  // Strip any trailing slash so path-joining is predictable.
  return raw.replace(/\/+$/, '') || DEFAULT_TWENTY_SERVER_URL;
}

function misconfiguredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'twenty_server_unconfigured',
      message:
        'TWENTY_SERVER_URL is not set; the SabCRM /sabcrm/api proxy is disabled. ' +
        'Set TWENTY_SERVER_URL to the base URL of a running twenty-server to enable it.',
    },
    { status: 503 },
  );
}

function badGatewayResponse(detail: string): NextResponse {
  return NextResponse.json(
    {
      error: 'twenty_server_unreachable',
      message: `Failed to reach twenty-server: ${detail}`,
    },
    { status: 502 },
  );
}

function buildForwardHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of req.headers) {
    if (STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  return headers;
}

function buildResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const [key, value] of upstream.headers) {
    if (STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  return headers;
}

/** Methods that never carry a request body. */
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

/**
 * Proxy `req` to twenty-server at `downstreamPath` (a path beginning with `/`,
 * e.g. `/graphql` or `/rest/companies`). The original query string is preserved.
 */
export async function proxyToTwenty(
  req: NextRequest,
  downstreamPath: string,
): Promise<NextResponse | Response> {
  const baseUrl = resolveTwentyBaseUrl();
  if (!baseUrl) return misconfiguredResponse();

  const search = req.nextUrl.search ?? '';
  const path = downstreamPath.startsWith('/')
    ? downstreamPath
    : `/${downstreamPath}`;
  const targetUrl = `${baseUrl}${path}${search}`;

  const method = req.method.toUpperCase();
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: buildForwardHeaders(req),
    redirect: 'manual',
    cache: 'no-store',
  };

  if (!BODYLESS_METHODS.has(method)) {
    // Stream the body through without buffering. `duplex: 'half'` is required by
    // the fetch spec when sending a streaming request body.
    init.body = req.body;
    init.duplex = 'half';
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    return badGatewayResponse((err as Error).message);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: buildResponseHeaders(upstream),
  });
}
