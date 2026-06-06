#!/usr/bin/env node
/*
 * De-zoru Pass B — move consumers off the `/compat` bridge onto the clean barrel.
 *
 * For each file importing from '@/components/sabcrm/20ui/compat', if EVERY name it
 * imports from compat is also exported by the clean barrel (index.ts), rewrite the
 * import path to '@/components/sabcrm/20ui'. Files that still use a legacy/bridge-only
 * name (ZoruFileUploadCard, ZoruChart, zoruToast, CardContent, ...) are left on
 * compat for Wave 2. Names are NOT changed — only the module path. Very low risk;
 * validated by the fast import checker afterward.
 *
 * Usage: node .20ui-dezoru/codemod-passB.js <dir>
 */
const fs = require('fs');
const path = require('path');

const DS = 'src/components/sabcrm/20ui';
const cache = new Map();
function resolveFile(spec, from) {
  let s = spec;
  if (s.startsWith('@/')) s = s.replace('@/', 'src/');
  if (s.startsWith('.')) s = path.join(path.dirname(from), s);
  else if (!s.startsWith('src/')) return null;
  for (const c of [s + '.ts', s + '.tsx', path.join(s, 'index.ts'), path.join(s, 'index.tsx'), s]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}
function exportsOf(file, seen = new Set()) {
  if (cache.has(file)) return cache.get(file);
  if (seen.has(file)) return { names: new Set(), wild: false };
  seen.add(file);
  const res = { names: new Set(), wild: false };
  let s; try { s = fs.readFileSync(file, 'utf8'); } catch { return res; }
  s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const m of s.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    const f = resolveFile(m[1], file);
    if (!f) { res.wild = true; continue; }
    const sub = exportsOf(f, seen);
    sub.names.forEach((n) => res.names.add(n));
    if (sub.wild) res.wild = true;
  }
  for (const m of s.matchAll(/export\s*(?:type\s+)?\{([^}]*)\}/g))
    for (let x of m[1].split(',')) {
      x = x.trim().replace(/^type\s+/, ''); if (!x) continue;
      const a = x.match(/\s+as\s+([A-Za-z0-9_]+)$/); res.names.add(a ? a[1] : x);
    }
  for (const m of s.matchAll(/export\s+(?:declare\s+)?(?:const|let|var|function\*?|class|interface|type|enum|abstract\s+class)\s+([A-Za-z0-9_]+)/g))
    res.names.add(m[1]);
  if (/export\s+default/.test(s)) res.names.add('default');
  cache.set(file, res);
  return res;
}

const barrel = exportsOf(path.join(DS, 'index.ts'));

function listFiles(target) {
  const out = [];
  let st; try { st = fs.statSync(target); } catch { return out; }
  if (st.isFile()) { if (/\.(tsx?|jsx?)$/.test(target)) out.push(target); return out; }
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    const p = path.join(target, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || p.includes('/sabcrm/20ui/')) continue; out.push(...listFiles(p)); }
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const COMPAT = '@/components/sabcrm/20ui/compat';
let swapped = 0, leftOnCompat = 0;
for (const f of listFiles(process.argv[2] || 'src')) {
  let src = fs.readFileSync(f, 'utf8');
  if (!src.includes(COMPAT)) continue;
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  // gather every name imported from compat across all compat import statements
  let allBarrelSafe = true, sawAny = false;
  for (const m of clean.matchAll(/import\s*(?:type\s*)?\{([^}]*?)\}\s*from\s*['"]@\/components\/sabcrm\/20ui\/compat['"]/sg)) {
    sawAny = true;
    for (let s of m[1].split(',')) {
      s = s.trim().replace(/^type\s+/, '').replace(/\s+as\s+.*$/, '').trim();
      if (!s) continue;
      if (!barrel.names.has(s)) { allBarrelSafe = false; break; }
    }
    if (!allBarrelSafe) break;
  }
  // also catch side-effect / default / namespace compat imports — only swap the {named} form here
  if (sawAny && allBarrelSafe) {
    const out = src.replace(/(['"])@\/components\/sabcrm\/20ui\/compat\1/g, '$1@/components/sabcrm/20ui$1');
    if (out !== src) { fs.writeFileSync(f, out); swapped++; }
  } else if (sawAny) {
    leftOnCompat++;
  }
}
console.log(`barrel exports: ${barrel.names.size}${barrel.wild ? ' (+wildcard)' : ''}`);
console.log(`Pass B swapped to clean barrel: ${swapped}`);
console.log(`left on compat (use legacy/bridge names): ${leftOnCompat}`);
