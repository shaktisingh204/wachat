/**
 * Pure builder for `ForgeLoadOptionsContext` — extracted from the route so
 * it's unit-testable without spinning up Next.js + the auth pipeline.
 *
 * In Phase 1 the context exposes:
 *   • `credential`              — decrypted credential record
 *   • `options`                 — current options snapshot from the editor
 *   • `getNodeParameter`        — read a sibling field's value
 *   • `getCurrentNodeParameter` — alias used by n8n resolvers
 *   • `getNode`                 — minimal node identity for diagnostics
 *
 * Phase 2 will also normalise `resourceLocator` values via `extractValue`.
 * Phase 3 will add `filter` / `paginationToken`. Phase 4 will add `helpers`.
 */

import type {
  ForgeBlock,
  ForgeLoadOptionsContext,
} from '@/lib/sabflow/forge/types';

export type BuildLoadOptionsContextArgs = {
  block: ForgeBlock;
  actionId?: string;
  options: Record<string, unknown>;
  credential?: Record<string, string>;
};

export function buildLoadOptionsContext(
  args: BuildLoadOptionsContextArgs,
): ForgeLoadOptionsContext {
  const { block, options, credential } = args;

  const readParam = (name: string, fallback?: unknown): unknown =>
    Object.prototype.hasOwnProperty.call(options, name)
      ? options[name]
      : fallback;

  return {
    credential,
    options,
    getNodeParameter: readParam,
    getCurrentNodeParameter: readParam,
    getNode: () => ({ id: block.id, name: block.name }),
  };
}
