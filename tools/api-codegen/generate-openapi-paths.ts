/**
 * Generate the OpenAPI `paths` object + extension fields from the manifest.
 *
 * Output: `src/lib/api-platform/_generated/openapi-paths.ts`, which exports
 *   - `GENERATED_PATHS`       — `paths` object keyed by OpenAPI-style path
 *   - `GENERATED_SCHEMAS`     — the shared schemas dictionary verbatim
 *   - `GENERATED_INFO`        — `info` block (title, version, description)
 *
 * `src/lib/api-platform/openapi.ts` is refactored to consume these.
 */

import type { EndpointSpec, JsonSchema } from '../api-manifest/types';
import { manifest } from '../api-manifest/index';
import { GENERATED_HEADER, toOpenApiPath, writeIfChanged } from './util';

interface OpenApiOperation {
  tags: string[];
  summary: string;
  description?: string;
  operationId: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
  security: Array<Record<string, string[]>>;
  'x-scope'?: string;
  'x-tier'?: string;
  'x-credits'?: number;
  'x-emits'?: readonly string[];
  'x-idempotent'?: boolean;
  /** Code samples per language — Scalar + Redocly both honor this. */
  'x-codeSamples'?: Array<{ lang: string; label: string; source: string }>;
}

/* ── Code-sample builders ──────────────────────────────────────────────── */

function jsonExampleForSchema(_schema: unknown): string {
  // Conservative default — we don't recursively materialise schemas yet
  // because most manifest bodies are `{ type: 'object' }`. An empty
  // object is a syntactically valid stand-in for every endpoint that
  // takes a JSON body.
  return '{}';
}

function curlSample(spec: EndpointSpec): string {
  const apiPath = toOpenApiPath(spec.path);
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(spec.method);
  const headers = [
    `-H 'Authorization: Bearer YOUR_API_KEY'`,
    hasBody ? `-H 'Content-Type: application/json'` : null,
    spec.idempotent ? `-H 'Idempotency-Key: \\$(uuidgen)'` : null,
  ]
    .filter(Boolean)
    .join(' \\\n  ');
  const bodyLine = hasBody
    ? ` \\\n  -d '${jsonExampleForSchema(spec.requestBody?.schema)}'`
    : '';
  return `curl -X ${spec.method} 'https://api.sabnode.com/api/v1${apiPath}' \\\n  ${headers}${bodyLine}`;
}

function methodIdent(spec: EndpointSpec): string {
  const parts = [spec.module, spec.verb, spec.resource];
  return parts
    .join('_')
    .replace(/[-_/]+([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function tsSdkSample(spec: EndpointSpec): string {
  const fn = methodIdent(spec);
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(spec.method);
  const pathArgs = (spec.pathParams ?? []).map((p) => `${p.name}: 'xxx'`);
  const queryArgs = (spec.queryParams ?? []).map((q) => `${q.name}: 'xxx'`);
  const argParts = [...pathArgs, ...queryArgs];
  if (hasBody) argParts.push(`body: { /* ... */ }`);
  const argLine = argParts.length ? `{ ${argParts.join(', ')} }` : '';
  return [
    `import { SabnodeClient } from '@sabnode/sdk';`,
    ``,
    `const sn = new SabnodeClient({ apiKey: process.env.SABNODE_API_KEY! });`,
    `const res = await sn.${fn}(${argLine});`,
    `console.log(res.data);`,
  ].join('\n');
}

function pythonSample(spec: EndpointSpec): string {
  const apiPath = toOpenApiPath(spec.path);
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(spec.method);
  const lines = [
    `import os, requests`,
    ``,
    `r = requests.${spec.method.toLowerCase()}(`,
    `    "https://api.sabnode.com/api/v1${apiPath}",`,
    `    headers={"Authorization": f"Bearer {os.environ['SABNODE_API_KEY']}"}${hasBody ? ',' : ''}`,
  ];
  if (hasBody) lines.push(`    json={},`);
  lines.push(`)`);
  lines.push(`r.raise_for_status()`);
  lines.push(`print(r.json())`);
  return lines.join('\n');
}

function buildCodeSamples(spec: EndpointSpec): OpenApiOperation['x-codeSamples'] {
  return [
    { lang: 'cURL', label: 'cURL', source: curlSample(spec) },
    { lang: 'TypeScript', label: 'TS SDK', source: tsSdkSample(spec) },
    { lang: 'Python', label: 'Python', source: pythonSample(spec) },
  ];
}

function operationIdFor(spec: EndpointSpec): string {
  const cleanPath = spec.path
    .replace(/^\//, '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\//g, '-');
  return `${spec.method.toLowerCase()}-${cleanPath}`;
}

function buildParameters(spec: EndpointSpec): unknown[] {
  const params: unknown[] = [];
  for (const p of spec.pathParams ?? []) {
    params.push({
      name: p.name,
      in: 'path',
      required: true,
      schema: p.schema,
      ...(p.description ? { description: p.description } : {}),
    });
  }
  for (const q of spec.queryParams ?? []) {
    params.push({
      name: q.name,
      in: 'query',
      required: q.required ?? false,
      schema: q.schema,
      ...(q.description ? { description: q.description } : {}),
    });
  }
  return params;
}

function buildResponses(spec: EndpointSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [code, { schema, description }] of Object.entries(spec.responses)) {
    // Map our synthetic `2xx` shorthand to the canonical success code for the
    // method: 201 for create-style POST, 200 otherwise.
    const httpCode =
      code === '2xx' ? (spec.verb === 'create' && spec.method === 'POST' ? '201' : '200') : code;
    out[httpCode] = {
      description,
      ...(schema
        ? {
            content: { 'application/json': { schema } },
          }
        : {}),
    };
  }
  return out;
}

function buildOperation(spec: EndpointSpec): OpenApiOperation {
  const op: OpenApiOperation = {
    tags: [spec.module],
    summary: spec.summary,
    operationId: operationIdFor(spec),
    responses: buildResponses(spec),
    security: [{ ApiKeyAuth: [] }],
    'x-scope': spec.scope,
    'x-tier': spec.tier,
  };
  if (spec.description) op.description = spec.description;
  const params = buildParameters(spec);
  if (params.length) op.parameters = params;
  if (spec.requestBody) {
    op.requestBody = {
      required: spec.requestBody.required ?? false,
      ...(spec.requestBody.description ? { description: spec.requestBody.description } : {}),
      content: { 'application/json': { schema: spec.requestBody.schema } },
    };
  }
  if (spec.credits) op['x-credits'] = spec.credits;
  if (spec.emits?.length) op['x-emits'] = spec.emits;
  if (spec.idempotent) op['x-idempotent'] = true;
  op['x-codeSamples'] = buildCodeSamples(spec);
  return op;
}

interface PathsObject {
  [path: string]: { [method: string]: OpenApiOperation };
}

function buildPaths(): PathsObject {
  const paths: PathsObject = {};
  for (const spec of manifest.endpoints) {
    const oapiPath = toOpenApiPath(spec.path);
    const existing = paths[oapiPath] ?? {};
    existing[spec.method.toLowerCase()] = buildOperation(spec);
    paths[oapiPath] = existing;
  }
  // Sort keys for deterministic output.
  return Object.keys(paths)
    .sort()
    .reduce<PathsObject>((acc, k) => {
      acc[k] = paths[k];
      return acc;
    }, {});
}

function stringifyConst(name: string, value: unknown, type: string): string {
  return `export const ${name}: ${type} = ${JSON.stringify(value, null, 2)};`;
}

export function generateOpenApiPaths(): { wrote: boolean; relPath: string } {
  const paths = buildPaths();
  const schemas: Record<string, JsonSchema> = { ...manifest.schemas };

  const body = [
    GENERATED_HEADER,
    `/* eslint-disable */`,
    ``,
    stringifyConst('GENERATED_INFO', manifest.info, 'Record<string, unknown>'),
    ``,
    stringifyConst('GENERATED_SCHEMAS', schemas, 'Record<string, unknown>'),
    ``,
    stringifyConst('GENERATED_PATHS', paths, 'Record<string, Record<string, unknown>>'),
    ``,
  ].join('\n');

  const relPath = 'src/lib/api-platform/_generated/openapi-paths.ts';
  const { wrote } = writeIfChanged(relPath, body);
  return { wrote, relPath };
}
