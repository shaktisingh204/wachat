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

## Browser + worker suites

Two layers were added on top of the foundations above:

### Playwright browser specs — `e2e/sabflow/*.spec.ts`

Run with `npm run test:sabflow-e2e` (or as part of `test:sabflow-all`).
They use the authenticated `sabflow` project (storageState from
global-setup) and the `webServer` block in `playwright.config.ts`
(`reuseExistingServer: true` — an already-running `npm run dev` on :3002 is
reused; otherwise Playwright starts one).

| Spec | Covers |
| --- | --- |
| `pages.spec.ts` | All 18 sidebar routes render (main landmark, no error boundary, known h1s) + one dark-mode pass (`localStorage sabnode-theme=dark` → `html.dark`, non-white background) |
| `crud.spec.ts` | Env var add/delete via the modal (+toasts), folder create/delete, connection (credential) create/delete through the real dialogs |
| `editor.spec.ts` | Editor canvas mounts, palette search finds a live app preset, Apps footer reports ≥ 400 apps, click-to-add via the NodeCreator (Tab), dirty dot + autosave indicator, preset settings panel (brand header + Action select) |
| `executions.spec.ts` | Executions page renders; `POST /api/sabflow/[flowId]/trigger` → row appears in list API + UI; replay page renders. Without a running `sabflow-worker` the status stays `queued` — only the ROW is asserted. Needs Redis for the trigger (skips on 500). |
| `invites.spec.ts` | Seeded incoming workspace invite shows in the inbox; decline removes it (+toast) |

Stable hooks relied on (added sparingly where no role/label existed):
`data-testid="sabflow-canvas"` (pre-existing, Canvas.tsx),
`data-testid="sabflow-apps-count"` (BlocksSideBar.tsx apps footer),
`data-testid="sabflow-node-creator"` (NodeCreator.tsx root).

Mongo-dependent specs (`editor`, `executions`, `invites`, and `crud`'s
cleanup) self-skip with a clear message on the macOS local-network flake
described above.

Known app quirk encoded in `executions.spec.ts`: the execution-detail API
(`src/app/api/sabflow/executions/[executionId]/route.ts`) authorises against
a `sabflow_flows` collection while flows live in `sabflows`, so the replay
client can show its handled "Could not load execution" alert; the spec
asserts the page frame renders without crashing either way.

### Worker round-trip — `tests/sabflow-worker/roundtrip.test.ts`

Run via `test:sabflow-all`, or directly:

```bash
npx tsx --test --test-force-exit tests/sabflow-worker/roundtrip.test.ts
```

Spawns the real worker (`node_modules/.bin/tsx src/workers/sabflow-worker.ts`,
the exact PM2 invocation) with `RUST_API_URL=http://127.0.0.1:1` so the Rust
engine path fails fast and the TS fallback is exercised deterministically.
It inserts a `sabflow_executions` row (the `retryExecution` shape), enqueues
through the real `enqueueWorkerExecution` producer, and polls Mongo (≤ 60s):

1. **text flow** (text bubble + trailing `set_variable` marker) →
   `status: success`, `engine: 'ts'`, `finishedAt` set, marker persisted in
   `updatedVariables` (the positive control);
2. **forge flow** (`forge_app_preset` with a bogus presetId, then the same
   marker block). Engine semantics — verified in
   `executeBlock.ts`/`executeFlow.ts` — turn forge failures into a graceful
   **halt** (`onError` defaults to `'stop'` → `errorSignal: 'halt'` →
   `executeFlow` returns normally), so the worker records
   `status: 'success'`, **not** `'error'`. The forge-routing proof is the
   halt itself: the marker after the failing forge block must NOT have run
   (absent from `updatedVariables`), while case 1 proves the identical
   marker runs when nothing halts. A Rust-style silent skip would have
   continued and set the marker.

Two environment quirks handled inside the test:

- this repo's `.env` sets `REDIS_HOST=`/`REDIS_PORT=` to **empty strings**,
  which defeats the `?? 'localhost'` fallbacks in the producer/worker — the
  test normalises them to the localhost defaults before probing/spawning;
- the TS-engine import chain reaches `import 'server-only'`
  (`src/lib/sabflow/forge/index.ts`), which Next strips at build time but
  plain tsx cannot resolve (the package isn't installed) — the spawned
  worker gets a benign stub via `NODE_PATH`. Without it the production
  worker's TS fallback dies with "Cannot find module 'server-only'" on any
  box where the package is absent — worth knowing operationally.

Self-skips when Mongo or Redis is unreachable from the process, or when the
spawned worker never logs "listening". Teardown kills the worker, removes
its BullMQ jobs (so a later real worker can't replay them), and sweeps the
seeded rows. `--test-force-exit` is required for the same enqueue-worker
singleton reason as `cron-tick.test.ts`.

Verified locally 2026-06-11: both cases pass against local Mongo + Redis
(`pass 2`), and self-skip cleanly when Redis is stopped.

### What still needs the dev box to go green

- dev server on :3002 (auto-started by Playwright's `webServer` if absent),
- Mongo reachable (fixture seeding; macOS flake → skips),
- Redis for `executions.spec.ts`'s trigger and the worker round-trip,
- a populated app-preset catalog (the ≥ 400 apps assertion reads the live
  `/api/sabflow/app-presets` + editor catalog).

## Known issue: cross-file cleanup race

Test files run as separate parallel processes and `seed.cleanup()` sweeps ALL
`__e2e`-tagged docs — another file's afterAll can delete a sibling file's
seeded docs mid-test. Symptom: 'workspaces/invites surfaces a seeded incoming
+ sent invite' fails in full-suite runs but passes solo
(`tsx --test tests/sabflow-api/smoke.test.ts`). Fix when convenient: tag docs
with a per-process runId and scope cleanup() to it, or run the api suite with
--test-concurrency=1.
