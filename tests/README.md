# SabFlow test foundations

Integration + e2e test plumbing for SabFlow. **This suite is intended for
the dev box** — it talks to a locally running dev server, Mongo, and Redis.

## Layout

| Path | What |
| --- | --- |
| `tests/sabflow-api/*.test.ts` | API integration tests (node:test via `tsx --test`) hitting `http://localhost:3002` with a minted `session` cookie |
| `tests/sabflow-api/_setup.ts` | Shared harness: connectivity probes, skip guards, `fetch` wrapper |
| `e2e/helpers/session.ts` | Fixture user + `session` JWT cookie minting (see "How auth works" below) |
| `e2e/helpers/seed.ts` | Direct-Mongo seed helpers (flows, scheduled flows, env vars, folders, workspaces, invites) + `cleanup()` |
| `e2e/global-setup.ts` | Playwright globalSetup — seeds the user, writes `e2e/.auth/sabflow.json` storageState |
| `playwright.config.ts` | `sabflow` project (authenticated, `e2e/sabflow/**`) + the original `chromium` project (everything else, unchanged) |

## Prerequisites

1. **Dev server** on port 3002: `npm run dev`
2. **MongoDB** at `MONGODB_URI` (local default `mongodb://localhost:27017`, db `MONGODB_DB` = `app1`)
3. **Redis** at `REDIS_HOST:REDIS_PORT` (default `localhost:6379`, no password locally) — needed by
   `POST /workflow/[id]/execute` (the dev server enqueues onto BullMQ) and by `cron-tick.test.ts`
   (this process enqueues directly)
4. *(Optional)* a running `sabflow-worker` — `execute.test.ts` asserts run **completion** only when a
   worker is consuming the queue; without one it asserts the queued row and notes the rest

`JWT_SECRET` is read from `.env` (the same value the dev server uses).
Note: this repo's `.env` defines `JWT_SECRET` twice — like Next.js, the
helpers take the **last** occurrence.

## Running

```bash
npm run test:sabflow-api   # API integration tests (tsx --test)
npm run test:sabflow-e2e   # Playwright browser specs in e2e/sabflow (added by a later pass)
npm run test:sabflow-all   # both, sequentially

# single file
npx tsx --test --test-force-exit tests/sabflow-api/smoke.test.ts
```

`--test-force-exit` matters: `cron-tick.test.ts` exercises the real BullMQ
producer (`src/lib/sabflow/queue/enqueue-worker.ts`), whose module-level
Redis connection has no exported close — without the flag the process hangs
after the tests pass.

## How auth works (no login UI involved)

`e2e/helpers/session.ts` mints the app's `session` cookie directly: an
HS256 JWT `{ userId, email, name, jti, iat, exp }` signed with `JWT_SECRET`,
replicating `createSessionToken` (`src/lib/auth.ts:284`). We replicate
instead of importing `@/lib/auth` because that module imports
`@/lib/mongodb` (`server-only`) and `next/headers`, which crash under
tsx/Playwright. The fixture user has a **deterministic** ObjectId
(`e2e5abf10000000000000001`, email `e2e-sabflow@test.local`) and is
upserted with `onboarding.status: 'complete'` so layout gates don't
redirect to /onboarding.

Seeded docs are tagged `__e2e: true` / name-prefixed `e2e-` and removed by
`cleanup()` in each suite's `after` hook. Credentials are **not** seeded
directly (values are encrypted at rest) — create them via
`POST /api/sabflow/credentials` with the minted cookie when a test needs one.

## macOS local-network caveat (known flake)

On this Mac, **freshly spawned** node/tsx processes sometimes get
`EADDRNOTAVAIL` connecting to localhost Mongo (macOS local-network
permission), even while the long-running Next dev server connects fine.
The harness probes Mongo with a 3s timeout in `before()`:

- tests needing **direct DB access** skip with an explicit message;
- tests that only need HTTP still run (the dev server has its own
  working Mongo connection);
- Playwright's global-setup still mints the cookie on a flake — the
  deterministic user id keeps the cookie valid if any earlier run
  seeded the user.

If you see those skips, just re-run; granting the terminal Local Network
permission in System Settings → Privacy & Security usually cures it.
