# SabFlow editor — perf regression bench

Track A · Phase 6 · sub-task 10/10. Measures the runtime cost of the
**CRDT-backed editor** (Y.Doc + reactive sync) against the previous
**local-state baseline** (plain React state, no realtime fan-out).

> Status: **not wired to CI.** Local-only until baselines are filled in
> below. Exit codes are informational.

---

## What it measures

Per scenario, per run, the in-page collector samples:

| Metric            | Source                                         | Direction |
| ----------------- | ---------------------------------------------- | --------- |
| `lcp_ms`          | `PerformanceObserver('largest-contentful-paint')` | lower is better |
| `cls`             | `PerformanceObserver('layout-shift')`          | lower is better |
| `inp_ms`          | `PerformanceObserver('event')` (worst event)   | lower is better |
| `long_tasks_ms`   | `PerformanceObserver('longtask')` sum          | lower is better |
| `fps_avg`         | rAF interval mean → 1000/avg                   | higher is better |
| `fps_p1`          | rAF interval 99th-percentile → 1000/p99        | higher is better |
| `frames_dropped`  | rAF intervals exceeding 1000/50ms              | lower is better |
| `js_heap_delta_mb`| `performance.memory.usedJSHeapSize` delta      | lower is better |
| `dom_node_delta`  | `document.getElementsByTagName('*')` delta     | lower is better |

The collector is pure DOM (no `web-vitals` npm dep on the page side); it is
injected via `addInitScript` / `evaluateOnNewDocument` before the editor
boots so it observes the first frame.

## Methodology

1. **Driver.** Default is **Playwright** (Chromium). A `puppeteer-core`
   alternative is documented but not implemented in `run.js` yet — the
   collector and interaction primitives are intentionally driver-agnostic,
   so porting is mechanical.
2. **Server.** The bench does **not** boot Next.js. Either run
   `npm run dev` locally and point `--base=http://localhost:3000`, or
   target a preview deployment (`--base=https://<sha>-sabnode.vercel.app`).
3. **Auth.** The editor requires a session. Generate a `storageState.json`
   once (e.g. `npx playwright codegen --save-storage=.auth/state.json`)
   and pass `--storageState=.auth/state.json`.
4. **Throttling.** Per-scenario CPU and network throttling is declared in
   `scenarios.json` (`setup.throttleCpu`, `setup.throttleNetwork`). Cold
   load uses 4× CPU slowdown + Fast3G to surface boot regressions.
5. **Runs.** Each scenario runs `common.warmupRuns` (default 1) followed
   by `common.measuredRuns` (default 5). Reported percentiles default to
   p50 / p95 / p99.
6. **Reporting.** Output JSON is written to
   `benches/sabflow-editor-perf/bench-out/run-<ts>.json` with per-run
   samples, aggregates, and budget violations.

## Scenarios

See `scenarios.json` for the full spec. Six scenarios:

| id                  | what it stresses                                |
| ------------------- | ----------------------------------------------- |
| `cold-load`         | empty-doc first paint (CRDT bootstrap cost)     |
| `small-doc`         | 10-block hydrate (median user)                  |
| `medium-doc`        | 100-block hydrate (regression-risk size)        |
| `rapid-drag`        | 5s sustained drag — frame-rate + dropped frames |
| `bulk-paste`        | 50-block single paste — transaction batching   |
| `reconnect-replay`  | 100-update oplog replay after WS reconnect      |

Each scenario carries a `budget` block with p50 and p99 bounds per metric.
Budgets are **initial guesses**; tighten them after baselines land.

## Running locally

```bash
# 1. Install Playwright in your local checkout (do NOT add to root package.json).
npm i --no-save playwright
npx playwright install chromium

# 2. Start the dev server in another shell.
npm run dev

# 3. (Optional) capture an auth state.
npx playwright codegen http://localhost:3000 --save-storage=.auth/state.json

# 4. Run the bench.
node benches/sabflow-editor-perf/run.js \
  --base=http://localhost:3000 \
  --storageState=.auth/state.json \
  --out=benches/sabflow-editor-perf/bench-out/$(date +%s).json

# 5. Run a single scenario.
node benches/sabflow-editor-perf/run.js --only=rapid-drag --headed
```

### Puppeteer alternative

```bash
npm i --no-save puppeteer-core
export CHROME_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
node benches/sabflow-editor-perf/run.js --driver=puppeteer
```

`run.js` will refuse to start with `--driver=puppeteer` until the
puppeteer code path is filled in — the collector + scenarios already work
the same in both runtimes, so it is a ~50-line port of `runScenarioPlaywright`.

## Fixtures

`scenarios.json` references files under `./fixtures/`:

- `fixtures/10-blocks.yjs.b64` — base64-encoded Y.Doc snapshot, 10 nodes.
- `fixtures/100-blocks.yjs.b64` — base64-encoded Y.Doc snapshot, 100 nodes.
- `fixtures/50-blocks-clipboard.json` — paste payload, 50 nodes.
- `fixtures/100-update-oplog.b64.json` — array of base64 Y.Doc updates.

These are **not** committed in this sub-task — they are produced by a
follow-up fixture-builder script (out of scope here). Until then,
scenarios that reference missing fixtures will fall back to an empty
document; the run still executes and the collector still emits numbers,
but `medium-doc` / `bulk-paste` / `reconnect-replay` will under-report.

## Required editor hook

`reconnect-replay` calls `window.__sabflowOplogHook(update)` to inject
oplog entries into the live Y.Doc. The editor should expose this hook
**only when `process.env.NODE_ENV !== 'production'`** so the bench can
drive it without a real WebSocket peer. If the hook is missing the
scenario logs a warning and continues with no-op inject.

## Baselines

> **TBD — fill in after the first green run.** Capture both the
> *previous local-state baseline* (git checkout the pre-CRDT commit, run
> the bench, archive the JSON) and the *current CRDT-backed editor* run.

| Scenario           | metric         | baseline p50 | baseline p99 | current p50 | current p99 | budget p50 | budget p99 |
| ------------------ | -------------- | ------------ | ------------ | ----------- | ----------- | ---------- | ---------- |
| cold-load          | LCP (ms)       | TBD          | TBD          | TBD         | TBD         | 1500       | 2500       |
| cold-load          | INP (ms)       | TBD          | TBD          | TBD         | TBD         | 100        | 200        |
| cold-load          | CLS            | TBD          | TBD          | TBD         | TBD         | 0.02       | 0.05       |
| cold-load          | heap Δ (MB)    | TBD          | TBD          | TBD         | TBD         | 12         | 20         |
| small-doc          | LCP (ms)       | TBD          | TBD          | TBD         | TBD         | 1800       | 2800       |
| small-doc          | INP (ms)       | TBD          | TBD          | TBD         | TBD         | 120        | 220        |
| medium-doc         | LCP (ms)       | TBD          | TBD          | TBD         | TBD         | 2500       | 4000       |
| medium-doc         | INP (ms)       | TBD          | TBD          | TBD         | TBD         | 180        | 350        |
| medium-doc         | long-tasks (ms)| TBD          | TBD          | TBD         | TBD         | 250        | 600        |
| medium-doc         | heap Δ (MB)    | TBD          | TBD          | TBD         | TBD         | 30         | 55         |
| rapid-drag         | fps avg        | TBD          | TBD          | TBD         | TBD         | 55         | 50         |
| rapid-drag         | fps p1         | TBD          | TBD          | TBD         | TBD         | 30         | 22         |
| rapid-drag         | frames dropped | TBD          | TBD          | TBD         | TBD         | 5          | 20         |
| bulk-paste         | INP (ms)       | TBD          | TBD          | TBD         | TBD         | 200        | 500        |
| bulk-paste         | long-tasks (ms)| TBD          | TBD          | TBD         | TBD         | 300        | 800        |
| bulk-paste         | DOM Δ          | TBD          | TBD          | TBD         | TBD         | 600        | 1200       |
| reconnect-replay   | INP (ms)       | TBD          | TBD          | TBD         | TBD         | 250        | 600        |
| reconnect-replay   | long-tasks (ms)| TBD          | TBD          | TBD         | TBD         | 400        | 1000       |
| reconnect-replay   | frames dropped | TBD          | TBD          | TBD         | TBD         | 6          | 20         |

Budget direction: `fps_*` rows are **lower-bounds** (we want at-least),
all other rows are upper-bounds (we want at-most). The runner encodes
this rule in `evalBudget()`.

## Out of scope (intentionally deferred)

- Wiring to CI / blocking PRs. Budgets are not yet trustworthy.
- Fixture-builder script (`scripts/build-bench-fixtures.ts`).
- Puppeteer driver implementation (Playwright path is sufficient).
- Per-region perf comparison (Vercel Edge vs Node runtime) — separate bench.
- Memory leak detection across runs (would need 30-min soak).

## Conventions

- No dependencies installed at repo root. Use `npm i --no-save` or a
  per-directory `package.json` in `benches/sabflow-editor-perf/` if you
  prefer a checked-in lockfile.
- Output JSON in `bench-out/` is git-ignored at the repo level (add to
  `.gitignore` when first run lands).
- Do not run this bench against production. Always target a preview
  deployment or local dev server.
