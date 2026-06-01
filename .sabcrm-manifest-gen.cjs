#!/usr/bin/env node
/* Port-manifest generator: walks the vendored Twenty monorepo and emits a
 * deterministic map of every source file -> its SabCRM (Next.js+Mongo) target
 * path + port status. Source of truth for the 1:1 port burndown. No API cost. */
const fs = require('fs');
const path = require('path');

const ENGINE = path.resolve(__dirname, 'services/sabcrm/packages');
const OUT_JSON = path.resolve(__dirname, 'docs/sabcrm-port/manifest.json');
const OUT_MD = path.resolve(__dirname, 'SABCRM_PORT_MANIFEST.md');

// Package -> target root + scope tier. Backend-first ordering via `order`.
const PKG = {
  'twenty-shared':                  { tgt: 'src/lib/sabcrm/shared',        tier: 'core',   order: 1 },
  'twenty-server':                  { tgt: 'src/lib/sabcrm/server',        tier: 'core',   order: 2 },
  'twenty-emails':                  { tgt: 'src/lib/sabcrm/emails',        tier: 'core',   order: 3 },
  'twenty-ui':                      { tgt: 'src/components/sabcrm/ui',      tier: 'core',   order: 4 },
  'twenty-front':                   { tgt: 'src/app+components/sabcrm',     tier: 'core',   order: 5 },
  'twenty-front-component-renderer':{ tgt: 'src/components/sabcrm/renderer',tier: 'sdk',    order: 6 },
  'twenty-sdk':                     { tgt: 'src/lib/sabcrm/sdk',            tier: 'sdk',    order: 7 },
  'twenty-client-sdk':              { tgt: 'src/lib/sabcrm/client-sdk',     tier: 'sdk',    order: 8 },
  'twenty-apps':                    { tgt: 'src/lib/sabcrm/apps',           tier: 'apps',   order: 9 },
  'twenty-website':                 { tgt: 'src/app/sabcrm-site',           tier: 'site',   order: 10 },
  'twenty-zapier':                  { tgt: 'src/lib/sabcrm/zapier',         tier: 'misc',   order: 11 },
  'twenty-cli':                     { tgt: 'src/lib/sabcrm/cli',            tier: 'misc',   order: 12 },
  'create-twenty-app':              { tgt: 'src/lib/sabcrm/create-app',     tier: 'misc',   order: 13 },
  'twenty-utils':                   { tgt: 'src/lib/sabcrm/utils',          tier: 'misc',   order: 14 },
  'twenty-oxlint-rules':            { tgt: 'tooling/sabcrm-lint',           tier: 'misc',   order: 15 },
  'twenty-e2e-testing':             { tgt: 'e2e/sabcrm',                    tier: 'misc',   order: 16 },
  'twenty-docs':                    { tgt: 'docs/sabcrm',                   tier: 'misc',   order: 17 },
  'twenty-claude-skills':           { tgt: 'SKIP',                          tier: 'skip',   order: 99 },
  'twenty-companion':               { tgt: 'SKIP',                          tier: 'skip',   order: 99 },
  'twenty-docker':                  { tgt: 'SKIP',                          tier: 'skip',   order: 99 },
};

// Files that PORT (need rewriting) vs that are config/asset (carry or skip).
const CODE = /\.(ts|tsx|js|jsx)$/;
const SKIP_NAME = /\.(spec|test|stories)\.(ts|tsx|js|jsx)$/;
const SKIP_DIR = /(^|\/)(node_modules|dist|build|\.next|coverage|__generated__|generated)(\/|$)/;

function walk(dir, acc) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ENGINE, full);
    if (SKIP_DIR.test('/' + rel.replace(/\\/g, '/'))) continue;
    if (e.isDirectory()) walk(full, acc);
    else acc.push(rel.replace(/\\/g, '/'));
  }
  return acc;
}

// Map a server sub-path to a meaningful Mongo target kind.
function classify(pkg, relInPkg) {
  if (pkg === 'twenty-server') {
    if (/\.entity\.ts$/.test(relInPkg)) return 'entity->mongo-schema';
    if (/\.resolver\.ts$/.test(relInPkg)) return 'resolver->action';
    if (/\.service\.ts$/.test(relInPkg)) return 'service';
    if (/\.module\.ts$/.test(relInPkg)) return 'module-wiring';
    if (/migrations?\//.test(relInPkg)) return 'pg-migration->mongo-index/seed';
    if (/\.dto\.ts$/.test(relInPkg)) return 'dto';
    if (/\.input\.ts$|\.args\.ts$/.test(relInPkg)) return 'graphql-input->zod';
    return 'server-logic';
  }
  if (pkg === 'twenty-front') {
    if (/\/pages\//.test(relInPkg)) return 'page->route';
    if (/\/components\//.test(relInPkg) && /\.tsx$/.test(relInPkg)) return 'component->zoruui';
    if (/\/states\//.test(relInPkg)) return 'recoil/jotai->store';
    if (/\/hooks\//.test(relInPkg)) return 'hook';
    if (/\/graphql\//.test(relInPkg)) return 'gql->action-call';
    if (/\/utils\//.test(relInPkg)) return 'util';
    return 'front-logic';
  }
  if (pkg === 'twenty-ui') return 'emotion->zoruui';
  if (CODE.test(relInPkg)) return 'port';
  return 'config/asset';
}

const all = walk(ENGINE, []);
const rows = [];
for (const rel of all) {
  const parts = rel.split('/');
  const pkg = parts[0];
  const cfg = PKG[pkg];
  if (!cfg) continue;
  const relInPkg = parts.slice(1).join('/');
  const isCode = CODE.test(rel) && !SKIP_NAME.test(rel);
  rows.push({
    src: 'services/sabcrm/packages/' + rel,
    pkg,
    tier: cfg.tier,
    order: cfg.order,
    target: cfg.tgt === 'SKIP' ? 'SKIP' : cfg.tgt + '/' + relInPkg.replace(/\.(ts|tsx)$/, m => m),
    kind: cfg.tgt === 'SKIP' ? 'skip' : (isCode ? classify(pkg, relInPkg) : 'config/asset'),
    code: isCode,
    status: cfg.tgt === 'SKIP' ? 'skip' : 'pending',
  });
}

// Per-package summary.
const summary = {};
for (const r of rows) {
  const s = summary[r.pkg] || (summary[r.pkg] = { pkg: r.pkg, tier: r.tier, order: r.order, total: 0, code: 0, pending: 0, skip: 0 });
  s.total++;
  if (r.code) s.code++;
  if (r.status === 'pending') s.pending++;
  if (r.status === 'skip') s.skip++;
}
const summaryArr = Object.values(summary).sort((a, b) => a.order - b.order);

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedFrom: 'services/sabcrm (Twenty v0.2.1)', totalFiles: rows.length, codeFiles: rows.filter(r => r.code).length, rows }, null, 0));

const totalCode = rows.filter(r => r.code && r.status !== 'skip').length;
let md = '';
md += '# SabCRM — Twenty → Next.js + MongoDB Port Manifest\n\n';
md += '> Source of truth for the **full 1:1 port** of Twenty to SabNode\'s stack (Next.js + MongoDB).\n';
md += '> Generated from the vendored Twenty at `services/sabcrm/` (v0.2.1). Machine-generated — re-run `node .sabcrm-manifest-gen.cjs` to refresh counts as files flip to `ported`/`verified`.\n\n';
md += '**Total files in scope:** ' + rows.filter(r => r.status !== 'skip').length + '  ·  **Code files to port:** ' + totalCode + '  ·  **Ported:** 0  ·  **Verified:** 0  ·  **Progress: 0%**\n\n';
md += 'Full row-level map (every source file → target path + status): `docs/sabcrm-port/manifest.json` (' + rows.length + ' rows).\n\n';
md += '## Burndown by package (backend-first order)\n\n';
md += '| # | Package | Tier | Code files | Ported | Status |\n|---|---|---|---:|---:|---|\n';
for (const s of summaryArr) {
  md += '| ' + (s.order === 99 ? '—' : s.order) + ' | `' + s.pkg + '` | ' + s.tier + ' | ' + s.code + ' | 0 | ' + (s.tier === 'skip' ? '⏭️ skip' : '⏳ pending') + ' |\n';
}
md += '\n## Port rules (how a file is "ported")\n\n';
md += '- `*.entity.ts` (TypeORM/Postgres) → **Mongo schema/collection** (`src/lib/sabcrm/server/**`), preserving every field + relation.\n';
md += '- `*.resolver.ts` (GraphQL) → **Next.js server action / route handler**, same inputs/outputs.\n';
md += '- `*.service.ts` → server logic on Mongo; `*.module.ts` → wiring/registry.\n';
md += '- Postgres migrations → Mongo **index/seed** equivalents (data shape preserved).\n';
md += '- `twenty-ui` Emotion components → **ZoruUI** (black-&-white) with the same props/behavior.\n';
md += '- `twenty-front` pages → `/sabcrm` **App Router routes**; components → ZoruUI; Recoil/Jotai → SabNode store; GraphQL calls → action calls.\n';
md += '- Each source file maps to a target file; **status flips pending → ported → verified** (typecheck/tests).\n\n';
md += '## Phase order (backend-first, your choice)\n\n';
md += '1. **twenty-shared** (types/utils) — foundation everything imports.\n';
md += '2. **twenty-server** — entities→Mongo schemas, then services, resolvers→actions, metadata engine (78 core + 73 metadata + 18 business modules).\n';
md += '3. **twenty-emails**, **twenty-ui** — shared presentation.\n';
md += '4. **twenty-front** (6,894 files) — screens onto the ported backend.\n';
md += '5. **SDKs + component-renderer**, **twenty-apps** (integrations), **twenty-website**, misc.\n\n';
md += '_Each session runs parallel, typecheck-gated workflows that port the next package/module batch and flip its rows to `ported`. This file + the JSON are updated each run so coverage is provable, not asserted._\n';

fs.writeFileSync(OUT_MD, md);
console.log('MANIFEST: ' + rows.length + ' files, ' + totalCode + ' code files to port, ' + summaryArr.length + ' packages.');
console.log('Wrote ' + OUT_MD + ' and ' + OUT_JSON);
