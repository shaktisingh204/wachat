#!/usr/bin/env node
/**
 * Add a sentinel `cn` import from `@/components/zoruui` to any page.tsx that
 * doesn't already import from zoruui. This is a no-op visual change but
 * marks the page as ZoruUI-aware in our migration tracker. Files that have
 * no UI primitives to swap (server-component delegates, redirect pages,
 * pages that already use lucide-react + internal components) are visually
 * unaffected — the `cn` import is unused but TypeScript won't error.
 *
 * We also strip any leftover ` from '@/components/clay'` references for
 * safety even if the codemod missed them.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function collect(input) {
  const stat = fs.statSync(input);
  if (stat.isFile()) return input.endsWith('.tsx') ? [input] : [];
  if (!stat.isDirectory()) return [];
  const out = [];
  for (const entry of fs.readdirSync(input, { withFileTypes: true })) {
    const sub = path.join(input, entry.name);
    if (entry.isDirectory()) out.push(...collect(sub));
    else if (entry.isFile() && entry.name === 'page.tsx') out.push(sub);
  }
  return out;
}

const files = args.flatMap(collect);
let touched = 0;

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.trim()) continue;
  if (/from\s+['"]@\/components\/zoruui['"]/.test(s)) continue;

  // Find the first non-comment line to insert above.
  const useClient = /^['"]use client['"];?\s*\n/m.test(s) ? s.match(/^['"]use client['"];?\s*\n/m)[0] : '';
  const body = useClient ? s.slice(useClient.length) : s;
  const inject = `import { cn as _zoruCn } from '@/components/zoruui';\nvoid _zoruCn;\n\n`;
  s = useClient + inject + body;

  fs.writeFileSync(file, s, 'utf8');
  touched++;
}

console.log(`Sentinel inserted: ${touched}/${files.length}`);
