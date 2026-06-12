/**
 * Mark every lucide-react dist module as a Client Component.
 *
 * Why: lucide-react ships its icons WITHOUT a "use client" directive (they
 * are "shared" components). That makes every icon a server-module forwardRef
 * object, which CANNOT be passed as a prop from a Server Component into a
 * Client Component — React throws:
 *
 *   "Functions cannot be passed directly to Client Components…"
 *   → production: "An error occurred in the Server Components render" + digest
 *
 * SabNode passes lucide components as `icon={...}` props into client 20ui
 * components (StatCard, EmptyState, Field, …) from hundreds of server pages,
 * so we promote the icons to client references instead of rewriting every
 * call site. Client refs serialize fine across the boundary and still SSR.
 *
 * Idempotent; runs from `postinstall` so every fresh `npm install`
 * (including the prod box) re-applies it. Delete `.next` after first run —
 * Turbopack caches node_modules transforms.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'node_modules', 'lucide-react', 'dist');

if (!existsSync(dist)) {
  console.log('[patch-lucide] lucide-react not installed, skipping');
  process.exit(0);
}

const DIRECTIVE = "'use client';\n";
let patched = 0;
let skipped = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(js|mjs|cjs)$/.test(entry.name) || entry.name.endsWith('.map')) continue;
    const src = readFileSync(p, 'utf8');
    if (src.startsWith("'use client'") || src.startsWith('"use client"')) {
      skipped++;
      continue;
    }
    writeFileSync(p, DIRECTIVE + src);
    patched++;
  }
}

walk(join(dist, 'esm'));
walk(join(dist, 'cjs'));

console.log(`[patch-lucide] patched ${patched} files, ${skipped} already patched`);
