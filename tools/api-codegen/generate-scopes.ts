/**
 * Generate the `OAuthScope` union from the manifest.
 *
 * Output: `src/lib/api-platform/_generated/scopes.ts`. The hand-edited
 * `src/lib/api-platform/types.ts` re-exports `OAuthScope` from the
 * generated file (see Phase 0.4 wiring).
 *
 * Wildcards (`*`, `<resource>:*`) are preserved verbatim.
 */

import { manifest } from '../api-manifest/index';
import { GENERATED_HEADER, writeIfChanged } from './util';

export function generateScopes(): { wrote: boolean; relPath: string } {
  const all = new Set<string>(['*']);
  for (const spec of manifest.endpoints) {
    all.add(spec.scope);
  }
  // Always-on infrastructure scopes that don't yet have endpoints behind them.
  all.add('me:read');
  all.add('webhooks:read');
  all.add('webhooks:write');
  // MCP-only scopes: no generated /api/v1 endpoints sit behind these yet —
  // they gate the SabCRM MCP server at `src/app/api/mcp/sabcrm/route.ts`
  // (read tools ↔ sabcrm:read, mutations ↔ sabcrm:write).
  all.add('sabcrm:read');
  all.add('sabcrm:write');

  const sorted = Array.from(all).sort();
  const union = sorted.map((s) => `  | '${s}'`).join('\n');

  const body = [
    GENERATED_HEADER,
    `/* eslint-disable */`,
    ``,
    `/** All OAuth / API-key scopes recognised by the platform. */`,
    `export type OAuthScope =`,
    union + ';',
    ``,
    `export const ALL_SCOPES: ReadonlyArray<OAuthScope> = [`,
    sorted.map((s) => `  '${s}',`).join('\n'),
    `] as const;`,
    ``,
  ].join('\n');

  const relPath = 'src/lib/api-platform/_generated/scopes.ts';
  const { wrote } = writeIfChanged(relPath, body);
  return { wrote, relPath };
}
