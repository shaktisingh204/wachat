import 'server-only';

/**
 * C5 — Twenty server GraphQL client (Phase 0 contract).
 *
 * Minimal typed fetcher against the running `twenty-server` GraphQL endpoints
 * (`/graphql` for records, `/metadata` for object/field metadata). The bearer
 * token is minted per request by the auth bridge (C6) so every call is scoped
 * to the caller's Twenty workspace + user. This is the SabNode→Twenty direction
 * (the inverse of `src/lib/rust-client/fetcher.ts`).
 *
 * Phase 0: the transport is real (so smoke tests work once twenty-server is
 * up), but no callers are wired yet — the data-layer router (C8) selects the
 * Rust path by default until Phase 4/5 cutover.
 */

export type TwentyEndpoint = 'graphql' | 'metadata';

export interface TwentyRequestContext {
  /** Bearer access token for the target workspace/user (from the C6 bridge). */
  token: string;
  /** Override the base URL (defaults to env). Useful for tests / per-env. */
  baseUrl?: string;
}

export class TwentyApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly graphqlErrors?: unknown,
  ) {
    super(message);
    this.name = 'TwentyApiError';
  }
}

function endpointUrl(endpoint: TwentyEndpoint, baseUrl?: string): string {
  const base =
    baseUrl ??
    process.env.TWENTY_SERVER_URL ??
    'http://127.0.0.1:3000';
  return endpoint === 'metadata' ? `${base}/metadata` : `${base}/graphql`;
}

/**
 * Run a GraphQL operation against twenty-server. Throws {@link TwentyApiError}
 * on transport or GraphQL errors; otherwise returns the typed `data` payload.
 */
export async function twentyFetch<T>(
  query: string,
  variables: Record<string, unknown> | undefined,
  ctx: TwentyRequestContext,
  endpoint: TwentyEndpoint = 'graphql',
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(endpointUrl(endpoint, ctx.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ctx.token}`,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
      cache: 'no-store',
    });
  } catch (err) {
    throw new TwentyApiError(
      `twenty-server unreachable: ${(err as Error).message}`,
    );
  }

  if (!res.ok) {
    throw new TwentyApiError(
      `twenty-server returned ${res.status}`,
      res.status,
    );
  }

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) {
    throw new TwentyApiError('GraphQL error', res.status, json.errors);
  }
  if (json.data === undefined) {
    throw new TwentyApiError('GraphQL response had no data', res.status);
  }
  return json.data;
}
