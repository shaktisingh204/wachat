#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * SabFlow editor perf-regression bench runner.
 *
 * NOT wired to CI. Local-only until baselines are filled in.
 *
 * Usage:
 *   node benches/sabflow-editor-perf/run.js                 # all scenarios, Playwright
 *   node benches/sabflow-editor-perf/run.js --only=cold-load
 *   node benches/sabflow-editor-perf/run.js --driver=puppeteer
 *   node benches/sabflow-editor-perf/run.js --base=http://localhost:3000 \
 *     --storageState=./.auth/state.json --out=./bench-out/run-$(date +%s).json
 *
 * Dependencies (NOT installed at repo root by design — see README):
 *   npm i -D playwright              # default driver
 *     or
 *   npm i -D puppeteer-core          # alternative; bring your own Chromium path
 *
 * What this script does NOT do:
 *   - It does not boot the Next.js dev server. Start it yourself (`npm run dev`)
 *     or point --base at a preview deployment.
 *   - It does not seed fixtures. Fixture files live in ./fixtures/ and must
 *     match scenarios.json `setup.doc` references.
 *   - It does not gate PRs. The exit code is informational.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2).reduce((acc, raw) => {
  const m = raw.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) acc[m[1]] = m[2] === undefined ? true : m[2];
  return acc;
}, {});

const DRIVER = String(argv.driver || 'playwright').toLowerCase();
const BASE_URL = String(argv.base || process.env.SABFLOW_BENCH_BASE || 'http://localhost:3000');
const OUT_PATH = String(argv.out || path.join(__dirname, 'bench-out', `run-${Date.now()}.json`));
const ONLY = argv.only ? String(argv.only).split(',').map((s) => s.trim()) : null;
const STORAGE_STATE = argv.storageState ? path.resolve(String(argv.storageState)) : null;
const HEADLESS = argv.headed ? false : true;

const scenariosPath = path.join(__dirname, 'scenarios.json');
const config = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));

const scenarios = (ONLY
  ? config.scenarios.filter((s) => ONLY.includes(s.id))
  : config.scenarios);

if (!scenarios.length) {
  console.error('No scenarios matched --only=%s', argv.only);
  process.exit(2);
}

/* ------------------------------------------------------------------ driver loader */

async function loadDriver() {
  if (DRIVER === 'playwright') {
    try {
      // eslint-disable-next-line global-require, import/no-unresolved
      return { kind: 'playwright', mod: require('playwright') };
    } catch (e) {
      console.error(
        '\n[bench] `playwright` not installed.\n' +
        '       Install it locally (not at repo root) for this bench only:\n' +
        '         npm i -D playwright\n' +
        '       Or rerun with --driver=puppeteer.\n'
      );
      process.exit(127);
    }
  }
  if (DRIVER === 'puppeteer') {
    try {
      // eslint-disable-next-line global-require, import/no-unresolved
      return { kind: 'puppeteer', mod: require('puppeteer-core') };
    } catch (e) {
      console.error(
        '\n[bench] `puppeteer-core` not installed.\n' +
        '       npm i -D puppeteer-core\n' +
        '       Also set CHROME_PATH to your Chromium binary.\n'
      );
      process.exit(127);
    }
  }
  console.error('Unknown driver: %s', DRIVER);
  process.exit(2);
}

/* ------------------------------------------------------------------ in-page collector */

/**
 * Injected into the page before navigation. Captures:
 *   - web-vitals (LCP, CLS, INP) via PerformanceObserver
 *   - rAF-based frame intervals → fps + dropped frames
 *   - longtask buffer
 *   - performance.memory snapshots
 *
 * No npm deps on the page side — pure DOM APIs.
 */
function collectorInit() {
  // eslint-disable-next-line no-underscore-dangle
  window.__sabflowBench = {
    lcp: 0,
    cls: 0,
    inp: 0,
    longTasksMs: 0,
    frameStamps: [],
    domNodesStart: document.getElementsByTagName('*').length,
    heapStart: (performance.memory && performance.memory.usedJSHeapSize) || 0,
    startTs: performance.now(),
  };

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__sabflowBench.lcp = entry.startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__sabflowBench.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const dur = entry.processingEnd - entry.startTime;
        if (dur > window.__sabflowBench.inp) window.__sabflowBench.inp = dur;
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__sabflowBench.longTasksMs += entry.duration;
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}

  let last = performance.now();
  const tick = (now) => {
    window.__sabflowBench.frameStamps.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function collectorRead() {
  const b = window.__sabflowBench;
  const frames = b.frameStamps;
  const intervals = frames.filter((d) => d > 0);
  const avgInterval = intervals.reduce((a, b2) => a + b2, 0) / Math.max(1, intervals.length);
  const fpsAvg = avgInterval > 0 ? 1000 / avgInterval : 0;
  const sorted = intervals.slice().sort((a, b2) => b2 - a);
  const p1Interval = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const fpsP1 = p1Interval > 0 ? 1000 / p1Interval : 0;
  const dropped = intervals.filter((d) => d > 1000 / 50).length; // missed sub-50fps frames
  const heapEnd = (performance.memory && performance.memory.usedJSHeapSize) || 0;

  return {
    lcp_ms: b.lcp,
    cls: b.cls,
    inp_ms: b.inp,
    long_tasks_ms: b.longTasksMs,
    fps_avg: Number(fpsAvg.toFixed(2)),
    fps_p1: Number(fpsP1.toFixed(2)),
    frames_dropped: dropped,
    js_heap_delta_mb: Number(((heapEnd - b.heapStart) / 1024 / 1024).toFixed(2)),
    dom_node_delta: document.getElementsByTagName('*').length - b.domNodesStart,
    sample_ms: performance.now() - b.startTs,
  };
}

/* ------------------------------------------------------------------ interaction primitives (page-side) */

async function pwDrag(page, sel, durationMs, radiusPx, stepsPerSecond) {
  const handle = await page.waitForSelector(sel, { timeout: 5000 });
  const box = await handle.boundingBox();
  if (!box) throw new Error(`No bounding box for ${sel}`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const totalSteps = Math.floor((durationMs / 1000) * stepsPerSecond);
  const stepDelay = durationMs / totalSteps;
  for (let i = 0; i < totalSteps; i++) {
    const t = (i / totalSteps) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(t) * radiusPx, cy + Math.sin(t) * radiusPx);
    await new Promise((r) => setTimeout(r, stepDelay));
  }
  await page.mouse.up();
}

async function pwPaste(page, payloadPath, sel, settleMs) {
  const abs = path.resolve(__dirname, payloadPath);
  const data = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '[]';
  await page.focus(sel).catch(() => {});
  await page.evaluate(({ data: d, sel: s }) => {
    const target = document.querySelector(s) || document.activeElement || document.body;
    const dt = new DataTransfer();
    dt.setData('application/x-sabflow-clipboard', d);
    dt.setData('text/plain', d);
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { data, sel });
  await new Promise((r) => setTimeout(r, settleMs));
}

async function pwOplogBurst(page, updatesPath, deliverWindowMs) {
  const abs = path.resolve(__dirname, updatesPath);
  const updates = fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, 'utf8')) : [];
  await page.evaluate(({ updates: u, win: w }) => {
    const hook = window.__sabflowOplogHook;
    if (typeof hook !== 'function') {
      console.warn('[bench] window.__sabflowOplogHook not exposed by editor — skipping');
      return;
    }
    const step = w / Math.max(1, u.length);
    u.forEach((upd, i) => setTimeout(() => hook(upd), Math.floor(i * step)));
  }, { updates, win: deliverWindowMs });
  await new Promise((r) => setTimeout(r, deliverWindowMs + 500));
}

/* ------------------------------------------------------------------ scenario runner */

async function runScenarioPlaywright(pw, scenario) {
  const browser = await pw.chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: STORAGE_STATE || undefined,
  });
  const page = await context.newPage();

  await page.addInitScript(collectorInit);

  if (scenario.setup.wsBlockPattern) {
    await context.route(scenario.setup.wsBlockPattern, (route) => route.abort());
  }

  const url = new URL(scenario.setup.path, BASE_URL).toString();
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  for (const step of scenario.interactions || []) {
    if (step.type === 'drag') {
      await pwDrag(page, step.selector, step.durationMs, step.radiusPx, step.stepsPerSecond);
    } else if (step.type === 'paste') {
      await pwPaste(page, step.payload, step.targetSelector, step.settleMs || 1000);
    } else if (step.type === 'wsDisconnect') {
      await new Promise((r) => setTimeout(r, step.durationMs));
      if (scenario.setup.wsBlockPattern) await context.unroute(scenario.setup.wsBlockPattern);
    } else if (step.type === 'oplogBurst') {
      await pwOplogBurst(page, step.updates, step.deliverWindowMs);
    } else if (step.type === 'waitForIdle') {
      await page.waitForLoadState('networkidle', { timeout: step.timeoutMs }).catch(() => {});
    }
  }

  // Settle one rAF cycle before sampling
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  const metrics = await page.evaluate(collectorRead);
  metrics.wall_ms = Date.now() - t0;

  await context.close();
  await browser.close();
  return metrics;
}

/* ------------------------------------------------------------------ budget eval */

function evalBudget(metrics, budget) {
  const violations = [];
  for (const [key, limits] of Object.entries(budget || {})) {
    const v = metrics[key];
    if (typeof v !== 'number') continue;
    // fps_* budgets are LOWER bounds, everything else is an upper bound.
    const isLowerBound = key.startsWith('fps_');
    for (const [pct, bound] of Object.entries(limits)) {
      const ok = isLowerBound ? v >= bound : v <= bound;
      if (!ok) violations.push({ metric: key, percentile: pct, value: v, bound });
    }
  }
  return violations;
}

/* ------------------------------------------------------------------ main */

(async () => {
  const { kind, mod } = await loadDriver();
  if (kind !== 'playwright') {
    console.error('[bench] puppeteer driver is documented but not implemented in this commit. See README.');
    process.exit(2);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  const runs = [];
  let totalViolations = 0;

  for (const scenario of scenarios) {
    console.log(`\n[bench] ▶ ${scenario.id} — ${scenario.label}`);
    const samples = [];
    const N = config.common.measuredRuns || 5;
    const W = config.common.warmupRuns || 1;
    for (let i = 0; i < W; i++) {
      console.log(`  warmup ${i + 1}/${W}`);
      await runScenarioPlaywright(mod, scenario);
    }
    for (let i = 0; i < N; i++) {
      console.log(`  run ${i + 1}/${N}`);
      const m = await runScenarioPlaywright(mod, scenario);
      samples.push(m);
    }
    const aggregate = aggregateSamples(samples, config.common.reportPercentiles);
    const violations = evalBudget(aggregate.p99 || {}, scenario.budget);
    totalViolations += violations.length;
    runs.push({ id: scenario.id, samples, aggregate, violations, budget: scenario.budget });
    for (const v of violations) {
      console.log(`    ✗ ${v.metric} p${v.percentile} = ${v.value} (budget ${v.bound})`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    driver: DRIVER,
    runs,
    summary: { scenarios: runs.length, violations: totalViolations },
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n[bench] wrote ${OUT_PATH}`);
  console.log(`[bench] ${totalViolations} budget violation(s) — informational only (no CI gate yet)`);
  process.exit(0);
})().catch((err) => {
  console.error('[bench] fatal:', err);
  process.exit(1);
});

function aggregateSamples(samples, percentiles) {
  if (!samples.length) return {};
  const keys = Object.keys(samples[0]).filter((k) => typeof samples[0][k] === 'number');
  const out = {};
  for (const pct of percentiles) out[`p${pct}`] = {};
  out.mean = {};
  for (const k of keys) {
    const vals = samples.map((s) => s[k]).sort((a, b) => a - b);
    out.mean[k] = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3));
    for (const pct of percentiles) {
      const idx = Math.min(vals.length - 1, Math.floor((pct / 100) * vals.length));
      out[`p${pct}`][k] = vals[idx];
    }
  }
  return out;
}
