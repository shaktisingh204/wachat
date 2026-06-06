#!/usr/bin/env node
/*
 * Build the ordered in-scope dirty-file work list for the pure-20ui migration
 * and split it into shard JSON files for the rewrite workflow.
 *
 * Scope rules:
 *  - INCLUDE all dirty .tsx under src/app/** EXCEPT route modules: crm, hrm,
 *    hrm-advanced, wachat (dashboard) and wachat, sabcrm (top-level).
 *  - INCLUDE dirty feature components under src/components/** EXCEPT:
 *      vendored design systems: ui, clay, sab-ui   (deleted later, not rewritten)
 *      landing/marketing comps:  landing, landing-v2, landing-3d
 *      design system internals:  sabcrm/20ui
 *  - Order: PARTIALS (settings,user,sabcheckout) -> rest of dashboard -> app routes
 *    -> feature components. Within a tier, fewest-dirty modules first (quick wins).
 */
const fs = require('fs');
const cp = require('child_process');

const EXCLUDE_ROUTE = new Set(['crm', 'crm-advanced', 'hrm', 'hrm-advanced', 'wachat', 'sabcrm']);
const EXCLUDE_COMPONENT = new Set(['ui', 'clay', 'sab-ui', 'landing', 'landing-v2', 'landing-3d', 'sabcrm', 'crm', 'hrm']);

function classify(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const reasons = [];
  const importRe = /import[^;]*?from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const p = m[1];
    if (p === '@/components/ui' || p.startsWith('@/components/ui/') ||
      p.includes('/components/clay') || p.includes('/components/sab-ui') ||
      p.includes('wabasimplify') || p.includes('@/components/zoruui') ||
      p.includes('sabcrm/20ui/compat') || p.includes('sabcrm/20ui/legacy') ||
      p.includes('sabcrm/20ui/zoru')) reasons.push('import');
  }
  if (/<button[\s>]/.test(src)) reasons.push('raw<button>');
  const inputRe = /<input\b([^>]*)>/g;
  while ((m = inputRe.exec(src))) { if (!/type\s*=\s*['"]hidden['"]/.test(m[1])) { reasons.push('raw<input>'); break; } }
  if (/<select[\s>]/.test(src)) reasons.push('raw<select>');
  if (/<textarea[\s>]/.test(src)) reasons.push('raw<textarea>');
  if (/<table[\s>]/.test(src)) reasons.push('raw<table>');
  if (/style=\{\{/.test(src)) reasons.push('inlineStyle');
  if (/['"`\s]zoruui['"`\s]/.test(src) || /className\s*=\s*['"][^'"]*\bzoruui\b/.test(src)) reasons.push('zoruuiClass');
  if (/var\(--zoru-/.test(src)) reasons.push('var(--zoru-)');
  return reasons.length ? reasons : null;
}

function moduleOf(f) {
  let mm = f.match(/^src\/app\/dashboard\/([^/]+)/);
  if (mm) return { tier: 'dashboard', mod: mm[1] };
  mm = f.match(/^src\/app\/([^/]+)/);
  if (mm) return { tier: 'app', mod: mm[1] };
  mm = f.match(/^src\/components\/([^/]+)/);
  if (mm) return { tier: 'components', mod: mm[1] };
  return { tier: 'other', mod: 'other' };
}

const files = cp.execSync(`git ls-files 'src/app/**/*.tsx' 'src/components/**/*.tsx'`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

const byModule = {}; // key -> {tier, mod, files:[]}
for (const f of files) {
  const { tier, mod } = moduleOf(f);
  if (tier === 'other') continue;
  if (f.includes('/components/sabcrm/20ui/')) continue;
  if (tier === 'dashboard' && EXCLUDE_ROUTE.has(mod)) continue;
  if (tier === 'app' && EXCLUDE_ROUTE.has(mod)) continue;
  if (tier === 'components' && EXCLUDE_COMPONENT.has(mod)) continue;
  const r = classify(f);
  if (!r) continue;
  const key = `${tier}/${mod}`;
  (byModule[key] = byModule[key] || { tier, mod, files: [] }).files.push(f);
}

// ordering
const PARTIALS = ['dashboard/settings', 'dashboard/user', 'dashboard/sabcheckout'];
const tierRank = { dashboard: 0, app: 1, components: 2 };
const keys = Object.keys(byModule).sort((a, b) => {
  const pa = PARTIALS.indexOf(a), pb = PARTIALS.indexOf(b);
  if (pa !== -1 || pb !== -1) {
    if (pa === -1) return 1; if (pb === -1) return -1; return pa - pb;
  }
  const ta = tierRank[byModule[a].tier], tb = tierRank[byModule[b].tier];
  if (ta !== tb) return ta - tb;
  return byModule[a].files.length - byModule[b].files.length; // fewest dirty first
});

// emit ordered list
const ordered = [];
for (const k of keys) for (const f of byModule[k].files) ordered.push(f);

const outDir = '/tmp/mod20ui/shards';
fs.mkdirSync(outDir, { recursive: true });

// shard boundaries (file counts): small pilot first, then larger waves.
const BOUNDS = (process.env.BOUNDS || '60,300,300,300,400').split(',').map((n) => parseInt(n, 10));

const BRIEF = String.raw`
You are a senior design engineer on SabNode (Next.js 16). GOAL: make this ONE file use ONLY the 20ui
design system. Apply four disciplines: emil-design-eng (motion is built into 20ui, do not hand-roll),
fixing-accessibility (aria labels on icon-only buttons, decorative icons aria-hidden, Field wrapper for
inputs), design-taste-frontend (one accent, one radius, realistic data, ZERO em-dash characters: use
period/comma/hyphen), systematic-debugging (READ the 20ui source before using a component, never guess props).

HARD RULES (breakage tolerance is ON: prioritize 20ui purity + working code over pixel-preservation):
1. Import design-system pieces ONLY from "@/components/sabcrm/20ui". NEVER from: "@/components/ui"
   (shadcn), "@/components/clay", "@/components/sab-ui", "wabasimplify", "@/components/zoruui",
   ".../sabcrm/20ui/compat", ".../legacy", ".../zoru".
2. NO raw HTML control/primitive elements. Replace:
   - <button>  -> Button (or IconButton with a label prop for icon-only)
   - <input>   -> Input (+ Field), <textarea> -> Textarea, <select> -> Select compound
     (Select/SelectTrigger/SelectValue/SelectContent/SelectItem)
   - native checkbox/radio -> Checkbox / Radio (+ RadioGroup)
   - <table>... -> Table primitives: Table, THead, TBody, Tr, Th, Td
   - <a> styled as a button -> Button (asChild NOT supported; wrap or use onClick/Link child)
   - page title blocks (raw <h1>+<p>) -> PageHeader (PageTitle / PageDescription / PageActions)
   - card-like <div> groupings -> Card / CardHeader / CardTitle / CardDescription / CardBody / CardFooter
   - status pills -> Badge / Tag / Dot ; empty data -> EmptyState ; metrics -> StatCard
   Structural layout <div>/<span> for grid/flex are FINE (Tailwind grid/flex). Keep <input type="hidden">.
3. NO inline style={{...}} except genuinely runtime-computed values (chart bar width %, user-picked color).
   Convert the rest to Tailwind + 20ui tokens (text-[var(--st-text)], text-[var(--st-text-secondary)],
   bg-[var(--st-bg-secondary)], border-[var(--st-border)], rounded-[var(--st-radius)]).
4. NO zoru remnants: remove the zoruui className (use ui20 only if a scope is needed); convert
   var(--zoru-COLOR)/hsl(var(--zoru-...)) to 20ui tokens (ink->--st-text, ink-muted->--st-text-secondary,
   ink-subtle->--st-text-tertiary, bg->--st-bg, surface->--st-bg-secondary, line->--st-border,
   danger->--st-danger, success->--st-status-ok, warning->--st-warn, primary->--st-accent; drop hsl()).
5. File inputs/uploads -> "@/components/sabfiles" (SabFilePicker/SabFilePickerButton/SabFileUrlInput),
   never a raw URL field. Do NOT touch app-shell (SabHomeShell/HomeShell) imports if present.
6. Toast: const { toast } = useToast(); toast.success/.error(...) or toast({ title, tone }).
7. Keep ALL functionality, props, the default export + component name, and any "use client". Icons: lucide-react.
`;

function genScript(idx, batch) {
  const filesLiteral = JSON.stringify(batch);
  return `export const meta = {
  name: 'rewrite-shard-${String(idx).padStart(2, '0')}',
  description: 'Pure-20ui rewrite of ${batch.length} dirty files (shard ${idx}). Rewrite-only, self-checked; deterministic scan + fix-pass run by the orchestrator.',
  phases: [ { title: 'Rewrite' } ],
}

const FILES = ${filesLiteral}
const BRIEF = ${JSON.stringify(BRIEF)}

phase('Rewrite')
const SCHEMA = { type: 'object', additionalProperties: false, required: ['file','rewritten','changes'], properties: {
  file: { type: 'string' }, rewritten: { type: 'boolean' },
  changes: { type: 'array', items: { type: 'string' } } } }

const results = await pipeline(
  FILES,
  (file) => agent(
    BRIEF + "\\n\\nTASK: Rewrite this ONE file to pure 20ui: " + file +
    "\\nSteps: (1) Read " + file + ". (2) For EACH 20ui component you will use, READ its source under " +
    "src/components/sabcrm/20ui/ (button.tsx, card.tsx, table.tsx, input.tsx, field.tsx, select-radix.tsx, " +
    "feedback.tsx, badge.tsx, pageheader.tsx, choice.tsx, etc.) and confirm the export name in index.ts. " +
    "NEVER guess a prop or import name. (3) Rewrite " + file + " per the HARD RULES and save with Write. " +
    "(4) SELF-VERIFY before returning: re-read your written file and confirm NO raw <button>/<input(non-hidden)>/" +
    "<select>/<textarea>/<table>, NO style={{ except runtime-computed, NO imports from ui/clay/sab-ui/compat/" +
    "legacy/zoru/zoruui, NO zoruui class, NO var(--zoru-, NO em-dash. Fix before returning. If already pure, " +
    "set rewritten=false. Return the structured result.",
    { label: 'rw:' + file.split('/').slice(-2).join('/'), phase: 'Rewrite', schema: SCHEMA }
  )
)
const clean = results.filter(Boolean)
log('shard ${idx}: ' + clean.length + '/' + FILES.length + ' processed')
return { shard: ${idx}, total: FILES.length, processed: clean.length,
  rewritten: clean.filter(r => r && r.rewritten).length }
`;
}

if (process.argv[2] === '--write') {
  for (const f of fs.readdirSync(outDir)) fs.unlinkSync(`${outDir}/${f}`);
  let idx = 0, pos = 0;
  const manifest = [];
  for (const size of BOUNDS) {
    if (pos >= ordered.length) break;
    const batch = ordered.slice(pos, pos + size);
    fs.writeFileSync(`${outDir}/shard_${String(idx).padStart(2, '0')}.js`, genScript(idx, batch));
    manifest.push({ shard: idx, count: batch.length, range: [pos, pos + batch.length] });
    pos += size; idx++;
  }
  // any remainder -> final shard
  if (pos < ordered.length) {
    const batch = ordered.slice(pos);
    fs.writeFileSync(`${outDir}/shard_${String(idx).padStart(2, '0')}.js`, genScript(idx, batch));
    manifest.push({ shard: idx, count: batch.length, range: [pos, ordered.length] });
    idx++;
  }
  fs.writeFileSync(`${outDir}/manifest.json`, JSON.stringify({ total: ordered.length, shards: manifest, files: ordered }, null, 0));
  console.log(`Wrote ${idx} shard scripts to ${outDir} (total ${ordered.length} files)`);
  for (const m of manifest) console.log(`  shard_${String(m.shard).padStart(2, '0')}.js  ${m.count} files`);
}

// summary
console.log(`In-scope dirty modules: ${keys.length}, files: ${ordered.length}`);
console.log(`\nOrder (tier/module: dirty):`);
let run = 0;
for (const k of keys) {
  run += byModule[k].files.length;
  console.log(`  ${k.padEnd(34)} ${String(byModule[k].files.length).padStart(3)}   (cum ${run})`);
}
