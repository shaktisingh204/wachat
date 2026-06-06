#!/usr/bin/env node
/*
 * Per-file "pure-20ui" residual scanner.
 * Flags a .tsx file as NOT-pure-20ui if it has any of:
 *  - import from a non-20ui design system (@/components/ui, clay, sab-ui, wabasimplify,
 *    /compat, /legacy, /zoru, @/components/zoruui)
 *  - raw interactive/semantic HTML primitive: <button <input(non-hidden) <select <textarea <table
 *  - inline style={{ ... }}  (any — agent decides which are runtime-legit)
 *  - zoruui className token  OR  var(--zoru-
 * Groups counts by top-level module so we can batch the migration.
 *
 * Usage:
 *   node .20ui-dezoru/scan-residuals.js              # summary table, all modules
 *   node .20ui-dezoru/scan-residuals.js <path>       # list dirty files under <path>
 *   node .20ui-dezoru/scan-residuals.js --json <path>
 */
const fs = require('fs');
const cp = require('child_process');

const EXCLUDE_MODULES = new Set(['crm', 'hrm', 'hrm-advanced', 'wachat', 'sabcrm', '_components', '_domain']);

function classify(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
  // strip block + line comments and string-literal contents so we don't false-positive
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``'); // strip template-literal contents (email/HTML templates)
  const reasons = [];

  // 1. bad design-system imports
  const importRe = /import[^;]*?from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const p = m[1];
    if (
      p === '@/components/ui' || p.startsWith('@/components/ui/') ||
      p.includes('/components/clay') ||
      p.includes('/components/sab-ui') ||
      p.includes('wabasimplify') ||
      p === '@/components/zoruui' || p.startsWith('@/components/zoruui/') ||
      p.includes('sabcrm/20ui/compat') ||
      p.includes('sabcrm/20ui/legacy') ||
      p.includes('sabcrm/20ui/zoru')
    ) reasons.push('import:' + p);
  }

  // 2. raw interactive/semantic primitives (JSX open tags)
  if (/<button[\s>]/.test(src)) reasons.push('raw<button>');
  // input that is NOT type="hidden"
  const inputRe = /<input\b([^>]*)>/g;
  while ((m = inputRe.exec(src))) {
    if (!/type\s*=\s*['"]hidden['"]/.test(m[1])) { reasons.push('raw<input>'); break; }
  }
  if (/<select[\s>]/.test(src)) reasons.push('raw<select>');
  if (/<textarea[\s>]/.test(src)) reasons.push('raw<textarea>');
  if (/<table[\s>]/.test(src)) reasons.push('raw<table>');

  // 3. inline styles
  if (/style=\{\{/.test(src)) reasons.push('inlineStyle');

  // 4. zoru remnants
  if (/['"`\s]zoruui['"`\s]/.test(src) || /className\s*=\s*['"][^'"]*\bzoruui\b/.test(src)) reasons.push('zoruuiClass');
  if (/var\(--zoru-/.test(src)) reasons.push('var(--zoru-)');

  return reasons.length ? reasons : null;
}

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const pathArg = args.filter((a) => a !== '--json')[0];

const globs = pathArg
  ? [`${pathArg}/**/*.tsx`, `${pathArg}/*.tsx`]
  : [`src/app/**/*.tsx`, `src/components/**/*.tsx`];

let files = [];
try {
  files = cp.execSync(`git ls-files ${globs.map((g) => `'${g}'`).join(' ')}`, { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
} catch (e) { files = []; }

function moduleOf(f) {
  // src/app/dashboard/<mod>/...  OR  src/app/<mod>/...  OR  src/components/<mod>/...
  let mm = f.match(/^src\/app\/dashboard\/([^/]+)/);
  if (mm) return 'dashboard/' + mm[1];
  mm = f.match(/^src\/app\/([^/]+)/);
  if (mm) return 'app/' + mm[1];
  mm = f.match(/^src\/components\/([^/]+)/);
  if (mm) return 'components/' + mm[1];
  return 'other';
}

const perModule = {};
const dirtyFiles = [];
for (const f of files) {
  const mod = moduleOf(f);
  const modLeaf = mod.split('/').pop();
  if (EXCLUDE_MODULES.has(modLeaf)) continue;
  if (f.includes('/components/sabcrm/20ui/')) continue; // DS internals
  if (!perModule[mod]) perModule[mod] = { total: 0, dirty: 0, reasons: {} };
  perModule[mod].total++;
  const r = classify(f);
  if (r) {
    perModule[mod].dirty++;
    dirtyFiles.push({ file: f, reasons: r });
    for (const reason of r) {
      const key = reason.split(':')[0];
      perModule[mod].reasons[key] = (perModule[mod].reasons[key] || 0) + 1;
    }
  }
}

if (pathArg) {
  if (jsonOut) { console.log(JSON.stringify(dirtyFiles, null, 0)); }
  else {
    console.log(`Dirty files under ${pathArg}: ${dirtyFiles.length}`);
    for (const d of dirtyFiles) console.log(`  ${d.file}  [${[...new Set(d.reasons.map((x) => x.split(':')[0]))].join(',')}]`);
  }
  process.exit(0);
}

const rows = Object.entries(perModule)
  .filter(([, v]) => v.dirty > 0)
  .sort((a, b) => b[1].dirty - a[1].dirty);
let totalDirty = 0, totalFiles = 0;
for (const [, v] of Object.entries(perModule)) { totalDirty += v.dirty; totalFiles += v.total; }
console.log(`MODULE                              dirty/total   reasons`);
for (const [mod, v] of rows) {
  const rs = Object.entries(v.reasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ');
  console.log(`${mod.padEnd(35)} ${String(v.dirty).padStart(4)}/${String(v.total).padStart(4)}    ${rs}`);
}
console.log(`\nTOTAL dirty: ${totalDirty} / ${totalFiles} scanned (modules with >0 dirty: ${rows.length})`);
