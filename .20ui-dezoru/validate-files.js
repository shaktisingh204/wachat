#!/usr/bin/env node
/*
 * Validate a specific list of files (a shard) for pure-20ui residuals.
 * Separates HARD residuals (must reach 0: bad DS imports, raw interactive
 * primitives, zoru remnants) from SOFT (inline styles, em-dash: best-effort,
 * runtime inline styles are allowed).
 *
 * Usage:
 *   node .20ui-dezoru/validate-files.js <files.json>        # human summary
 *   node .20ui-dezoru/validate-files.js <files.json> --hard-json  # JSON list of files w/ HARD residuals
 *   node .20ui-dezoru/validate-files.js --shard <NN>        # validate shard NN from manifest
 */
const fs = require('fs');

let EXCEPTIONS = {};
try { EXCEPTIONS = JSON.parse(fs.readFileSync('.20ui-dezoru/exceptions.json', 'utf8')); } catch {}

function classify(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return { missing: true, hard: [], soft: [] }; }
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``');
  const hard = [], soft = [];
  const importRe = /import[^;]*?from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const p = m[1];
    if (p === '@/components/ui' || p.startsWith('@/components/ui/') ||
      p.includes('/components/clay') || p.includes('/components/sab-ui') ||
      p.includes('wabasimplify') || p === '@/components/zoruui' || p.startsWith('@/components/zoruui/') ||
      p.includes('sabcrm/20ui/compat') || p.includes('sabcrm/20ui/legacy') ||
      p.includes('sabcrm/20ui/zoru')) hard.push('import:' + p);
  }
  if (/<button[\s>]/.test(src)) hard.push('raw<button>');
  const inputRe = /<input\b([^>]*)>/g;
  while ((m = inputRe.exec(src))) {
    const a = m[1];
    // hidden form fields + native file inputs (no 20ui primitive; SabFiles/dropzone plumbing) are legit
    if (/type\s*=\s*['"](hidden|file)['"]/.test(a) || /getInputProps/.test(a)) continue;
    hard.push('raw<input>'); break;
  }
  if (/<select[\s>]/.test(src)) hard.push('raw<select>');
  if (/<textarea[\s>]/.test(src)) hard.push('raw<textarea>');
  if (/<table[\s>]/.test(src)) hard.push('raw<table>');
  if (/['"`\s]zoruui['"`\s]/.test(src) || /className\s*=\s*['"][^'"]*\bzoruui\b/.test(src)) hard.push('zoruuiClass');
  if (/var\(--zoru-/.test(src)) hard.push('var(--zoru-)');
  // soft
  const styleCount = (src.match(/style=\{\{/g) || []).length;
  if (styleCount) soft.push('inlineStyle:' + styleCount);
  if (/[—]/.test(raw)) soft.push('em-dash');
  const exc = EXCEPTIONS[file] || [];
  return { missing: false, hard: hard.filter((r) => !exc.includes(r.split(':')[0])), soft };
}

const args = process.argv.slice(2);
let files;
if (args[0] === '--shard') {
  const man = JSON.parse(fs.readFileSync('/tmp/mod20ui/shards/manifest.json', 'utf8'));
  const sh = man.shards.find((s) => s.shard === parseInt(args[1], 10));
  files = man.files.slice(sh.range[0], sh.range[1]);
} else {
  files = JSON.parse(fs.readFileSync(args[0], 'utf8'));
}
const hardJson = args.includes('--hard-json');

const hardFiles = [], softFiles = [], gone = [];
for (const f of files) {
  const c = classify(f);
  if (c.missing) { gone.push(f); continue; }
  if (c.hard.length) hardFiles.push({ file: f, hard: c.hard });
  else if (c.soft.length) softFiles.push({ file: f, soft: c.soft });
}

if (hardJson) { console.log(JSON.stringify(hardFiles.map((h) => h.file))); process.exit(0); }

console.log(`Validated ${files.length} files.`);
console.log(`  HARD residuals (must fix): ${hardFiles.length}`);
for (const h of hardFiles) console.log(`    ${h.file}  [${h.hard.join(', ')}]`);
console.log(`  SOFT residuals (inline style / em-dash, best-effort): ${softFiles.length}`);
if (process.env.SHOW_SOFT) for (const s of softFiles) console.log(`    ${s.file}  [${s.soft.join(', ')}]`);
if (gone.length) console.log(`  (deleted/renamed since plan: ${gone.length})`);
console.log(`\nGATE: HARD=${hardFiles.length} (target 0), SOFT=${softFiles.length}`);
