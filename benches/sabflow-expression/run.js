#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * benches/sabflow-expression/run.js
 *
 * Performance bench harness for the SabFlow expression engine.
 *
 *   node run.js [--mode=parse|eval|both] [--iters=N] [--warmup=N] [--workload=ID]
 *
 * Methodology (see README.md):
 *   - 10,000 iterations per workload (override with --iters)
 *   - 5 warmup runs per workload (override with --warmup)
 *   - process.hrtime.bigint() nanosecond resolution
 *   - Reports mean / p50 / p99 / stddev (ns) and memory delta (bytes)
 *   - Output is CSV on stdout; informational lines go to stderr
 *
 * Engine import is **stubbed**: we try `@/lib/sabflow/expressions` (sibling
 * sub-task #4) and fall back to a tiny built-in resolver. The fallback is
 * deliberately conservative — it implements just enough surface to exercise
 * the bench end-to-end without depending on the real engine being wired up.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    mode: 'both',
    iters: 10000,
    warmup: 5,
    workload: null,
    file: path.join(__dirname, 'workloads.json'),
  };
  for (const arg of argv.slice(2)) {
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    const m = /^--([a-zA-Z][a-zA-Z0-9_-]*)(?:=(.*))?$/.exec(arg);
    if (!m) continue;
    const key = m[1];
    const val = m[2] ?? 'true';
    switch (key) {
      case 'mode':
        if (!['parse', 'eval', 'both'].includes(val)) {
          die(`--mode must be parse|eval|both, got ${val}`);
        }
        out.mode = val;
        break;
      case 'iters':
        out.iters = parsePositiveInt(val, 'iters');
        break;
      case 'warmup':
        out.warmup = parsePositiveInt(val, 'warmup');
        break;
      case 'workload':
        out.workload = val;
        break;
      case 'file':
        out.file = path.resolve(val);
        break;
      default:
        die(`unknown flag --${key}`);
    }
  }
  return out;
}

function parsePositiveInt(raw, name) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) die(`--${name} must be a positive integer`);
  return n;
}

function printHelp() {
  process.stderr.write(
    [
      'Usage: node run.js [options]',
      '',
      'Options:',
      '  --mode=parse|eval|both   What to measure (default: both)',
      '  --iters=N                Iterations per workload (default: 10000)',
      '  --warmup=N               Warmup runs per workload (default: 5)',
      '  --workload=ID            Run a single workload by id',
      '  --file=PATH              Workloads JSON path (default: ./workloads.json)',
      '  -h, --help               Show this help',
      '',
      'Output: CSV on stdout. Use 2>/dev/null to suppress progress logs.',
      '',
    ].join('\n')
  );
}

function die(msg) {
  process.stderr.write(`run.js: ${msg}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Engine import: try real engine, else fall back to a simple resolver.
//
// Sibling sub-task #4 will publish the real engine. Until then we stub.
// The stub is intentionally minimal — it is NOT a correctness reference.
// ---------------------------------------------------------------------------

function loadEngine() {
  const candidates = [
    // Compiled output, if/when the engine is built to CJS.
    '../../dist/lib/sabflow/expressions',
    '../../.next/server/lib/sabflow/expressions',
    // Direct TS source (works only if a ts loader is registered upstream).
    '../../src/lib/sabflow/expressions',
  ];
  for (const rel of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const mod = require(path.resolve(__dirname, rel));
      if (mod && typeof mod.parse === 'function' && typeof mod.evaluate === 'function') {
        return { kind: 'real', source: rel, mod };
      }
    } catch {
      // try next
    }
  }
  return { kind: 'stub', source: 'builtin-fallback', mod: buildStubEngine() };
}

function buildStubEngine() {
  // ---- tokenizer/parser stub ------------------------------------------------
  // Splits a template into a list of literal-or-expression segments.
  // Expression segments are stored as the raw source string; "parse" cost
  // is the split + a Function() compile step kept in-memory.
  const TEMPLATE_RE = /{{\s*([\s\S]*?)\s*}}/g;

  function parse(template) {
    const segments = [];
    let last = 0;
    let m;
    TEMPLATE_RE.lastIndex = 0;
    while ((m = TEMPLATE_RE.exec(template)) !== null) {
      if (m.index > last) {
        segments.push({ kind: 'text', value: template.slice(last, m.index) });
      }
      const src = m[1];
      // Compile to a function once at parse time. This is the most
      // representative shape for measuring parse cost in the fallback.
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        '$json',
        '$now',
        'Object',
        `"use strict"; return (${src});`
      );
      segments.push({ kind: 'expr', src, fn });
      last = TEMPLATE_RE.lastIndex;
    }
    if (last < template.length) {
      segments.push({ kind: 'text', value: template.slice(last) });
    }
    return { segments };
  }

  // ---- evaluator stub -------------------------------------------------------
  function evaluate(ast, ctx) {
    const { segments } = ast;
    const $json = ctx.$json;
    const $now = ctx.$now;
    if (segments.length === 1 && segments[0].kind === 'expr') {
      return segments[0].fn($json, $now, Object);
    }
    let out = '';
    for (const seg of segments) {
      if (seg.kind === 'text') {
        out += seg.value;
      } else {
        const v = seg.fn($json, $now, Object);
        out += v == null ? '' : String(v);
      }
    }
    return out;
  }

  function resolveTemplate(template, ctx) {
    return evaluate(parse(template), ctx);
  }

  return { parse, evaluate, resolveTemplate };
}

// ---------------------------------------------------------------------------
// $now shim — Luxon-like surface for the `datetime` workload.
// The real engine will inject the project's DateTime; the stub provides a
// minimal compatible interface so the bench can run standalone.
// ---------------------------------------------------------------------------

function makeNow() {
  const baseMs = Date.now();
  function build(ms) {
    return {
      _ms: ms,
      minus(delta) {
        let next = ms;
        if (delta && typeof delta === 'object') {
          if (typeof delta.days === 'number') next -= delta.days * 86400_000;
          if (typeof delta.hours === 'number') next -= delta.hours * 3600_000;
          if (typeof delta.minutes === 'number') next -= delta.minutes * 60_000;
          if (typeof delta.seconds === 'number') next -= delta.seconds * 1000;
        }
        return build(next);
      },
      plus(delta) {
        let next = ms;
        if (delta && typeof delta === 'object') {
          if (typeof delta.days === 'number') next += delta.days * 86400_000;
        }
        return build(next);
      },
      toISO() {
        return new Date(ms).toISOString();
      },
    };
  }
  return build(baseMs);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function summarize(samplesNs) {
  // samplesNs: Array<bigint> of per-iteration durations.
  // Convert to Number (ns) once; 10k of < ~1e6 ns each is safely within
  // float64 integer range.
  const n = samplesNs.length;
  if (n === 0) {
    return { n: 0, mean: 0, p50: 0, p99: 0, stddev: 0, min: 0, max: 0 };
  }
  const arr = new Float64Array(n);
  for (let i = 0; i < n; i++) arr[i] = Number(samplesNs[i]);
  // Mean
  let sum = 0;
  for (let i = 0; i < n; i++) sum += arr[i];
  const mean = sum / n;
  // Stddev (population)
  let sqSum = 0;
  for (let i = 0; i < n; i++) {
    const d = arr[i] - mean;
    sqSum += d * d;
  }
  const stddev = Math.sqrt(sqSum / n);
  // Percentiles (sort once)
  const sorted = Array.from(arr).sort((a, b) => a - b);
  const pick = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
  return {
    n,
    mean,
    p50: pick(0.5),
    p99: pick(0.99),
    stddev,
    min: sorted[0],
    max: sorted[n - 1],
  };
}

// ---------------------------------------------------------------------------
// Bench loop
// ---------------------------------------------------------------------------

function runOne(label, fn, iters, warmup) {
  // Warmup — discarded.
  for (let i = 0; i < warmup; i++) fn();

  if (typeof global.gc === 'function') {
    try {
      global.gc();
    } catch {
      /* ignore */
    }
  }
  const memBefore = process.memoryUsage();
  const samples = new Array(iters);

  for (let i = 0; i < iters; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    const t1 = process.hrtime.bigint();
    samples[i] = t1 - t0;
  }

  const memAfter = process.memoryUsage();
  const stats = summarize(samples);
  return {
    label,
    stats,
    memDelta: {
      rss: memAfter.rss - memBefore.rss,
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      external: memAfter.external - memBefore.external,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);
  const engine = loadEngine();

  process.stderr.write(
    `engine: ${engine.kind} (${engine.source}); mode=${args.mode}; iters=${args.iters}; warmup=${args.warmup}\n`
  );
  if (engine.kind === 'stub') {
    process.stderr.write(
      'NOTE: using built-in fallback resolver. Numbers reflect the harness baseline, not the real SabFlow engine. Wire in `src/lib/sabflow/expressions` once sibling sub-task #4 lands.\n'
    );
  }

  const raw = fs.readFileSync(args.file, 'utf8');
  const doc = JSON.parse(raw);
  const ctx = { $json: doc.fixture.json, $now: makeNow() };

  const workloads = args.workload
    ? doc.workloads.filter((w) => w.id === args.workload)
    : doc.workloads;
  if (workloads.length === 0) die(`no workloads matched (id=${args.workload})`);

  // CSV header.
  const header = [
    'workload',
    'mode',
    'complexity',
    'iters',
    'mean_ns',
    'p50_ns',
    'p99_ns',
    'stddev_ns',
    'min_ns',
    'max_ns',
    'mem_rss_delta_bytes',
    'mem_heap_used_delta_bytes',
    'engine',
  ];
  process.stdout.write(header.join(',') + '\n');

  for (const wl of workloads) {
    const isParseOnlyFixed = wl.parseOnly === true;
    const modesForThis = isParseOnlyFixed
      ? ['parse']
      : args.mode === 'both'
        ? ['parse', 'eval']
        : [args.mode];

    for (const m of modesForThis) {
      let runner;
      if (m === 'parse') {
        runner = () => engine.mod.parse(wl.expression);
      } else {
        // Parse once, time only evaluate — that's the canonical "eval cost"
        // metric. Templates with parse+eval combined would conflate the two.
        const ast = engine.mod.parse(wl.expression);
        runner = () => engine.mod.evaluate(ast, ctx);
      }
      const res = runOne(`${wl.id}:${m}`, runner, args.iters, args.warmup);
      const row = [
        wl.id,
        m,
        wl.complexity ?? '',
        res.stats.n,
        res.stats.mean.toFixed(2),
        res.stats.p50.toFixed(2),
        res.stats.p99.toFixed(2),
        res.stats.stddev.toFixed(2),
        res.stats.min.toFixed(2),
        res.stats.max.toFixed(2),
        res.memDelta.rss,
        res.memDelta.heapUsed,
        engine.kind,
      ];
      process.stdout.write(row.join(',') + '\n');
    }
  }
}

try {
  main();
} catch (err) {
  process.stderr.write(`run.js: fatal: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
