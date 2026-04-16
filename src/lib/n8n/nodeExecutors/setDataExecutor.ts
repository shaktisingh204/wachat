/**
 * Set Data executor — sets / overrides fields on the items passed through.
 *
 * Parameters:
 *   mode            – 'manual' | 'raw' (default: 'manual')
 *
 *   [mode: manual]
 *   assignments     – { assignments: [{ id, name, value, type }] }
 *   includeOtherFields – boolean (default true)
 *
 *   [mode: raw]
 *   jsonOutput      – JSON string / object to use as the entire output item
 */

import type { N8NNode, ExecutionContext, NodeExecutorResult } from '../types';
import { interpolateParameters } from '../helpers/interpolateVariables';

type Assignment = {
  id?: string;
  name: string;
  value: unknown;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'auto';
};

function coerce(value: unknown, type: Assignment['type']): unknown {
  if (type === 'number') return Number(value);
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  }
  if (type === 'object' || type === 'array') {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (type === 'string') return String(value ?? '');
  // auto / undefined — return as-is
  return value;
}

export async function executeSetData(
  node: N8NNode,
  inputItems: Record<string, unknown>[],
  context: ExecutionContext
): Promise<NodeExecutorResult> {
  const items = inputItems.length > 0 ? inputItems : [{}];
  const outputItems: Record<string, unknown>[] = [];

  for (let i = 0; i < items.length; i++) {
    const params = interpolateParameters(node.parameters, context, items, i);
    const mode = (params.mode as string) ?? 'manual';

    if (mode === 'raw') {
      // Replace the item entirely with the provided JSON
      let json: unknown = params.jsonOutput;
      if (typeof json === 'string') {
        try {
          json = JSON.parse(json);
        } catch {
          // leave as string
        }
      }
      if (json !== null && typeof json === 'object' && !Array.isArray(json)) {
        outputItems.push(json as Record<string, unknown>);
      } else {
        outputItems.push({ value: json });
      }
      continue;
    }

    // mode: manual
    const includeOtherFields = params.includeOtherFields !== false;
    const base: Record<string, unknown> = includeOtherFields ? { ...items[i] } : {};

    const rawAssignments = params.assignments as
      | { assignments?: Assignment[] }
      | Assignment[]
      | undefined;

    const assignments: Assignment[] = Array.isArray(rawAssignments)
      ? rawAssignments
      : (rawAssignments?.assignments ?? []);

    for (const assignment of assignments) {
      if (!assignment.name) continue;
      base[assignment.name] = coerce(assignment.value, assignment.type);
    }

    outputItems.push(base);
  }

  return { items: outputItems };
}
