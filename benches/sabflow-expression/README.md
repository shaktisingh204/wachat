# `benches/sabflow-expression`

Track B Phase 4 — performance bench harness for the SabFlow expression engine
(`src/lib/sabflow/expressions/`). Sibling of `benches/sabflow-executor` and
`benches/sabflow-ws`; same conventions, different subject.

This directory holds the harness only. It does not run in CI and is invoked
manually when characterizing or regression-testing the expression evaluator.

## Layout

```
benches/sabflow-expression/
  README.md         (this file)
  workloads.json    12 fixed workloads + shared fixture
  run.js            driver: node run.js [--mode=...] [--iters=...]
```

No `package.json`, no `node_modules`. The harness uses Node built-ins only.

## Prerequisites

- Node 24.x (matches the SabNode runtime).
- Optional: launch with `node --expose-gc run.js ...` to let the harness force
  a GC between warmup and measurement; without it the harness skips the GC
  call and reports memory delta anyway.

## Running

```sh
# Full sweep (both parse and eval modes, all 12 workloads):
node --expose-gc run.js --mode=both --iters=10000 --warmup=5 > results.csv

# Parse cost only:
node run.js --mode=parse > parse.csv

# Single workload, eval only:
node run.js --mode=eval --workload=array_map
```

CLI flags:

| Flag             | Default       | Notes                                      |
| ---------------- | ------------- | ------------------------------------------ |
| `--mode`         | `both`        | `parse`, `eval`, or `both`                 |
| `--iters`        | `10000`       | Iterations per workload (post-warmup)      |
| `--warmup`       | `5`           | Warmup runs per workload, discarded        |
| `--workload=ID`  | _(all)_       | Restrict to one workload id                |
| `--file=PATH`    | `./workloads.json` | Alternate workloads file              |

Informational lines (engine source, stub warnings) go to **stderr**. CSV goes
to **stdout** — pipe it freely.

## Methodology

Fixed by design and reflected in `run.js`:

- **10,000 iterations** per workload (override with `--iters`).
- **5 warmup runs** per workload, discarded before measurement starts
  (override with `--warmup`).
- **`process.hrtime.bigint()`** for nanosecond-resolution timing. Each
  iteration's delta is stored as a `bigint`, converted to `Number` only at
  summary time.
- **Reported per workload**: `mean_ns`, `p50_ns`, `p99_ns`, `stddev_ns`,
  `min_ns`, `max_ns`.
- **Memory delta**: `process.memoryUsage()` snapshot before and after the
  measured loop; we record `rss` and `heapUsed` deltas in bytes. If `--expose-gc`
  is passed, `global.gc()` runs once between warmup and the measured loop so
  the delta reflects steady-state allocations, not residue from warmup.
- **Parse vs eval are measured separately**. For `eval` mode the expression
  is parsed once outside the timed loop; only `evaluate(ast, ctx)` is timed.
  This prevents parse cost from polluting eval samples.
- **`cold_parse` workload** is parse-only by definition (the `parseOnly: true`
  flag in `workloads.json`); it is skipped when `--mode=eval`.

The output is a flat CSV — one row per `(workload, mode)` pair, plus a header
line. Column order is stable and is the contract that future diff scripts
will rely on.

## Workloads

`workloads.json` defines 12 expressions of increasing complexity. The order
is deliberate (CSV column ordering and trend reading both depend on it):

| # | id                    | Shape                                    |
| - | --------------------- | ---------------------------------------- |
| 1 | `simple`              | `{{ $json.foo }}`                        |
| 2 | `dotted`              | `{{ $json.user.profile.email }}`         |
| 3 | `method`              | `{{ $json.name.toUpperCase() }}`         |
| 4 | `arithmetic`          | `{{ ($json.price * 1.18).toFixed(2) }}`  |
| 5 | `ternary`             | `{{ $json.qty > 10 ? 'bulk' : 'retail' }}` |
| 6 | `array_map`           | `{{ $json.items.map(i => i.id).join(',') }}` |
| 7 | `object_keys`         | `{{ Object.keys($json).length }}`        |
| 8 | `nested_object`       | `{{ { id: $json.id, name: $json.name + ' (active)' } }}` |
| 9 | `regex`               | `{{ $json.email.replace(/@.*/, '') }}`   |
| 10 | `datetime`           | `{{ $now.minus({days: 7}).toISO() }}`    |
| 11 | `long_text_template` | ~200-char template with 5 interleaved exprs |
| 12 | `cold_parse`         | Parse-only; never evaluated              |

All workloads share a single fixture object (`fixture.json` in
`workloads.json`) to keep cache behaviour comparable across rows.

## Engine import — stubbed until sub-task #4

`run.js` calls `loadEngine()`, which tries (in order):

1. `dist/lib/sabflow/expressions` (compiled CJS, if any build emits it),
2. `.next/server/lib/sabflow/expressions` (Next.js server output),
3. `src/lib/sabflow/expressions` (direct TS, only works under a ts loader).

If none load, `loadEngine()` falls back to a **built-in resolver** that splits
on `{{ ... }}`, compiles each expression to a `Function`, and evaluates with
`$json`, `$now`, and `Object` in scope. This fallback exists purely so the
harness end-to-end is testable without a working engine import. It is **not**
a correctness reference and its numbers should be read as a harness baseline,
not as engine performance. `run.js` prints a clear stderr warning when the
fallback is active, and the CSV's `engine` column will read `stub`.

Once sibling sub-task #4 (engine packaging) lands, the first matching
candidate above will resolve and the `engine` column will read `real`.

## Comparison to n8n (deferred)

We deliberately do **not** import or run n8n's evaluator from this harness
yet — pulling `@n8n/expression-runtime` or `n8n-workflow` would add a
non-trivial dep tree (Tournament/Tournament-tmpl, Luxon, jmespath, etc.) and
muddy the "Node built-ins only" rule that the sibling benches follow.

Plan for parity comparison, once we want it:

1. Spin up a peer directory `benches/sabflow-expression-n8n-parity/` with its
   own `package.json` pinning `n8n-workflow` and `@n8n/expression-runtime`
   to the versions vendored under `n8n-master/`.
2. Re-implement `run.js`'s `loadEngine()` to construct n8n's
   `WorkflowDataProxy` + `Expression.getSimpleParameterValue` over the same
   `workloads.json` fixture.
3. Emit the same CSV schema. Diff against this harness's CSV by joining on
   `workload,mode`.
4. Treat n8n's numbers as the **upper bound** we want to beat (or at least
   match) — n8n's evaluator does substantially more work (proxy traps, Luxon
   wrapping, sandboxing via `tmpl`), so a faster SabFlow result without
   feature parity is meaningless. The parity column lives in the comparison
   harness's README, not here.

Until then, this harness is single-engine and self-comparing across runs.

## Status

Harness only. No bench has been run. Wiring the real engine import is gated
on sub-task #4. Establishing baseline numbers is gated on sub-task #10
(closing Track B Phase 4).
