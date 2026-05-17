/**
 * Generate one `route.ts` per logical Next.js path from the manifest.
 *
 * Multiple HTTP methods on the same path collapse into a single route file
 * with multiple named exports — Next.js Route Handler convention.
 *
 * Each generated file:
 *   - Carries the `@generated` header.
 *   - Sets `export const dynamic = 'force-dynamic'` + `runtime = 'nodejs'`.
 *   - Imports `withApiV1` from `@/lib/api-platform`.
 *   - For `delegate.kind === 'handler'`: imports the named export from a
 *     co-located `_handlers.ts`. The handler file is NOT generated — it's
 *     hand-written.
 *   - For `delegate.kind === 'inline'`: emits the body directly.
 *
 * Other delegate kinds (action, rust, rust-fwd) are stubbed in Phase 0 and
 * will be implemented when the first endpoint needs them.
 */

import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import type { EndpointSpec } from '../api-manifest/types';
import { manifest } from '../api-manifest/index';
import { GENERATED_HEADER, REPO_ROOT, pathToFolder, writeIfChanged } from './util';

interface RouteFile {
  /** Folder relative to `src/app/api/v1`. */
  folder: string;
  /** All specs that share this folder (different HTTP methods). */
  specs: EndpointSpec[];
}

function groupByFolder(specs: ReadonlyArray<EndpointSpec>): RouteFile[] {
  const byFolder = new Map<string, EndpointSpec[]>();
  for (const spec of specs) {
    const folder = pathToFolder(spec.path);
    const existing = byFolder.get(folder);
    if (existing) existing.push(spec);
    else byFolder.set(folder, [spec]);
  }
  const out: RouteFile[] = [];
  for (const [folder, group] of byFolder) {
    // Sort methods so the emitted file is deterministic.
    group.sort((a, b) => a.method.localeCompare(b.method));
    out.push({ folder, specs: group });
  }
  out.sort((a, b) => a.folder.localeCompare(b.folder));
  return out;
}

/** Map a Next.js dynamic-segment path to a JS template-literal that
 *  interpolates path params from the runtime `params` object. */
function pathToTemplate(rustPath: string): string {
  return rustPath.replace(/\{([^}]+)\}/g, (_, name) =>
    `\${encodeURIComponent(String((params as Record<string, string>).${name} ?? ''))}`,
  );
}

/** Render the `withApiV1(...)` call for a single spec. */
function renderHandler(spec: EndpointSpec): string {
  const opts = `{ scope: '${spec.scope}'${
    spec.skipRateLimit ? ', rateLimit: false' : ''
  } }`;

  switch (spec.delegate.kind) {
    case 'inline': {
      if (spec.delegate.name === 'me') {
        return [
          `export const ${spec.method} = withApiV1(async (_req, { ctx }) => {`,
          `  return NextResponse.json({`,
          `    tenant_id: ctx.tenantId,`,
          `    scopes: ctx.scopes,`,
          `    tier: ctx.tier,`,
          `  });`,
          `}, ${opts});`,
        ].join('\n');
      }
      throw new Error(`Unknown inline delegate: ${spec.delegate.name}`);
    }
    case 'handler': {
      return `export const ${spec.method} = withApiV1(${spec.delegate.export}, ${opts});`;
    }
    case 'rust-fwd': {
      // The Rust path may use `{name}` placeholders. We accept either
      // Next.js (`[name]`) or OpenAPI (`{name}`) syntax in the manifest
      // so spec authors don't have to think about which.
      const normalised = spec.delegate.path.replace(/\[([^\]]+)\]/g, '{$1}');
      const pathBody = pathToTemplate(normalised);
      // Single template literal: path body + query-string suffix. The
      // suffix is an interpolated expression, NOT a second backtick.
      // Embedded `${...}` placeholders use `\${...}` so they survive
      // serialisation through this string itself.
      const fullPath = '`' + pathBody + '${qs ? `?${qs}` : \'\'}`';
      const method = spec.delegate.method;
      const hasBody = ['POST', 'PATCH', 'PUT'].includes(method);
      const lines = [
        `export const ${spec.method} = withApiV1(async (req, { ctx, params }) => {`,
        hasBody
          ? `  let body: unknown = undefined;\n  try { body = await req.json(); } catch { body = undefined; }`
          : `  void params;`,
        `  const url = new URL(req.url);`,
        `  const qs = url.searchParams.toString();`,
        `  const path = ${fullPath};`,
        `  const data = await rustFetchAsUser<unknown>(`,
        `    ctx.tenantId,`,
        `    path,`,
        `    {`,
        `      method: '${method}',`,
        hasBody ? `      body: body === undefined ? undefined : JSON.stringify(body),` : '',
        `    },`,
        `  );`,
        `  return NextResponse.json(data);`,
        `}, ${opts});`,
      ];
      return lines.filter(Boolean).join('\n');
    }
    case 'action':
    case 'rust':
      throw new Error(
        `Delegate kind '${spec.delegate.kind}' is not implemented yet. ` +
          'Use `rust-fwd` for pass-through Rust endpoints or `handler` for ' +
          'endpoints that need shaping logic.',
      );
  }
}

/** Build the file body for a `route.ts`. */
function renderFile(group: RouteFile): string {
  const needsNextResponse = group.specs.some(
    (s) => s.delegate.kind === 'inline' || s.delegate.kind === 'rust-fwd',
  );
  const needsRustFwd = group.specs.some((s) => s.delegate.kind === 'rust-fwd');

  // Bucket handler imports by source module so a single route can pull from
  // multiple handler files (rare, but useful when a path mixes local and
  // shared logic).
  const importsByFrom = new Map<string, Set<string>>();
  for (const s of group.specs) {
    if (s.delegate.kind !== 'handler') continue;
    const from = s.delegate.from ?? './_handlers';
    const set = importsByFrom.get(from) ?? new Set<string>();
    set.add(s.delegate.export);
    importsByFrom.set(from, set);
  }

  const lines: string[] = [GENERATED_HEADER, '/* eslint-disable */'];

  // Imports.
  if (needsNextResponse) lines.push(`import { NextResponse } from 'next/server';`);
  lines.push(`import { withApiV1 } from '@/lib/api-platform';`);
  if (needsRustFwd) {
    lines.push(`import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';`);
  }
  const fromKeys = Array.from(importsByFrom.keys()).sort();
  for (const from of fromKeys) {
    const names = Array.from(importsByFrom.get(from)!).sort();
    lines.push(`import { ${names.join(', ')} } from '${from}';`);
  }
  lines.push('');

  // Route segment config.
  lines.push(`export const dynamic = 'force-dynamic';`);
  lines.push(`export const runtime = 'nodejs';`);
  lines.push('');

  // Handlers.
  for (const spec of group.specs) {
    lines.push(`// ${spec.summary}  (scope: ${spec.scope}, tier: ${spec.tier})`);
    lines.push(renderHandler(spec));
    lines.push('');
  }

  return lines.join('\n');
}

export interface GenerateRoutesResult {
  written: string[];
  unchanged: string[];
  removed: string[];
}

const GENERATED_MARKER = '// @generated by tools/api-codegen';
const V1_REL = 'src/app/api/v1';

/** Walk `src/app/api/v1` and yield every `route.ts` path (absolute). */
function findGeneratedRouteFiles(): string[] {
  const root = resolve(REPO_ROOT, V1_REL);
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = resolve(dir, name);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(full);
      else if (name === 'route.ts') {
        const head = readFileSync(full, 'utf8').slice(0, GENERATED_MARKER.length);
        if (head === GENERATED_MARKER) out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

/** Delete `dir` if it (recursively) contains nothing but empty children. */
function rmIfEmptyTree(dir: string): boolean {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const name of entries) {
    const full = resolve(dir, name);
    const s = statSync(full);
    if (s.isFile()) return false;
    if (s.isDirectory() && !rmIfEmptyTree(full)) return false;
  }
  // All children either empty or removed — remove this dir too.
  try {
    rmSync(dir, { recursive: false });
    return true;
  } catch {
    return false;
  }
}

export function generateRoutes(): GenerateRoutesResult {
  const groups = groupByFolder(manifest.endpoints);
  const written: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];

  /* 1. Write/update routes for every spec. */
  const wantedAbs = new Set<string>();
  for (const group of groups) {
    const relPath = `${V1_REL}/${group.folder}/route.ts`;
    wantedAbs.add(resolve(REPO_ROOT, relPath));
    const body = renderFile(group);
    const { wrote } = writeIfChanged(relPath, body);
    if (wrote) written.push(relPath);
    else unchanged.push(relPath);
  }

  /* 2. Delete @generated routes that no longer have a manifest entry.
   *    Hand-written routes (without the `@generated` marker) are
   *    preserved — only the codegen's own emissions get pruned. */
  for (const abs of findGeneratedRouteFiles()) {
    if (wantedAbs.has(abs)) continue;
    try {
      rmSync(abs);
      removed.push(abs.slice(REPO_ROOT.length + 1));
    } catch {
      /* ignore */
    }
  }

  /* 3. Clean up empty parent directories left over from removals. */
  const v1Root = resolve(REPO_ROOT, V1_REL);
  // Walk depth-first and try to remove each empty dir up to v1Root.
  const dfsClean = (dir: string): void => {
    if (dir === v1Root) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = resolve(dir, name);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) dfsClean(full);
    }
    rmIfEmptyTree(dir);
  };
  dfsClean(v1Root);

  return { written, unchanged, removed };
}
