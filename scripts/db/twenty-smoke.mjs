// Smoke-test twenty-server GraphQL reachability. Node >= 20 ESM.
// Run: node --env-file=.env scripts/db/twenty-smoke.mjs
const base = (process.env.TWENTY_SERVER_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const token = process.env.TWENTY_SMOKE_TOKEN ?? '';

try {
  const res = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query: '{ __typename }' }),
  });
  const text = await res.text();
  console.log(`[twenty-smoke] ${base}/graphql -> ${res.status}`);
  console.log(text.slice(0, 500));
  process.exitCode = res.ok ? 0 : 1;
} catch (err) {
  console.error('[twenty-smoke] unreachable:', err.message);
  process.exitCode = 1;
}
