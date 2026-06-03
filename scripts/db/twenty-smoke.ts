/**
 * Phase 1D — C5 smoke test.
 *
 * Verifies twenty-server reachability by running a trivial GraphQL query
 * (`{ __typename }`) against `process.env.TWENTY_SERVER_URL` using a bearer
 * token from `process.env.TWENTY_SMOKE_TOKEN`, then printing the HTTP status
 * and the parsed result.
 *
 * Run (once twenty-server is up — do NOT run as part of CI/build):
 *   TWENTY_SERVER_URL=http://127.0.0.1:3000 \
 *   TWENTY_SMOKE_TOKEN=<bearer> \
 *   npx tsx scripts/db/twenty-smoke.ts
 *
 * NOTE ON IMPORTING C5: the contract client at
 *   ../../src/lib/data-layer/twenty-client.ts
 * begins with `import 'server-only'`, which throws when evaluated outside the
 * Next.js bundler (i.e. under plain `node` / `tsx`). To keep this script
 * runnable standalone, we DO NOT import `twentyFetch`; instead we replicate its
 * tiny transport inline below. The behaviour mirrors C5 exactly (POST to
 * `${base}/graphql`, `Bearer` auth, `cache: no-store`, surface GraphQL errors)
 * so the smoke check is faithful to the real client path.
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

// Mirrors twenty-client.ts `endpointUrl(...)` for the `graphql` endpoint.
function graphqlUrl(baseUrl: string): string {
  return `${baseUrl}/graphql`;
}

async function main(): Promise<number> {
  const baseUrl = process.env.TWENTY_SERVER_URL ?? DEFAULT_BASE_URL;
  const token = process.env.TWENTY_SMOKE_TOKEN;

  if (!token) {
    console.error(
      '[twenty-smoke] missing TWENTY_SMOKE_TOKEN env var — set a bearer token scoped to a Twenty workspace/user.',
    );
    return 2;
  }

  const url = graphqlUrl(baseUrl);
  const query = '{ __typename }';

  console.log(`[twenty-smoke] POST ${url}`);
  console.log(`[twenty-smoke] query: ${query}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: {} }),
      cache: 'no-store',
    });
  } catch (err) {
    console.error(
      `[twenty-smoke] FAIL — twenty-server unreachable: ${(err as Error).message}`,
    );
    return 1;
  }

  console.log(`[twenty-smoke] status: ${res.status} ${res.statusText}`);

  let body: unknown;
  const raw = await res.text();
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }

  console.log('[twenty-smoke] result:');
  console.log(
    typeof body === 'string' ? body : JSON.stringify(body, null, 2),
  );

  if (!res.ok) {
    console.error(`[twenty-smoke] FAIL — non-2xx status ${res.status}`);
    return 1;
  }

  const json = body as { data?: unknown; errors?: unknown };
  if (json && typeof json === 'object' && json.errors) {
    console.error('[twenty-smoke] FAIL — GraphQL errors present (see above)');
    return 1;
  }

  console.log('[twenty-smoke] OK — twenty-server reachable.');
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(`[twenty-smoke] UNEXPECTED ERROR: ${(err as Error).stack ?? err}`);
    process.exitCode = 1;
  });
