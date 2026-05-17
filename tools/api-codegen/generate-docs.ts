/**
 * Per-module markdown docs generator.
 *
 * Emits one file per `EndpointSpec.module` under `docs/api/<module>.md`,
 * plus an index at `docs/api/README.md`. Each per-module file lists every
 * endpoint with:
 *
 *   - HTTP method + path + summary + description
 *   - Required scope + tier + credit cost + idempotency flag
 *   - Path/query/body parameters as tables
 *   - Three code samples: cURL, TS SDK, Python
 *
 * Content is derived entirely from the manifest, so re-running
 * `pnpm api:gen` keeps the docs in lockstep with the routes.
 */

import type { EndpointSpec } from '../api-manifest/types';
import { manifest } from '../api-manifest/index';
import { GENERATED_HEADER, toOpenApiPath, writeIfChanged } from './util';

function methodIdent(spec: EndpointSpec): string {
  return [spec.module, spec.verb, spec.resource]
    .join('_')
    .replace(/[-_/]+([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function curl(spec: EndpointSpec): string {
  const apiPath = toOpenApiPath(spec.path);
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(spec.method);
  const headers = [
    `-H "Authorization: Bearer $SABNODE_API_KEY"`,
    hasBody ? `-H "Content-Type: application/json"` : null,
  ]
    .filter(Boolean)
    .join(' \\\n  ');
  return [
    `curl -X ${spec.method} "https://api.sabnode.com/api/v1${apiPath}" \\`,
    `  ${headers}${hasBody ? ' \\\n  -d \'{}\'' : ''}`,
  ].join('\n');
}

function tsExample(spec: EndpointSpec): string {
  const fn = methodIdent(spec);
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(spec.method);
  const args: string[] = [];
  for (const p of spec.pathParams ?? []) args.push(`${p.name}: 'xxx'`);
  for (const q of spec.queryParams ?? []) args.push(`${q.name}: 'xxx'`);
  if (hasBody) args.push('body: { /* ... */ }');
  const argLine = args.length ? `{ ${args.join(', ')} }` : '';
  return [
    `import { SabnodeClient } from '@sabnode/sdk';`,
    ``,
    `const sn = new SabnodeClient({ apiKey: process.env.SABNODE_API_KEY! });`,
    `const res = await sn.${fn}(${argLine});`,
    `console.log(res.data);`,
  ].join('\n');
}

function python(spec: EndpointSpec): string {
  const apiPath = toOpenApiPath(spec.path);
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(spec.method);
  const lines = [
    'import os, requests',
    '',
    `r = requests.${spec.method.toLowerCase()}(`,
    `    "https://api.sabnode.com/api/v1${apiPath}",`,
    `    headers={"Authorization": f"Bearer {os.environ['SABNODE_API_KEY']}"}${hasBody ? ',' : ''}`,
  ];
  if (hasBody) lines.push('    json={},');
  lines.push(')');
  lines.push('r.raise_for_status()');
  lines.push('print(r.json())');
  return lines.join('\n');
}

function flag(label: string, value: unknown): string {
  return `**${label}:** ${String(value)}`;
}

function paramTable(
  title: string,
  rows: ReadonlyArray<{ name: string; required?: boolean; description?: string; schema?: { type?: string } }>,
): string {
  if (!rows.length) return '';
  const header = [
    `**${title}**`,
    '',
    '| Name | Type | Required | Description |',
    '|------|------|----------|-------------|',
  ];
  const body = rows.map((r) => {
    const type = r.schema?.type ?? 'string';
    const req = r.required ? '✓' : ' ';
    return `| \`${r.name}\` | \`${type}\` | ${req} | ${(r.description ?? '').replace(/\|/g, '\\|')} |`;
  });
  return [...header, ...body, ''].join('\n');
}

function renderEndpoint(spec: EndpointSpec): string {
  const apiPath = toOpenApiPath(spec.path);
  const meta = [
    flag('Scope', '`' + spec.scope + '`'),
    flag('Tier', spec.tier),
    spec.credits ? flag('Credits', spec.credits) : null,
    spec.idempotent ? flag('Idempotent', 'yes') : null,
    spec.emits?.length ? flag('Emits', spec.emits.map((e) => '`' + e + '`').join(', ')) : null,
  ]
    .filter(Boolean)
    .join(' &middot; ');

  return [
    `### \`${spec.method}\` \`${apiPath}\``,
    '',
    spec.summary,
    '',
    spec.description ? spec.description + '\n' : '',
    meta,
    '',
    paramTable(
      'Path parameters',
      (spec.pathParams ?? []).map((p) => ({
        name: p.name,
        required: true,
        description: p.description,
        schema: p.schema,
      })),
    ),
    paramTable(
      'Query parameters',
      (spec.queryParams ?? []).map((q) => ({
        name: q.name,
        required: q.required,
        description: q.description,
        schema: q.schema,
      })),
    ),
    spec.requestBody ? '**Request body:** JSON.\n' : '',
    '<details><summary>cURL</summary>',
    '',
    '```bash',
    curl(spec),
    '```',
    '',
    '</details>',
    '',
    '<details><summary>TypeScript SDK</summary>',
    '',
    '```ts',
    tsExample(spec),
    '```',
    '',
    '</details>',
    '',
    '<details><summary>Python</summary>',
    '',
    '```python',
    python(spec),
    '```',
    '',
    '</details>',
    '',
    '---',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export function generateDocs(): { wrote: boolean; relPaths: string[] } {
  const byModule = new Map<string, EndpointSpec[]>();
  for (const spec of manifest.endpoints) {
    const ex = byModule.get(spec.module);
    if (ex) ex.push(spec);
    else byModule.set(spec.module, [spec]);
  }
  for (const arr of byModule.values()) {
    arr.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
  }

  const written: string[] = [];

  // Per-module pages.
  const moduleNames = Array.from(byModule.keys()).sort();
  for (const mod of moduleNames) {
    const specs = byModule.get(mod)!;
    const body = [
      `<!-- @generated by tools/api-codegen — DO NOT EDIT BY HAND. -->`,
      `<!-- Source: tools/api-manifest/. Run \`pnpm api:gen\` to regenerate. -->`,
      '',
      `# ${mod}`,
      '',
      `${specs.length} endpoint${specs.length === 1 ? '' : 's'}.`,
      '',
      '## Authentication',
      '',
      'Every endpoint requires a Bearer token in the `Authorization` header. Tokens may be:',
      '',
      '- An **API key** issued from `/dashboard/api/keys` (tenant-scoped)',
      '- A **Personal Access Token** issued from `/dashboard/api/personal-tokens` (user-scoped, RBAC-bound)',
      '- An **OAuth access token** obtained via the Authorization Code + PKCE flow',
      '',
      '## Errors',
      '',
      'Errors follow the RFC 7807 problem-details envelope:',
      '',
      '```json',
      '{',
      '  "type": "https://errors.sabnode.dev/v1/validation_failed",',
      '  "title": "Validation failed",',
      '  "status": 422,',
      '  "detail": "...",',
      '  "request_id": "req_..."',
      '}',
      '```',
      '',
      '## Endpoints',
      '',
      ...specs.map(renderEndpoint),
    ].join('\n');
    const relPath = `docs/api/${mod}.md`;
    const { wrote } = writeIfChanged(relPath, body);
    if (wrote) written.push(relPath);
  }

  // Index.
  const total = manifest.endpoints.length;
  const indexBody = [
    `<!-- @generated by tools/api-codegen — DO NOT EDIT BY HAND. -->`,
    '',
    '# SabNode Developer API',
    '',
    `**${total} endpoints** across ${moduleNames.length} module groups.`,
    '',
    'The full OpenAPI 3.1 document is at [`/api/v1/openapi`](../../src/lib/api-platform/_generated/openapi-paths.ts) (also browsable at [`/api/docs/reference`](https://api.sabnode.com/api/docs/reference) with the live Scalar viewer).',
    '',
    '## Modules',
    '',
    ...moduleNames.map((m) => `- [${m}](./${m}.md) — ${byModule.get(m)!.length} endpoints`),
    '',
    '## SDKs',
    '',
    '- TypeScript: `@sabnode/sdk` (generated, in `sdks/typescript/`)',
    '- Python: planned',
    '',
    '## Quick start',
    '',
    '```bash',
    'curl https://api.sabnode.com/api/v1/me \\',
    `  -H 'Authorization: Bearer $SABNODE_API_KEY'`,
    '```',
    '',
    '```ts',
    "import { SabnodeClient } from '@sabnode/sdk';",
    '',
    'const sn = new SabnodeClient({ apiKey: process.env.SABNODE_API_KEY! });',
    'const me = await sn.identityGetMe();',
    'console.log(me.data);',
    '```',
    '',
  ].join('\n');
  const indexPath = 'docs/api/README.md';
  const { wrote } = writeIfChanged(indexPath, indexBody);
  if (wrote) written.push(indexPath);

  return { wrote: written.length > 0, relPaths: written };
}
