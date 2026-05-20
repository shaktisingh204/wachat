/**
 * Pure builder for `ForgeLoadOptionsContext` — extracted from the route so
 * it's unit-testable without spinning up Next.js + the auth pipeline.
 *
 * Context exposes:
 *   • `credential`              — decrypted credential record
 *   • `options`                 — current options snapshot from the editor
 *   • `getNodeParameter`        — read a sibling field's value (auto-extracts
 *                                 resourceLocator values to plain ids)
 *   • `getCurrentNodeParameter` — alias used by n8n resolvers
 *   • `getNode`                 — minimal node identity for diagnostics
 *
 * Phase 3 will add `filter` / `paginationToken`. Phase 4 will add `helpers`.
 */

import type {
  ForgeBlock,
  ForgeField,
  ForgeLoadOptionsContext,
} from '@/lib/sabflow/forge/types';
import { extractValue, isResourceLocatorValue } from '@/lib/sabflow/forge/extractValue';
import { makeHelpers } from '@/lib/sabflow/forge/helpers';

export type BuildLoadOptionsContextArgs = {
  block: ForgeBlock;
  actionId?: string;
  options: Record<string, unknown>;
  credential?: Record<string, string>;
  filter?: string;
  paginationToken?: string | null;
};

export function buildLoadOptionsContext(
  args: BuildLoadOptionsContextArgs,
): ForgeLoadOptionsContext {
  const { block, actionId, options, credential, filter, paginationToken } = args;

  // Build a name→field map scoped to the current action so resourceLocator
  // values can be auto-extracted to plain ids when a resolver reads a
  // sibling field via `getNodeParameter`. Matches n8n's `extractValue: true`
  // behaviour by default; resolvers that need the raw `{ mode, value }` shape
  // can still poke `ctx.options[name]` directly.
  const siblingFields: ForgeField[] = actionId
    ? block.actions?.find((a) => a.id === actionId)?.fields ?? []
    : block.fields ?? [];
  const fieldByName = new Map<string, ForgeField>(
    siblingFields.map((f) => [f.id, f]),
  );

  const readParam = (name: string, fallback?: unknown): unknown => {
    if (!Object.prototype.hasOwnProperty.call(options, name)) return fallback;
    const raw = options[name];
    const def = fieldByName.get(name);
    // Auto-extract resourceLocator values — resolvers expect the final id,
    // not the `{ mode, value }` envelope. Stays a no-op for plain string
    // values, preserving back-compat with every existing forge field.
    if (def?.type === 'resourceLocator' || isResourceLocatorValue(raw)) {
      return extractValue(
        raw as never,
        def?.modes,
      );
    }
    return raw;
  };

  return {
    credential,
    options,
    getNodeParameter: readParam,
    getCurrentNodeParameter: readParam,
    getNode: () => ({ id: block.id, name: block.name }),
    helpers: makeHelpers(credential),
    filter,
    paginationToken,
  };
}
