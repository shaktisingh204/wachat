#!/usr/bin/env node
/**
 * Post-codemod fixer: cleans up the most common tsc errors after the bulk
 * Clay→Zoru pass.
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
  const original = s;

  // 1. Dedupe import lines from '@/components/zoruui'. Merge multiple imports
  //    into one and drop duplicate names.
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@\/components\/zoruui['"];?/g;
  const importMatches = [...s.matchAll(importRegex)];
  if (importMatches.length > 1) {
    const all = new Set();
    for (const m of importMatches) {
      m[1].split(',').map((n) => n.trim()).filter(Boolean).forEach((n) => all.add(n));
    }
    // Remove all import lines, then prepend a single merged one.
    s = s.replace(importRegex, '');
    // Strip the orphaned comma-only lines / blank lines collapse to single.
    s = s.replace(/\n{3,}/g, '\n\n');
    const sorted = [...all].sort();
    const useClient = /^['"]use client['"];?\s*\n/m.test(s)
      ? s.match(/^['"]use client['"];?\s*\n/m)[0]
      : '';
    const body = useClient ? s.slice(useClient.length) : s;
    s = `${useClient}import { ${sorted.join(', ')} } from '@/components/zoruui';\n${body}`;
  }

  // 2. Remove `ZoruBadge` (and other Zoru* items) from any non-zoruui import
  //    that was scoped to a relative `_components/*` path. The codemod's
  //    blanket `Badge → ZoruBadge` rename caught these incorrectly.
  s = s.replace(
    /import\s*\{([^}]+)\}\s*from\s*(['"])(?!@\/components\/zoruui)([.@\/\w-]+)\2;?/g,
    (full, body, _q, src) => {
      const names = body.split(',').map((n) => n.trim()).filter(Boolean);
      const zoruNames = names.filter((n) => /^Zoru/.test(n));
      const otherNames = names.filter((n) => !/^Zoru/.test(n));
      if (zoruNames.length === 0) return full;
      const lines = [];
      if (otherNames.length > 0) {
        lines.push(`import { ${otherNames.join(', ')} } from '${src}';`);
      }
      lines.push(`import { ${zoruNames.join(', ')} } from '@/components/zoruui';`);
      return lines.join('\n');
    },
  );
  // After step 2, dedupe imports again (we may have just appended a duplicate
  // zoruui import).
  const importMatches2 = [...s.matchAll(importRegex)];
  if (importMatches2.length > 1) {
    const all = new Set();
    for (const m of importMatches2) {
      m[1].split(',').map((n) => n.trim()).filter(Boolean).forEach((n) => all.add(n));
    }
    s = s.replace(importRegex, '');
    s = s.replace(/\n{3,}/g, '\n\n');
    const sorted = [...all].sort();
    const useClient = /^['"]use client['"];?\s*\n/m.test(s)
      ? s.match(/^['"]use client['"];?\s*\n/m)[0]
      : '';
    const body = useClient ? s.slice(useClient.length) : s;
    s = `${useClient}import { ${sorted.join(', ')} } from '@/components/zoruui';\n${body}`;
  }

  // 3. Fix `<ZoruButton ... leadingSlot={X}>Y</ZoruButton>` →
  //    `<ZoruButton ...>{X}Y</ZoruButton>`. ZoruButton has no leadingSlot
  //    prop; the icon goes inline as a child.
  //    We also handle `trailingSlot={X}` → `Y{X}`.
  //    Multi-line buttons: process each <ZoruButton ...>...</ZoruButton>
  //    block.
  s = s.replace(
    /<ZoruButton([^>]*?)\sleadingSlot=\{([^}]+)\}([^>]*)>([\s\S]*?)<\/ZoruButton>/g,
    (_, before, icon, after, body) => {
      return `<ZoruButton${before}${after}>{${icon}}${body}</ZoruButton>`;
    },
  );
  s = s.replace(
    /<ZoruButton([^>]*?)\strailingSlot=\{([^}]+)\}([^>]*)>([\s\S]*?)<\/ZoruButton>/g,
    (_, before, icon, after, body) => {
      return `<ZoruButton${before}${after}>${body}{${icon}}</ZoruButton>`;
    },
  );

  // 4. Fix `<ZoruBadge tone="x">` → `<ZoruBadge variant="x">` (in case our
  //    earlier tone regex missed any variants like tone={var}).
  s = s.replace(/<ZoruBadge([^>]*?)\stone=("[^"]+")/g, '<ZoruBadge$1 variant=$2');
  s = s.replace(/<ZoruBadge([^>]*?)\stone=\{([^}]+)\}/g, '<ZoruBadge$1 variant={$2}');

  // 5. Strip ` variant="floating"` and other unknown ClayCard variants.
  s = s.replace(/\svariant="floating"/g, '');
  s = s.replace(/\svariant="soft"/g, '');
  s = s.replace(/\svariant="elevated"/g, '');
  s = s.replace(/\svariant="plain"/g, '');

  if (s !== original) {
    fs.writeFileSync(file, s, 'utf8');
    touched++;
  }
}

console.log(`Fixer: touched ${touched}/${files.length}`);
