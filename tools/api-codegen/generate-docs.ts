/**
 * In-app developer-reference generator.
 *
 *   src/app/api/docs/_data/catalog.json                     ← all endpoints, one row each
 *   src/app/api/docs/_data/<module>.json                    ← per-module slice
 *   src/app/api/docs/modules/page.tsx                       ← module index (server)
 *   src/app/api/docs/modules/[module]/page.tsx              ← per-module index (dynamic)
 *   src/app/api/docs/modules/[module]/[endpoint]/page.tsx   ← per-endpoint deep page (dynamic)
 *
 * For 11k+ endpoints we do NOT emit a TSX file per endpoint — instead the
 * deep page is a single Server Component that reads the catalog at
 * request time and renders the endpoint matching `[endpoint]` from the
 * URL. That keeps the route table sane (3 files total under
 * `modules/[module]/[endpoint]/`) while still giving every endpoint a
 * crawlable, sharable URL.
 *
 * Each endpoint row in the catalog carries:
 *   - method/path/scope/tier/credits/idempotency/emits
 *   - structured path & query params + whether a body is expected
 *   - code samples in 14+ languages (curl, ts sdk, js, python x2, go,
 *     ruby, php, java, c#, rust, elixir, swift, kotlin, plus a raw .http)
 *
 * The per-endpoint page also mounts `TestEndpointRunner` — a client
 * component that fires a real request through the user's browser
 * against `/api/v1/...` with the API key they paste in.
 */

import type { EndpointSpec } from '../api-manifest/types';
import { manifest } from '../api-manifest/index';
import { GENERATED_HEADER, toOpenApiPath, writeIfChanged } from './util';

/* ── Slug helpers ──────────────────────────────────────────────────────── */

function endpointSlug(spec: EndpointSpec): string {
  const cleanPath = toOpenApiPath(spec.path)
    .replace(/[{}]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
  return `${spec.method.toLowerCase()}--${cleanPath}`;
}

/* ── Catalog row ───────────────────────────────────────────────────────── */

interface CatalogRow {
  id: string;
  module: string;
  slug: string;
  method: string;
  path: string;
  summary: string;
  description: string | null;
  scope: string;
  tier: string;
  credits: number | null;
  idempotent: boolean;
  emits: string[];
  pathParams: Array<{ name: string; type: string; description: string }>;
  queryParams: Array<{ name: string; type: string; required: boolean; description: string }>;
  hasBody: boolean;
}

function rowFor(spec: EndpointSpec): CatalogRow {
  return {
    id: `${spec.method.toLowerCase()}-${toOpenApiPath(spec.path).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
    module: spec.module,
    slug: endpointSlug(spec),
    method: spec.method,
    path: toOpenApiPath(spec.path),
    summary: spec.summary,
    description: spec.description ?? null,
    scope: spec.scope,
    tier: spec.tier,
    credits: spec.credits ?? null,
    idempotent: !!spec.idempotent,
    emits: [...(spec.emits ?? [])],
    pathParams: (spec.pathParams ?? []).map((p) => ({
      name: p.name,
      type: p.schema.type ?? 'string',
      description: p.description ?? '',
    })),
    queryParams: (spec.queryParams ?? []).map((q) => ({
      name: q.name,
      type: q.schema.type ?? 'string',
      required: !!q.required,
      description: q.description ?? '',
    })),
    hasBody: ['POST', 'PATCH', 'PUT'].includes(spec.method),
  };
}

/* ── Page templates ────────────────────────────────────────────────────── */

const MODULE_INDEX_PAGE = `${GENERATED_HEADER}/* eslint-disable */

import catalog from '../../_data/catalog.json';
import { notFound } from 'next/navigation';

// Render on-demand and cache for an hour. Pre-rendering all 11k+
// endpoints at build time is wasteful; rendering on first request +
// caching keeps the build fast and the page fresh.
export const revalidate = 3600;
export const dynamicParams = true;

interface Row {
  module: string;
  slug: string;
  method: string;
  path: string;
  summary: string;
  scope: string;
  tier: string;
}

const rows = catalog as Row[];

export async function generateStaticParams() {
  const modules = new Set(rows.map((r) => r.module));
  return Array.from(modules).map((module) => ({ module }));
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    POST: 'bg-green-500/20 text-green-300 border-green-500/40',
    PATCH: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    PUT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    DELETE: 'bg-red-500/20 text-red-300 border-red-500/40',
  };
  const cls = colors[method] ?? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
  return <span className={'inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ' + cls + ' w-14 text-center'}>{method}</span>;
}

export default async function Page({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const moduleRows = rows
    .filter((r) => r.module === module)
    .sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
  if (moduleRows.length === 0) notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 text-zinc-100">
      <header className="mb-6">
        <a href="/api/docs/modules" className="text-xs text-amber-300 hover:text-amber-200">
          ← All modules
        </a>
        <h1 className="text-3xl font-bold mt-2 capitalize">{module}</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {moduleRows.length} endpoint{moduleRows.length === 1 ? '' : 's'}. Click any row for the
          deep page with code samples in 15+ languages and a live test runner.
        </p>
      </header>

      <ul className="rounded-md border border-zinc-800 divide-y divide-zinc-800">
        {moduleRows.map((r) => (
          <li key={r.slug}>
            <a
              href={'/api/docs/modules/' + module + '/' + r.slug}
              className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-900/50 transition"
            >
              <MethodBadge method={r.method} />
              <code className="font-mono text-sm text-zinc-200 flex-1 truncate">{r.path}</code>
              <span className="text-xs text-zinc-500 hidden md:block truncate max-w-[40%]">
                {r.summary}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
`;

const ENDPOINT_DEEP_PAGE = `${GENERATED_HEADER}/* eslint-disable */

import catalog from '../../../_data/catalog.json';
import { notFound } from 'next/navigation';
import { CodeSamplesTabs } from '../../../_components/CodeSamplesTabs';
import { TestEndpointRunner } from '../../../_components/TestEndpointRunner';
import { buildSamples } from '@/lib/api-platform/sample-builder';

// Render on-demand and cache for an hour. Pre-rendering all 11k+
// endpoints at build time is wasteful; rendering on first request +
// caching keeps the build fast and the page fresh.
export const revalidate = 3600;
export const dynamicParams = true;

interface Row {
  module: string;
  slug: string;
  method: string;
  path: string;
  summary: string;
  description: string | null;
  scope: string;
  tier: string;
  credits: number | null;
  idempotent: boolean;
  emits: string[];
  pathParams: Array<{ name: string; type: string; description: string }>;
  queryParams: Array<{ name: string; type: string; required: boolean; description: string }>;
  hasBody: boolean;
}

const rows = catalog as Row[];

export async function generateStaticParams() {
  // For 11k+ endpoints we render on-demand and let Next.js cache after
  // first hit (\`dynamicParams = true\`).
  return [];
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    POST: 'bg-green-500/20 text-green-300 border-green-500/40',
    PATCH: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    PUT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    DELETE: 'bg-red-500/20 text-red-300 border-red-500/40',
  };
  const cls = colors[method] ?? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
  return <span className={'inline-block text-xs font-bold px-2 py-0.5 rounded border ' + cls}>{method}</span>;
}

function ParamTable({ title, rows: r }: { title: string; rows: Array<{ name: string; type: string; required?: boolean; description: string }> }) {
  if (!r.length) return null;
  return (
    <div className="my-3">
      <div className="text-xs font-semibold text-zinc-300 mb-1">{title}</div>
      <table className="w-full text-xs border border-zinc-800 rounded-md overflow-hidden">
        <thead className="bg-zinc-900/50 text-zinc-400">
          <tr>
            <th className="text-left px-2 py-1.5">Name</th>
            <th className="text-left px-2 py-1.5">Type</th>
            <th className="text-left px-2 py-1.5">Req.</th>
            <th className="text-left px-2 py-1.5">Description</th>
          </tr>
        </thead>
        <tbody>
          {r.map((p) => (
            <tr key={p.name} className="border-t border-zinc-800">
              <td className="px-2 py-1.5 font-mono text-amber-300">{p.name}</td>
              <td className="px-2 py-1.5 font-mono text-zinc-400">{p.type}</td>
              <td className="px-2 py-1.5 text-zinc-400">{p.required ? '✓' : ''}</td>
              <td className="px-2 py-1.5 text-zinc-300">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ module: string; endpoint: string }>;
}) {
  const { module, endpoint } = await params;
  const e = rows.find((r) => r.module === module && r.slug === endpoint);
  if (!e) notFound();

  // Build samples on-demand from the slim catalog row. The builder lives
  // under \`src/lib/api-platform/sample-builder.ts\` so the docs page
  // never needs to reach into \`tools/\` (Turbopack production builds
  // don't include code outside \`src/\`).
  const samples = buildSamples({
    module: e.module,
    method: e.method,
    path: e.path,
    hasBody: e.hasBody,
    idempotent: e.idempotent,
    pathParams: e.pathParams,
    queryParams: e.queryParams,
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 text-zinc-100">
      <nav className="text-xs text-zinc-500 mb-4 flex items-center gap-2">
        <a href="/api/docs/modules" className="hover:text-amber-300">All modules</a>
        <span>›</span>
        <a href={'/api/docs/modules/' + module} className="hover:text-amber-300 capitalize">{module}</a>
        <span>›</span>
        <span className="text-zinc-300 truncate">{e.method} {e.path}</span>
      </nav>

      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MethodBadge method={e.method} />
          <code className="text-sm font-mono">{e.path}</code>
        </div>
        <h1 className="text-2xl font-bold">{e.summary}</h1>
        {e.description ? <p className="text-sm text-zinc-400 mt-1">{e.description}</p> : null}
      </header>

      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/50">Scope: <code className="text-amber-300">{e.scope}</code></span>
        <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/50">Tier: {e.tier}</span>
        {e.credits ? <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/50">{e.credits} credit{e.credits === 1 ? '' : 's'}</span> : null}
        {e.idempotent ? <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/50">Idempotent</span> : null}
        {e.emits.map((ev) => (
          <span key={ev} className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/50">emits <code className="text-amber-300">{ev}</code></span>
        ))}
      </div>

      <ParamTable title="Path parameters" rows={e.pathParams.map((p) => ({ ...p, required: true }))} />
      <ParamTable title="Query parameters" rows={e.queryParams} />
      {e.hasBody ? <p className="text-xs text-zinc-400 my-2">Request body: <span className="font-mono">application/json</span></p> : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Code samples</h2>
        <CodeSamplesTabs samples={samples} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Try it</h2>
        <TestEndpointRunner
          method={e.method}
          path={e.path}
          pathParams={e.pathParams}
          queryParams={e.queryParams}
          hasBody={e.hasBody}
        />
      </section>
    </div>
  );
}
`;

const MODULES_INDEX_PAGE = (
  modules: Array<{ name: string; count: number }>,
  total: number,
): string => `${GENERATED_HEADER}/* eslint-disable */

export const dynamic = 'force-static';

const modules: Array<{ name: string; count: number }> = ${JSON.stringify(modules)};
const total = ${total};

export default function Page() {
  return (
    <div className="zoruui min-h-screen bg-zoru-bg text-zoru-ink">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zoru-ink">API Reference</h1>
          <p className="text-sm text-zoru-ink-muted mt-2">
            {total.toLocaleString()} endpoints across {modules.length} module group{modules.length === 1 ? '' : 's'}.
            Each endpoint has its own page with code samples in 15+ languages and a live test runner.
          </p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((m) => (
            <a
              key={m.name}
              href={'/api/docs/modules/' + m.name}
              className="block p-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface text-zoru-ink shadow-[var(--zoru-shadow-sm)] transition-[border-color,box-shadow,background-color] hover:bg-zoru-surface-2 hover:border-zoru-line-strong hover:shadow-[var(--zoru-shadow-md)]"
            >
              <div className="text-[14px] font-medium capitalize text-zoru-ink">{m.name}</div>
              <div className="text-[12.5px] text-zoru-ink-muted mt-1">{m.count.toLocaleString()} endpoint{m.count === 1 ? '' : 's'}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

/* ── Public entry ──────────────────────────────────────────────────────── */

export function generateDocs(): { wrote: boolean; relPaths: string[] } {
  const written: string[] = [];
  const catalog = manifest.endpoints.map(rowFor);

  // Catalog file consumed by the dynamic pages.
  const catalogJson = JSON.stringify(catalog);
  if (writeIfChanged('src/app/api/docs/_data/catalog.json', catalogJson).wrote) {
    written.push('src/app/api/docs/_data/catalog.json');
  }

  // Per-module slice (handy for tooling, not required by pages).
  const byModule = new Map<string, CatalogRow[]>();
  for (const row of catalog) {
    const ex = byModule.get(row.module);
    if (ex) ex.push(row);
    else byModule.set(row.module, [row]);
  }

  // Module index.
  const moduleStats = Array.from(byModule.entries())
    .map(([name, rows]) => ({ name, count: rows.length }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const total = catalog.length;
  if (writeIfChanged('src/app/api/docs/modules/page.tsx', MODULES_INDEX_PAGE(moduleStats, total)).wrote) {
    written.push('src/app/api/docs/modules/page.tsx');
  }

  // Dynamic per-module + per-endpoint pages.
  if (writeIfChanged('src/app/api/docs/modules/[module]/page.tsx', MODULE_INDEX_PAGE).wrote) {
    written.push('src/app/api/docs/modules/[module]/page.tsx');
  }
  if (writeIfChanged('src/app/api/docs/modules/[module]/[endpoint]/page.tsx', ENDPOINT_DEEP_PAGE).wrote) {
    written.push('src/app/api/docs/modules/[module]/[endpoint]/page.tsx');
  }

  return { wrote: written.length > 0, relPaths: written };
}
