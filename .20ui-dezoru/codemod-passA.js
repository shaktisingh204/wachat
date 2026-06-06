#!/usr/bin/env node
/*
 * De-zoru Pass A — remove Zoru* NAMES from consumers (import-aware, compat only).
 *
 * For every `import { ... } from '@/components/sabcrm/20ui/compat'`, rename each
 * specifier that is a known compat alias (ZoruX -> clean 20ui name) to its clean
 * name, and rename its usages in the file body. Import PATH is left as compat
 * (compat re-exports every clean name via `export *`, so this never breaks the
 * bundler). Path swap + compat deletion happen in later passes.
 *
 * Safety:
 *  - Only touches names imported from compat (never /zoru or other modules).
 *  - Skips a file if a rename would collide with an existing binding (logs it).
 *  - Dedupes `X as X` and duplicate specifiers produced by the rename.
 *
 * Usage: node codemod-passA.js <file|dir> [more...]
 */
const fs = require('fs');
const path = require('path');

const MAP = {};
for (const line of fs.readFileSync('/tmp/dezoru-map.txt', 'utf8').split('\n')) {
  const m = line.match(/^(\S+)\s*=>\s*(\S+)$/);
  if (m) MAP[m[1]] = m[2];
}
const COMPAT_RE = /['"]@\/components\/sabcrm\/20ui\/compat['"]/;
const IMPORT_RE = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]@\/components\/sabcrm\/20ui\/compat['"]\s*;?/g;
const ANY_IMPORT_RE = /import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"][^'"]+['"]/g;

function listFiles(target) {
  const out = [];
  const st = fs.statSync(target);
  if (st.isFile()) {
    if (/\.(tsx?|jsx?)$/.test(target)) out.push(target);
    return out;
  }
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    const p = path.join(target, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || p.includes('/sabcrm/20ui/')) continue; // never the DS internals
      out.push(...listFiles(p));
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Collect every locally-bound imported identifier in the file (to detect collisions). */
function existingBindings(src) {
  const set = new Set();
  let m;
  ANY_IMPORT_RE.lastIndex = 0;
  while ((m = ANY_IMPORT_RE.exec(src))) {
    if (m[1]) set.add(m[1]); // default import
    if (m[2]) {
      for (const spec of m[2].split(',')) {
        const s = spec.trim().replace(/^type\s+/, '');
        if (!s) continue;
        const as = s.match(/\s+as\s+([A-Za-z0-9_]+)$/);
        set.add(as ? as[1] : s);
      }
    }
  }
  return set;
}

let changed = 0;
const collisions = [];
const targets = process.argv.slice(2).flatMap(listFiles);

for (const f of targets) {
  let src = fs.readFileSync(f, 'utf8');
  if (!COMPAT_RE.test(src)) continue;

  const bareRenames = {}; // ZoruName(local==imported) -> clean  (need body rename)
  let collided = false;

  // First pass: figure out renames + collision, without writing.
  let probe = src.replace(IMPORT_RE, (full, typeKw, body) => {
    for (const raw of body.split(',')) {
      const spec = raw.trim();
      if (!spec) continue;
      const asM = spec.match(/^(type\s+)?([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)$/);
      if (asM) continue; // aliased: body uses the local alias already; only specifier text changes (no body rename, no collision)
      const bare = spec.replace(/^type\s+/, '');
      if (MAP[bare]) bareRenames[bare] = MAP[bare];
    }
    return full;
  });

  const bindings = existingBindings(src);
  for (const [zoru, clean] of Object.entries(bareRenames)) {
    // collision if the clean target is already bound by some OTHER import/declaration
    if (bindings.has(clean) && clean !== zoru) {
      collided = true;
      collisions.push(`${f}: rename ${zoru}->${clean} collides with existing binding`);
    }
  }
  if (collided) continue; // leave file for manual handling

  // Apply: rewrite compat import specifiers...
  let out = src.replace(IMPORT_RE, (full, typeKw, body) => {
    const specs = body.split(',').map((s) => s.trim()).filter(Boolean);
    const mapped = specs.map((spec) => {
      const asM = spec.match(/^(type\s+)?([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)$/);
      if (asM) {
        const [, tk, imported, local] = asM;
        if (MAP[imported]) {
          const clean = MAP[imported];
          return clean === local ? `${tk || ''}${clean}` : `${tk || ''}${clean} as ${local}`;
        }
        return spec;
      }
      const tk = /^type\s+/.test(spec) ? 'type ' : '';
      const bare = spec.replace(/^type\s+/, '');
      if (MAP[bare]) return `${tk}${MAP[bare]}`;
      return spec;
    });
    // dedupe by local-name
    const seen = new Set();
    const deduped = [];
    for (const s of mapped) {
      const key = s.replace(/^type\s+/, '').replace(/\s+as\s+.*$/, (x) => x); // keep full for `as`
      const localKey = s.replace(/^type\s+/, '');
      if (seen.has(localKey)) continue;
      seen.add(localKey);
      deduped.push(s);
    }
    return `import ${typeKw || ''}{ ${deduped.join(', ')} } from '@/components/sabcrm/20ui/compat';`;
  });

  // ...then rename bare usages in the body.
  for (const [zoru, clean] of Object.entries(bareRenames)) {
    out = out.replace(new RegExp(`\\b${zoru}\\b`, 'g'), clean);
  }

  if (out !== src) {
    fs.writeFileSync(f, out);
    changed++;
  }
}

console.log(`changed files: ${changed}`);
console.log(`collision skips: ${collisions.length}`);
for (const c of collisions.slice(0, 40)) console.log('  ' + c);
