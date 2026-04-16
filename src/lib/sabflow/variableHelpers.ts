import { createId } from '@paralleldrive/cuid2';
import type { SabFlowDoc, Variable, Block } from './types';

/* ── extractVariableUsages ─────────────────────────────────────────────────
 *
 * Scans every block's `options` (and nested structures) for any field whose
 * value is a variableId that matches a known variable.  Returns a Map of
 *   variableId → array of block IDs that reference it.
 *
 * Fields scanned (Typebot / SabFlow conventions):
 *   - options.variableId
 *   - options.dynamicVariableId
 *   - options.responseVariable
 *   - options.statusCodeVariable
 *   - options.responseMappings[].variableId
 *   - options.cellsToExtract[].variableId
 *   - options.conditions[].variableId
 *   - options.waitForEvent.saveDataInVariableId
 *   - items[].content.comparisons[].variableId  (condition items)
 *
 * Anything referencing a variableId that is NOT in the flow's variables list
 * is silently ignored (stale reference).
 * ─────────────────────────────────────────────────────────────────────────── */

type ResponseMappingRow = { variableId?: string; [key: string]: unknown };
type CellExtractRow     = { variableId?: string; [key: string]: unknown };
type ConditionRow       = { variableId?: string; [key: string]: unknown };
type ComparisonRow      = { variableId?: string; [key: string]: unknown };
type ConditionContent   = { comparisons?: ComparisonRow[] };
type ConditionItem      = { content?: ConditionContent };

function collectFromBlock(block: Block): string[] {
  const ids: string[] = [];
  const opts = block.options ?? {};

  const pushIfString = (v: unknown) => {
    if (typeof v === 'string' && v) ids.push(v);
  };

  // Single-field references
  pushIfString(opts['variableId']);
  pushIfString(opts['dynamicVariableId']);
  pushIfString(opts['responseVariable']);
  pushIfString(opts['statusCodeVariable']);

  // responseMappings[]
  if (Array.isArray(opts['responseMappings'])) {
    for (const row of opts['responseMappings'] as ResponseMappingRow[]) {
      pushIfString(row.variableId);
    }
  }

  // cellsToExtract[]
  if (Array.isArray(opts['cellsToExtract'])) {
    for (const row of opts['cellsToExtract'] as CellExtractRow[]) {
      pushIfString(row.variableId);
    }
  }

  // conditions[] (flat SabFlow model)
  if (Array.isArray(opts['conditions'])) {
    for (const row of opts['conditions'] as ConditionRow[]) {
      pushIfString(row.variableId);
    }
  }

  // embed waitForEvent
  const waitForEvent = opts['waitForEvent'] as { saveDataInVariableId?: string } | undefined;
  pushIfString(waitForEvent?.saveDataInVariableId);

  // condition block items: item.content.comparisons[].variableId
  if (Array.isArray(block.items)) {
    for (const item of block.items as ConditionItem[]) {
      if (Array.isArray(item.content?.comparisons)) {
        for (const cmp of item.content!.comparisons as ComparisonRow[]) {
          pushIfString(cmp.variableId);
        }
      }
    }
  }

  return ids;
}

export function extractVariableUsages(flow: SabFlowDoc): Map<string, string[]> {
  const known = new Set(flow.variables.map((v) => v.id));
  const usages = new Map<string, string[]>();

  for (const group of flow.groups) {
    for (const block of group.blocks) {
      const refs = collectFromBlock(block);
      for (const variableId of refs) {
        if (!known.has(variableId)) continue;
        const existing = usages.get(variableId);
        if (existing) {
          if (!existing.includes(block.id)) existing.push(block.id);
        } else {
          usages.set(variableId, [block.id]);
        }
      }
    }
  }

  return usages;
}

/* ── resolveVariables ──────────────────────────────────────────────────────
 *
 * Replaces every `{{variableName}}` token in `text` with the matching value
 * from the `variables` map (keyed by name).  Unknown tokens are left as-is.
 * ─────────────────────────────────────────────────────────────────────────── */

export function resolveVariables(
  text: string,
  variables: Record<string, unknown>,
): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, rawName: string) => {
    const name = rawName.trim();
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      const val = variables[name];
      return val === null || val === undefined ? '' : String(val);
    }
    return match;
  });
}

/* ── getVariableByName ─────────────────────────────────────────────────────
 *
 * Linear scan — acceptable for the small arrays found in typical flows.
 * ─────────────────────────────────────────────────────────────────────────── */

export function getVariableByName(
  variables: Variable[],
  name: string,
): Variable | undefined {
  return variables.find((v) => v.name === name);
}

/* ── createVariable ────────────────────────────────────────────────────────
 *
 * Factory that guarantees a fresh cuid2 id and sensible defaults.
 * ─────────────────────────────────────────────────────────────────────────── */

export function createVariable(
  name: string,
  overrides?: Partial<Omit<Variable, 'id' | 'name'>>,
): Variable {
  return {
    id: createId(),
    name,
    ...overrides,
  };
}
