/**
 * Generate a TypeScript SDK from the manifest.
 *
 * Output: `sdks/typescript/src/_generated/client.ts` + `index.ts`.
 *
 * The SDK exposes one method per `EndpointSpec`. Method names are
 * derived from `{module}_{verb}_{resource}` and accept a single typed
 * `params` object — path params, query params, body, and the optional
 * `signal` for cancellation. Calls go through a small `fetch`-based
 * transport that:
 *
 *   - Attaches `Authorization: Bearer <key>` from the constructor.
 *   - Forwards `Idempotency-Key` for endpoints flagged `idempotent`.
 *   - Surfaces `X-RateLimit-*` headers on the response object.
 *   - Throws a typed `SabnodeApiError` containing the RFC 7807 body.
 *
 * No external deps. Targets fetch — works on Node 18+, Bun, Deno, edge,
 * and browsers (CORS permitting).
 */

import type { EndpointSpec } from '../api-manifest/types';
import { manifest } from '../api-manifest/index';
import { GENERATED_HEADER, toOpenApiPath, writeIfChanged } from './util';

function camelize(input: string): string {
  return input.replace(/[-_/]+([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function pascalize(input: string): string {
  const c = camelize(input);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function methodName(spec: EndpointSpec): string {
  const segs = [spec.module, spec.verb, spec.resource];
  return camelize(segs.join('_'));
}

function pathParamNames(spec: EndpointSpec): string[] {
  return (spec.pathParams ?? []).map((p) => p.name);
}

function hasBody(spec: EndpointSpec): boolean {
  return ['POST', 'PATCH', 'PUT'].includes(spec.method);
}

function buildArgType(spec: EndpointSpec): string {
  const fields: string[] = [];
  for (const p of pathParamNames(spec)) fields.push(`${p}: string;`);
  for (const q of spec.queryParams ?? []) {
    const t =
      q.schema.type === 'integer' || q.schema.type === 'number'
        ? 'number'
        : q.schema.type === 'boolean'
          ? 'boolean'
          : 'string';
    fields.push(`${q.name}?: ${t};`);
  }
  if (hasBody(spec)) fields.push(`body?: Record<string, unknown>;`);
  fields.push(`idempotencyKey?: string;`);
  fields.push(`signal?: AbortSignal;`);
  if (fields.length === 2 /* only signal+idempotency */) return '{ signal?: AbortSignal; idempotencyKey?: string } | undefined';
  return `{ ${fields.join(' ')} }`;
}

function renderMethod(spec: EndpointSpec): string {
  const name = methodName(spec);
  const argType = buildArgType(spec);
  // OpenAPI-style path so callers see something familiar in JSDoc.
  const apiPath = toOpenApiPath(spec.path);
  // Build path with template interpolation.
  const pathExpr = pathParamNames(spec).length
    ? '`' +
      apiPath.replace(/\{([^}]+)\}/g, '${encodeURIComponent(args!.$1)}') +
      '`'
    : `'${apiPath}'`;

  const queryNames = (spec.queryParams ?? []).map((q) => q.name);
  const queryBuild = queryNames.length
    ? [
        `    const __qs = new URLSearchParams();`,
        ...queryNames.map(
          (n) => `    if (args?.${n} !== undefined) __qs.set('${n}', String(args.${n}));`,
        ),
        `    const __q = __qs.toString();`,
      ].join('\n')
    : '    const __q = \'\';';

  const bodyExpr = hasBody(spec) ? 'args?.body ?? {}' : 'undefined';

  return [
    `  /**`,
    `   * ${spec.summary}`,
    spec.description ? `   *` : '',
    spec.description ? `   * ${spec.description.replace(/\n/g, '\n   * ')}` : '',
    `   *`,
    `   * \`${spec.method} /api/v1${apiPath}\` — scope: \`${spec.scope}\``,
    `   */`,
    `  async ${name}(args${pathParamNames(spec).length || queryNames.length || hasBody(spec) ? '' : '?'}: ${argType}): Promise<SabnodeResponse<unknown>> {`,
    queryBuild,
    `    return this._request({`,
    `      method: '${spec.method}',`,
    `      path: ${pathExpr} + (__q ? '?' + __q : ''),`,
    `      body: ${bodyExpr},`,
    `      idempotent: ${spec.idempotent ? 'true' : 'false'},`,
    `      idempotencyKey: args?.idempotencyKey,`,
    `      signal: args?.signal,`,
    `    });`,
    `  }`,
    ``,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

function renderClient(): string {
  const methods = manifest.endpoints
    .slice()
    .sort((a, b) => methodName(a).localeCompare(methodName(b)))
    .map(renderMethod)
    .join('\n');

  return [
    GENERATED_HEADER,
    `/* eslint-disable */`,
    ``,
    `export interface SabnodeClientOptions {`,
    `  /** Bearer API key (or PAT, or OAuth access token). */`,
    `  apiKey: string;`,
    `  /** Base URL. Defaults to https://api.sabnode.com/api/v1. */`,
    `  baseUrl?: string;`,
    `  /** Custom fetch (testing / interception). */`,
    `  fetch?: typeof globalThis.fetch;`,
    `}`,
    ``,
    `export interface SabnodeResponse<T> {`,
    `  status: number;`,
    `  headers: Headers;`,
    `  data: T;`,
    `  requestId: string | null;`,
    `  rateLimit: { limit: number | null; remaining: number | null; reset: number | null };`,
    `}`,
    ``,
    `export class SabnodeApiError extends Error {`,
    `  status: number;`,
    `  type: string;`,
    `  detail?: string;`,
    `  requestId: string | null;`,
    `  errors?: Array<{ path: string; message: string }>;`,
    `  body: unknown;`,
    `  constructor(status: number, body: any, requestId: string | null) {`,
    `    super(typeof body?.title === 'string' ? body.title : 'API request failed');`,
    `    this.name = 'SabnodeApiError';`,
    `    this.status = status;`,
    `    this.type = typeof body?.type === 'string' ? body.type : 'unknown';`,
    `    this.detail = typeof body?.detail === 'string' ? body.detail : undefined;`,
    `    this.errors = Array.isArray(body?.errors) ? body.errors : undefined;`,
    `    this.requestId = requestId;`,
    `    this.body = body;`,
    `  }`,
    `}`,
    ``,
    `interface RequestOptions {`,
    `  method: string;`,
    `  path: string;`,
    `  body: unknown;`,
    `  idempotent: boolean;`,
    `  idempotencyKey?: string;`,
    `  signal?: AbortSignal;`,
    `}`,
    ``,
    `export class SabnodeClient {`,
    `  private apiKey: string;`,
    `  private baseUrl: string;`,
    `  private _fetch: typeof globalThis.fetch;`,
    ``,
    `  constructor(opts: SabnodeClientOptions) {`,
    `    if (!opts.apiKey) throw new Error('SabnodeClient: apiKey is required');`,
    `    this.apiKey = opts.apiKey;`,
    `    this.baseUrl = (opts.baseUrl ?? 'https://api.sabnode.com/api/v1').replace(/\\/+$/, '');`,
    `    this._fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);`,
    `  }`,
    ``,
    `  private async _request(opts: RequestOptions): Promise<SabnodeResponse<any>> {`,
    `    const headers: Record<string, string> = {`,
    `      'authorization': 'Bearer ' + this.apiKey,`,
    `      'accept': 'application/json',`,
    `    };`,
    `    let bodyStr: string | undefined = undefined;`,
    `    if (opts.body !== undefined && opts.method !== 'GET' && opts.method !== 'DELETE') {`,
    `      headers['content-type'] = 'application/json';`,
    `      bodyStr = JSON.stringify(opts.body);`,
    `    }`,
    `    if (opts.idempotent || opts.idempotencyKey) {`,
    `      headers['Idempotency-Key'] = opts.idempotencyKey ?? this._randomIdemKey();`,
    `    }`,
    ``,
    `    const url = this.baseUrl + opts.path;`,
    `    const res = await this._fetch(url, {`,
    `      method: opts.method,`,
    `      headers,`,
    `      body: bodyStr,`,
    `      signal: opts.signal,`,
    `    });`,
    `    const requestId = res.headers.get('x-request-id');`,
    `    const rateLimit = {`,
    `      limit: this._num(res.headers.get('x-ratelimit-limit')),`,
    `      remaining: this._num(res.headers.get('x-ratelimit-remaining')),`,
    `      reset: this._num(res.headers.get('x-ratelimit-reset')),`,
    `    };`,
    `    const ct = res.headers.get('content-type') || '';`,
    `    const body = ct.includes('json') ? await res.json().catch(() => null) : null;`,
    `    if (!res.ok) {`,
    `      throw new SabnodeApiError(res.status, body, requestId);`,
    `    }`,
    `    return { status: res.status, headers: res.headers, data: body, requestId, rateLimit };`,
    `  }`,
    ``,
    `  private _num(s: string | null): number | null {`,
    `    if (s == null) return null;`,
    `    const n = Number(s);`,
    `    return Number.isFinite(n) ? n : null;`,
    `  }`,
    ``,
    `  private _randomIdemKey(): string {`,
    `    return 'idem_' + Math.random().toString(36).slice(2) + Date.now().toString(36);`,
    `  }`,
    ``,
    methods,
    `}`,
    ``,
  ].join('\n');
}

export function generateTsSdk(): { wrote: boolean; relPath: string } {
  const body = renderClient();
  const relPath = 'sdks/typescript/src/_generated/client.ts';
  const { wrote } = writeIfChanged(relPath, body);

  // index.ts barrel — small and stable, only written once. Keep it
  // outside `_generated/` so library authors can extend it.
  writeIfChanged(
    'sdks/typescript/src/index.ts',
    [
      `export { SabnodeClient, SabnodeApiError } from './_generated/client';`,
      `export type { SabnodeClientOptions, SabnodeResponse } from './_generated/client';`,
      ``,
    ].join('\n'),
  );

  // package.json — minimal so the SDK can be linked via `pnpm link` or
  // published once tested.
  writeIfChanged(
    'sdks/typescript/package.json',
    JSON.stringify(
      {
        name: '@sabnode/sdk',
        version: '0.1.0',
        type: 'module',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        files: ['dist'],
        scripts: {
          build: 'tsc',
        },
        devDependencies: {
          typescript: '^5.4.0',
        },
      },
      null,
      2,
    ) + '\n',
  );

  writeIfChanged(
    'sdks/typescript/tsconfig.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ES2022',
          moduleResolution: 'bundler',
          declaration: true,
          outDir: 'dist',
          rootDir: 'src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          lib: ['ES2022', 'DOM'],
        },
        include: ['src/**/*'],
      },
      null,
      2,
    ) + '\n',
  );

  writeIfChanged(
    'sdks/typescript/README.md',
    [
      '# @sabnode/sdk',
      '',
      'Generated TypeScript client for the SabNode public API. **DO NOT** edit',
      '`src/_generated/` by hand — re-run `pnpm api:gen` from the repo root.',
      '',
      '## Usage',
      '',
      '```ts',
      "import { SabnodeClient } from '@sabnode/sdk';",
      '',
      "const sn = new SabnodeClient({ apiKey: process.env.SABNODE_API_KEY! });",
      'const me = await sn.identityGetMe();',
      'console.log(me.data);',
      '```',
      '',
    ].join('\n'),
  );

  return { wrote, relPath };
}
