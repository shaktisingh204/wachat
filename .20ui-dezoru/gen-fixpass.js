#!/usr/bin/env node
/*
 * Generate a targeted fix-pass workflow for files that still have HARD residuals
 * after the rewrite shard. One agent per file: re-read, fix the specific residual,
 * self-verify. Emits /tmp/mod20ui/shards/fix_<tag>.js
 *
 * Usage: node .20ui-dezoru/gen-fixpass.js <hardFiles.json> <tag>
 */
const fs = require('fs');
const files = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const tag = process.argv[3] || 'x';
if (!files.length) { console.log('NO_FIX_NEEDED'); process.exit(0); }

const BRIEF = String.raw`You are a senior 20ui design engineer on SabNode. This file STILL has residual non-20ui usage after a first pass. Make it PURE 20ui. RULES: import design pieces ONLY from "@/components/sabcrm/20ui" (NEVER ui/clay/sab-ui/wabasimplify/zoruui/compat/legacy/zoru). Replace raw <button>->Button/IconButton, <input>->Input(+Field) [keep <input type=hidden>], <textarea>->Textarea, <select>->Select compound, <table>->Table/THead/TBody/Tr/Th/Td. Remove zoruui className and var(--zoru-*) -> 20ui --st-* tokens. Inline style={{}} only for runtime-computed values; convert the rest to Tailwind + --st-* tokens. ZERO em-dash. Keep ALL functionality, props, default export, "use client". READ src/components/sabcrm/20ui/index.ts + the component source before using anything; never guess prop/export names.`;

const script = `export const meta = {
  name: 'fixpass-${tag}',
  description: 'Targeted fix-pass: drive HARD residuals to 0 for ${files.length} files.',
  phases: [ { title: 'Fix' } ],
}
const FILES = ${JSON.stringify(files)}
const BRIEF = ${JSON.stringify(BRIEF)}
phase('Fix')
const SCHEMA = { type: 'object', additionalProperties: false, required: ['file','fixed'], properties: {
  file: { type: 'string' }, fixed: { type: 'boolean' }, residualsRemaining: { type: 'array', items: { type: 'string' } } } }
const r = await pipeline(FILES, (file) => agent(
  BRIEF + "\\n\\nTASK: Fix " + file + ". (1) Read it and identify every raw primitive / bad import / zoru remnant / non-runtime inline style. (2) Read the relevant 20ui source to get exact names. (3) Rewrite with Write so it is PURE 20ui. (4) Re-read and confirm zero hard residuals before returning.",
  { label: 'fix:' + file.split('/').slice(-2).join('/'), phase: 'Fix', schema: SCHEMA }))
log('fixpass ${tag}: ' + r.filter(Boolean).length + '/' + FILES.length)
return { fixed: r.filter(x => x && x.fixed).length, total: FILES.length }
`;
const out = `/tmp/mod20ui/shards/fix_${tag}.js`;
fs.writeFileSync(out, script);
console.log(out + '  (' + files.length + ' files)');
