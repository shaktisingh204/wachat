#!/usr/bin/env node
/*
 * Fast missing-export checker for the 20ui design system.
 * Resolves the FULL export set of compat.ts and index.ts (following relative
 * `export *`/`export {} from` chains), then flags any consumer that imports a
 * name the module does not actually export. Seconds, vs a 10-min tsc.
 *
 * This catches exactly the bundler-breaking class ("export X doesn't exist").
 * Usage: node .20ui-dezoru/check-imports.js
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const DS = 'src/components/sabcrm/20ui';
const cache = new Map();

function resolveFile(spec, fromFile) {
  let s = spec;
  if (s.startsWith('@/')) s = s.replace('@/', 'src/');
  if (s.startsWith('.')) s = path.join(path.dirname(fromFile), s);
  else if (!s.startsWith('src/')) return null; // external package
  for (const cand of [s + '.ts', s + '.tsx', path.join(s, 'index.ts'), path.join(s, 'index.tsx'), s]) {
    try { if (fs.statSync(cand).isFile()) return cand; } catch {}
  }
  return null;
}

function exportsOf(file, seen = new Set()) {
  if (cache.has(file)) return cache.get(file);
  if (seen.has(file)) return { names: new Set(), wildcard: false };
  seen.add(file);
  const res = { names: new Set(), wildcard: false };
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { return res; }
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); // strip comments so block-splitting is clean

  for (const m of src.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    const f = resolveFile(m[1], file);
    if (!f) { res.wildcard = true; continue; }
    const sub = exportsOf(f, seen);
    sub.names.forEach((n) => res.names.add(n));
    if (sub.wildcard) res.wildcard = true;
  }
  for (const m of src.matchAll(/export\s*(?:type\s+)?\{([^}]*)\}/g)) {
    for (let s of m[1].split(',')) {
      s = s.trim().replace(/^type\s+/, '');
      if (!s) continue;
      const as = s.match(/\s+as\s+([A-Za-z0-9_]+)$/);
      res.names.add(as ? as[1] : s);
    }
  }
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:const|let|var|function\*?|class|interface|type|enum|abstract\s+class)\s+([A-Za-z0-9_]+)/g)) {
    res.names.add(m[1]);
  }
  if (/export\s+default/.test(src)) res.names.add('default');
  cache.set(file, res);
  return res;
}

const compat = exportsOf(path.join(DS, 'compat.ts'));
const barrel = exportsOf(path.join(DS, 'index.ts'));

const files = cp.execSync(`git grep -l "@/components/sabcrm/20ui" -- 'src/**/*.tsx' 'src/**/*.ts'`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

const missing = {};
for (const f of files) {
  if (f.includes('sabcrm/20ui/')) continue; // skip DS internals
  let src = fs.readFileSync(f, 'utf8');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*?)\}\s*from\s*['"](@\/components\/sabcrm\/20ui(?:\/compat|\/zoru)?)['"]/sg)) {
    const mod = m[2];
    let set;
    if (mod.endsWith('/compat')) set = compat;
    else if (mod.endsWith('/zoru')) continue; // legacy barrel, handled separately
    else set = barrel;
    if (set.wildcard) continue;
    for (let s of m[1].split(',')) {
      s = s.trim().replace(/^type\s+/, '').replace(/\s+as\s+.*$/, '').trim();
      if (!s) continue;
      if (!set.names.has(s)) (missing[s] = missing[s] || []).push(f);
    }
  }
}

const ents = Object.entries(missing).sort((a, b) => b[1].length - a[1].length);
console.log(`compat exports: ${compat.names.size}${compat.wildcard ? ' (+wildcard!)' : ''}; barrel exports: ${barrel.names.size}${barrel.wildcard ? ' (+wildcard!)' : ''}`);
console.log(`MISSING-EXPORT names (imported but not exported): ${ents.length}`);
for (const [n, fl] of ents) console.log(`  ${String(fl.length).padStart(4)}  ${n}`);
